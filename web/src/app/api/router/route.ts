/**
 * POST /api/router — OpenAI-augmented routing pipeline.
 *
 * Implements openai_router_production_design.md §2, §5, §11, §18.
 *
 * Pipeline (max 2 OpenAI calls per request):
 *   frontend
 *     → runUnderstanding         (OpenAI Responses API, structured JSON)
 *     → retrieveFromLocalMulti   (FAQ retrieval driven by AI searchQueries)
 *     → decideRoute + reconcile  (deterministic rules — tighten-only)
 *     → renderFinalAnswer        (OpenAI Responses API, plain text)
 *     → audit log + persist
 *     → frontend
 *
 * Hard invariants (§2.2):
 *   1. OpenAI calls only on the server. No keys touch the client.
 *   2. Rule layer outranks AI. Deterministic gates (high_risk_gate,
 *      official_only_gate, escalation_gate) still fire on the raw query.
 *   3. AI hints can only TIGHTEN risk/mode, never loosen.
 *   4. If OpenAI fails (no key, timeout, 5xx, JSON error), fall back to
 *      classifyFallback + templated render. The router never crashes.
 *   5. Every request is audited with a requestId.
 */

import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { ok, fail, rateLimited } from '@/lib/utils/api-response'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'

import { runUnderstanding } from '@/lib/ai/understand'
import { getCachedUnderstanding, setCachedUnderstanding } from '@/lib/ai/understanding-cache'
import { renderFinalAnswer, faqToRetrieved } from '@/lib/ai/generate'
import { retrieveFromLocal, retrieveFromLocalMulti } from '@/lib/knowledge/retrieve'
import { decideRoute } from '@/lib/router/decide'
import { validateDecision } from '@/lib/validation/guardrails'
import { logRouterDecision, logError } from '@/lib/audit/logger'
import {
  insertUserQuery,
  insertHandoff,
  insertCase,
  insertEvent,
} from '@/lib/db/tables'
import {
  validateAnswerPayload,
  staticFactBlock,
  aiInferredBlock,
  type AnswerPayload,
} from '@/lib/domain/contracts'
import { env as openaiEnv } from '@/lib/ai/openai'
import { checkPromptInjection, sanitizeForLog } from '@/lib/security/prompt-injection'
import { buildSecurityEvent, classifySecuritySeverity, logSecurityEvent } from '@/lib/security/event-log'
import { buildLayerHitEvent, recordLayerHit } from '@/lib/pipeline/writeback-hooks'
import { recordRoutingDecision } from '@/lib/patent/metrics-collector'
import { createEvidenceRecord, logEvidenceRecord } from '@/lib/patent/evidence-chain-logger'
import { evaluateAll, JUDGMENT_RULES } from '@/lib/judgment/registry'
import { optimizeRoute, featuresFromRouterContext } from '@/lib/routing/optimizer'
import { validateOutput } from '@/lib/security/output-validator'
import { scoreQuestionQuality } from '@/lib/ai/question-quality'
import { resolveIdentity } from '@/lib/auth/identity'
import { classifyAnswer, validateAnswerMeta, detectFalseClaims } from '@/lib/answer-reliability'
import { buildAnswerAuditRecord, emitAnswerAudit } from '@/lib/audit/answer-audit'
import { validateAnswerQuality } from '@/lib/validation/answer-quality'
import { devLogJson } from '@/lib/utils/dev-log'
import { validateMessageLength, enforceQuota, enforceRateLimit } from '@/app/api/router/quota-gate'
import { extractClientIp } from '@/lib/security/rate-limit'

import type { AnswerMode as RuleAnswerMode, RiskLevel } from '@/lib/router/types'
import type { AnswerMode as ApiAnswerMode, AIUnderstandingResult, Language } from '@/lib/ai/types'

/** Map the rule engine's internal answerMode to the public API mode (§5.2). */
function ruleModeToApiMode(rm: RuleAnswerMode): ApiAnswerMode {
  if (rm === 'direct_answer') return 'normal'
  return rm
}

/** Character-based language fallback if AI understanding didn't return one. */
function detectLanguageFallback(text: string): Language {
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja'
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh'
  return 'en'
}

/**
 * Tighten-only reconcile. AI may push risk up, force handoff, or force
 * official_only. AI may NOT downgrade. From design doc §8.3 + §10.
 */
function reconcileDecision(
  ruleAnswerMode: RuleAnswerMode,
  ruleRisk: RiskLevel,
  ai: AIUnderstandingResult,
): { answerMode: RuleAnswerMode; riskLevel: RiskLevel; note: string } {
  let answerMode = ruleAnswerMode
  let riskLevel = ruleRisk
  const notes: string[] = []

  const rank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 }
  if (rank[ai.riskLevel] > rank[riskLevel]) {
    riskLevel = ai.riskLevel
    notes.push(`ai_raised_risk:${ai.riskLevel}`)
  }

  if (ai.shouldHandoff && answerMode !== 'handoff') {
    answerMode = 'handoff'
    notes.push('ai_forced_handoff')
  } else if (
    ai.shouldOfficialOnly &&
    answerMode !== 'handoff' &&
    answerMode !== 'official_only'
  ) {
    answerMode = 'official_only'
    notes.push('ai_forced_official_only')
  }

  return { answerMode, riskLevel, note: notes.join(',') }
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`router:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.ai);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const startedAt = Date.now()
  const requestId = randomUUID()

  try {
    const body = await req.json()
    // Accept both the new spec key (`message`) and the legacy frontend key
    // (`queryText`) so the existing UI keeps working without a redeploy.
    const message = String(body.message ?? body.queryText ?? '').trim()
    const sessionId = (body.sessionId as string | undefined) ?? undefined
    const taskState = body.taskState ?? {}
    const clarificationRounds = Number(body.clarificationRounds || 0)

    if (!message) {
      return fail('message is required')
    }

    // Per-IP rate limit — AI routes (30 req/min)
    const ipRateCheck = enforceRateLimit(extractClientIp(req.headers))
    if (!ipRateCheck.ok) return ipRateCheck.response

    // Message length guard — before any LLM call.
    const lengthCheck = validateMessageLength(message, requestId)
    if (!lengthCheck.ok) return lengthCheck.response

    // V6 §P0-3 — Prompt injection detection. Runs BEFORE any LLM call.
    const injectionCheck = checkPromptInjection(message)
    if (injectionCheck.detected && injectionCheck.highestSeverity === 'high') {
      const secClass = classifySecuritySeverity(injectionCheck.highestSeverity)
      logSecurityEvent(
        buildSecurityEvent({
          eventType: secClass.eventType,
          severity: secClass.severity,
          route: '/api/router',
          inputPreview: sanitizeForLog(message, 200),
          matchedPatternIds: injectionCheck.matchedPatterns.map((p) => p.id),
          description: `Prompt injection blocked: ${injectionCheck.matchedPatterns.map((p) => p.description).join('; ')}`,
          blocked: true,
        }),
      )
      return fail('Your input could not be processed. Please rephrase your question.')
    }

    // Spec §8.3 — durable QUERY_RECEIVED event at the very top of the path.
    // This is what makes the sensing loop possible: every query, matched or
    // not, is persisted as an event row (not console-only).
    insertEvent({
      eventType: 'QUERY_RECEIVED',
      route: '/api/router',
      relatedIds: { sessionId },
      metadata: {
        requestId,
        messageLength: message.length,
        languageGuess: detectLanguageFallback(message),
      },
    })

    // ── Server-side quota enforcement ─────────────────────────────
    // Must run before ANY call to the LLM.
    const identity = await resolveIdentity()
    const detectedLanguageEarly = detectLanguageFallback(message)
    const sessionToken = body?.sessionToken as string | undefined

    const quotaGate = await enforceQuota(
      sessionToken,
      identity,
      detectedLanguageEarly,
      requestId,
    )
    if (!quotaGate.ok) return quotaGate.response
    // ── End quota enforcement ───────────────────────────────────

    // Spec §12 — minimal path trace. We mutate this as we walk the layers so
    // the audit log and response can show exactly which layer answered.
    const pathTrace: {
      layers: string[]
      llmCalled: boolean
      understandingCached: boolean
      sourceClass: 'STATIC' | 'REALTIME' | 'AI_INFERRED' | 'ESCALATION' | 'UNKNOWN'
    } = {
      layers: ['query_received'],
      llmCalled: false,
      understandingCached: false,
      sourceClass: 'UNKNOWN',
    }

    // ----------------------------------------------------------------
    // 1) AI understanding (OpenAI Responses API). Falls back on failure.
    //    Check in-memory LRU cache first to skip the OpenAI round-trip.
    //    Run a baseline retrieveFromLocal in parallel with the AI call so
    //    we overlap retrieval latency with the OpenAI network call.
    // ----------------------------------------------------------------
    const cachedUnderstanding = getCachedUnderstanding(message)
    let understandingCached = false

    // Run baseline retrieval eagerly (sync) so the result is ready
    // regardless of whether the AI call succeeds or provides searchQueries.
    const baselineRetrieval = retrieveFromLocal(message)

    let understanding: import('@/lib/ai/types').UnderstandingResult
    if (cachedUnderstanding) {
      understanding = cachedUnderstanding
      understandingCached = true
    } else {
      understanding = await runUnderstanding(message)
      // Cache successful OpenAI results
      setCachedUnderstanding(message, understanding)
    }

    const ai = understanding.understanding
    const detectedLanguage: Language = ai.language || detectLanguageFallback(message)
    const openaiUsed = understanding.source === 'openai'
    const fallbackUsed = understanding.source === 'fallback'
    pathTrace.layers.push(`understand:${understanding.source}${understandingCached ? ':cached' : ''}`)
    pathTrace.understandingCached = understandingCached
    if (openaiUsed && !understandingCached) pathTrace.llmCalled = true

    const tUnderstand = Date.now()

    // ----------------------------------------------------------------
    // 1b) v9 — Question quality scoring (pure, no I/O).
    // ----------------------------------------------------------------
    const qualityScore = scoreQuestionQuality(message)

    // ----------------------------------------------------------------
    // 2) Retrieval — multi-query when AI gave us rewrites, else original.
    //    If AI provided searchQueries, run multi-query retrieval (sync).
    //    Otherwise reuse the baseline retrieval that already ran above.
    // ----------------------------------------------------------------
    const retrieval =
      ai.searchQueries.length > 0
        ? retrieveFromLocalMulti(message, ai.searchQueries)
        : baselineRetrieval

    const tRetrieve = Date.now()

    // ----------------------------------------------------------------
    // 3) Rule engine — deterministic safety gates on the raw query.
    // ----------------------------------------------------------------
    const rawDecision = decideRoute({
      queryText: message,
      normalizedQuery: message.toLowerCase(),
      taskState,
      retrieval: retrieval.summary,
      clarificationRounds,
    })
    const ruleDecision = validateDecision(rawDecision)

    // ----------------------------------------------------------------
    // 4) Tighten-only reconciliation with AI hints.
    // ----------------------------------------------------------------
    const reconciled = reconcileDecision(
      ruleDecision.answerMode,
      ruleDecision.riskLevel,
      ai,
    )
    const decision = {
      ...ruleDecision,
      answerMode: reconciled.answerMode,
      riskLevel: reconciled.riskLevel,
      shouldEscalate:
        ruleDecision.shouldEscalate || reconciled.answerMode === 'handoff',
      decisionReason: [ruleDecision.decisionReason, reconciled.note]
        .filter(Boolean)
        .join(' | '),
    }

    // ----------------------------------------------------------------
    // 4.1) v7 — JudgmentRegistry evaluation. Runs the structured
    //       expert judgment rules against query context. Best-effort.
    // ----------------------------------------------------------------
    let judgmentAction: string | null = null
    let judgmentRuleId: string | null = null
    try {
      const judgmentCtx = {
        query_text: message,
        risk_level: decision.riskLevel,
        confidence_band: decision.confidenceBand,
        language: detectedLanguage,
      }
      const judgmentResult = evaluateAll(JUDGMENT_RULES, judgmentCtx)
      if (judgmentResult.topRule) {
        judgmentAction = judgmentResult.topRule.action
        judgmentRuleId = judgmentResult.topRule.ruleId
        pathTrace.layers.push(`judgment:${judgmentRuleId}`)
      }
    } catch (e) {
      logError('judgment_registry_error', e)
    }

    // ----------------------------------------------------------------
    // 4.2) v7 — Routing Optimizer. Mathematical route scoring:
    //       R* = argmin[α·cost + β·latency - γ·quality]
    //       Logged for patent 方案A data collection. Best-effort.
    // ----------------------------------------------------------------
    let optimizerResult: ReturnType<typeof optimizeRoute> | null = null
    try {
      const features = featuresFromRouterContext(
        retrieval.summary,
        decision.riskLevel,
        decision.confidenceBand,
        0, // fLang populated when user session f_lang is wired
      )
      optimizerResult = optimizeRoute(features)
      pathTrace.layers.push(`optimizer:${optimizerResult.optimal}`)
    } catch (e) {
      logError('routing_optimizer_error', e)
    }

    const tDecide = Date.now()

    const apiMode: ApiAnswerMode = ruleModeToApiMode(decision.answerMode)
    const topMatch = retrieval.matches[0] ?? null
    const knowledgeFound = retrieval.matches.length > 0
    pathTrace.layers.push(
      knowledgeFound ? `retrieve:hit(${retrieval.matches.length})` : 'retrieve:miss',
    )

    // Spec §8.3 — RETRIEVE_HIT_STATIC event whenever the local knowledge base
    // actually returned something. Lets staff audit how often STATIC wins.
    if (knowledgeFound && topMatch) {
      insertEvent({
        eventType: 'RETRIEVE_HIT_STATIC',
        route: '/api/router',
        relatedIds: { cardId: topMatch.id, sessionId },
        metadata: {
          requestId,
          topScore: retrieval.summary.topScore,
          topTier: retrieval.summary.topTier ?? null,
          topSourceType: retrieval.summary.topSourceType ?? null,
          matchCount: retrieval.matches.length,
        },
      })
    }

    // ----------------------------------------------------------------
    // 4.5) Tier A/B LLM shortcut — v4 改进 #1.
    //
    // If retrieval says the top match is a Tier A/B STATIC card AND the rule
    // layer did not escalate (no handoff, no official_only, no high risk),
    // return the card's standard_answer verbatim and skip renderFinalAnswer
    // entirely. This is the "use cheap resources (keyword index) to eliminate
    // uncertainty, save expensive resources (LLM) for real uncertainty" path.
    //
    // Safety: we ONLY take the shortcut when every safety gate also allows a
    // normal direct answer. Any rule escalation falls through to the LLM.
    // ----------------------------------------------------------------
    const shortcut = retrieval.summary.shortcut ?? 'none'
    const canShortcut =
      shortcut !== 'none' &&
      decision.answerMode === 'direct_answer' &&
      !decision.shouldEscalate &&
      decision.riskLevel !== 'high' &&
      topMatch != null

    const rendered = canShortcut
      ? {
          answer: topMatch!.standard_answer[detectedLanguage],
          source: 'tier_shortcut' as const,
          latencyMs: 0,
        }
      : await renderFinalAnswer({
          userMessage: message,
          language: detectedLanguage,
          mode: apiMode,
          riskLevel: decision.riskLevel,
          missingInfo: ai.missingInfo,
          retrieved: retrieval.matches.map((m) =>
            faqToRetrieved(m, detectedLanguage),
          ),
        })

    const tRender = Date.now()

    if (canShortcut) {
      pathTrace.layers.push('tier_shortcut')
      pathTrace.sourceClass = 'STATIC'
    } else {
      pathTrace.layers.push(`render:${rendered.source}`)
      if (rendered.source === 'openai') {
        pathTrace.llmCalled = true
      }
      if (decision.answerMode === 'handoff' || decision.shouldEscalate) {
        pathTrace.sourceClass = 'ESCALATION'
      } else if (knowledgeFound && !pathTrace.llmCalled) {
        pathTrace.sourceClass = 'STATIC'
      } else if (pathTrace.llmCalled) {
        pathTrace.sourceClass = 'AI_INFERRED'
      }
    }

    // ----------------------------------------------------------------
    // 5.5) Spec §4 — build and validate the labelled AnswerPayload.
    //
    // STATIC shortcut: a single FACT block sourced from the top FAQ card.
    // LLM path: one FACT block per retrieved card (provenance) + one
    //           INFERENCE block for the model-generated text.
    // ----------------------------------------------------------------
    let payload: AnswerPayload
    if (canShortcut && topMatch) {
      payload = {
        blocks: [staticFactBlock(rendered.answer, topMatch.id, 1)],
      }
    } else {
      const factBlocks = retrieval.matches.map((m) =>
        staticFactBlock(
          m.standard_answer[detectedLanguage],
          m.id,
          retrieval.summary.topScore ?? 0.5,
        ),
      )
      const blocks = [...factBlocks]
      // Only add the INFERENCE block if the render actually came from the LLM.
      // Pure templated / fallback renders are deterministic and don't warrant
      // an AI_INFERRED tag (they're STATIC fact from our own templates).
      if (pathTrace.llmCalled && rendered.answer) {
        blocks.push(
          aiInferredBlock(
            rendered.answer,
            retrieval.matches.map((m) => m.id),
            ai.confidence ?? 0.6,
          ),
        )
      } else if (blocks.length === 0) {
        // No retrieval, no LLM — templated/escalation text. Tag it as STATIC
        // so the payload still validates (empty payloads are blocked).
        blocks.push(staticFactBlock(rendered.answer, 'template', 0.5))
      }
      payload = { blocks }
    }
    const validatedPayload = validateAnswerPayload(payload)

    // ----------------------------------------------------------------
    // 6.pre) v7 — Output safety validation. Validates LLM output before
    //         it reaches the client or the audit log.
    // ----------------------------------------------------------------
    let outputValidated = false
    try {
      const validation = validateOutput(rendered.answer, 'render')
      if (!validation.ok) {
        ;(rendered as { answer: string }).answer = validation.sanitized
        pathTrace.layers.push(`output_sanitized:${validation.issues.length}issues`)
      }
      outputValidated = true
    } catch (e) {
      logError('output_validation_error', e)
    }

    // ----------------------------------------------------------------
    // 6) Persist + audit. Every request lands in user_queries.
    // ----------------------------------------------------------------
    const stored = insertUserQuery({
      timestamp: new Date().toISOString(),
      queryText: message.slice(0, 500),
      detectedLanguage,
      answerMode: decision.answerMode,
      riskLevel: decision.riskLevel,
      confidenceBand: decision.confidenceBand,
      shouldEscalate: decision.shouldEscalate,
      knowledgeFound,
      topFaqId: topMatch?.id ?? null,
      topFaqCategory: topMatch?.category ?? null,
      topScore: retrieval.summary.topScore,
      matchCount: retrieval.matches.length,
      selectedRuleKeys: decision.selectedRuleKeys,
      sessionId,
    })

    logRouterDecision(message, decision, sessionId, {
      detectedLanguage,
      topFaqId: topMatch?.id ?? null,
      topFaqCategory: topMatch?.category ?? null,
      topFaqSubtopic: topMatch?.subtopic ?? null,
      topScore: retrieval.summary.topScore,
      knowledgeFound,
      matchCount: retrieval.matches.length,
    })

    // Single audit-style line per request, structured (§11.1).
    devLogJson({
      event: 'router_audit',
      requestId,
      userQueryId: stored.id,
      timestamp: new Date().toISOString(),
      sessionId,
      // PII guard: only log full query when LOG_PII=true (§11.2).
      originalQuery: openaiEnv.LOG_PII ? message : message.slice(0, 200),
      understanding: {
        source: understanding.source,
        latencyMs: understanding.latencyMs,
        language: ai.language,
        intent: ai.intent,
        category: ai.category,
        subtopic: ai.subtopic,
        riskLevel: ai.riskLevel,
        shouldOfficialOnly: ai.shouldOfficialOnly,
        shouldHandoff: ai.shouldHandoff,
        searchQueries: ai.searchQueries,
        confidence: ai.confidence,
      },
      retrieval: {
        topFaqId: topMatch?.id ?? null,
        topScore: retrieval.summary.topScore,
        matchCount: retrieval.matches.length,
        matchedSourceIds: retrieval.matches.map((m) => m.id),
        topTier: retrieval.summary.topTier ?? null,
        topSourceType: retrieval.summary.topSourceType ?? null,
        shortcut,
        shortcutTaken: canShortcut,
      },
      rule: {
        answerMode: ruleDecision.answerMode,
        riskLevel: ruleDecision.riskLevel,
        selectedRuleKeys: ruleDecision.selectedRuleKeys,
      },
      reconciled: {
        answerMode: decision.answerMode,
        apiMode,
        riskLevel: decision.riskLevel,
        note: reconciled.note,
      },
      rendering: {
        source: rendered.source,
        latencyMs: rendered.latencyMs,
      },
      payload: {
        blocked: validatedPayload.blocked ?? false,
        block_reason: validatedPayload.block_reason ?? null,
        blockCount: validatedPayload.blocks.length,
        labels: validatedPayload.blocks.map((b) => b.label),
      },
      pathTrace,
      v7: {
        judgmentRuleId,
        judgmentAction,
        optimizerRoute: optimizerResult?.optimal ?? null,
        optimizerAvoidedHuman: optimizerResult?.avoidedHumanEscalation ?? null,
        optimizerCostSaving: optimizerResult?.costSavingVsBaseline ?? null,
        outputValidated,
      },
      openaiUsed,
      fallbackUsed,
      latencyMs: Date.now() - startedAt,
    })

    if (decision.answerMode === 'handoff' || decision.shouldEscalate) {
      const handoffRow = insertHandoff({
        userQueryId: stored.id,
        timestamp: new Date().toISOString(),
        queryText: message.slice(0, 500),
        detectedLanguage,
        answerMode: decision.answerMode,
        riskLevel: decision.riskLevel,
        reason: decision.decisionReason || 'Routed to handoff.',
        sessionId,
      })
      // Phase 3: auto-create a case so the /cases surface has a row to track.
      try {
        insertCase({
          queryText: message.slice(0, 1000),
          language: detectedLanguage,
          category: ai.category || null,
          subtopic: ai.subtopic || null,
          riskLevel: decision.riskLevel,
          assignee: null,
          dueDate: null,
          notes: decision.decisionReason || null,
          sourceUserQueryId: stored.id,
          sourceHandoffId: handoffRow.id,
          resolutionSummary: null,
        })
      } catch (e) {
        logError('case_autocreate_error', e)
      }
    }

    // ----------------------------------------------------------------
    // 6.5) V6 §P0-1 — Layer 7 writeback hook. Persist which layer
    //       answered so the layer-stats module can compute hit rates.
    // ----------------------------------------------------------------
    try {
      recordLayerHit(
        buildLayerHitEvent(pathTrace, {
          queryId: stored.id,
          cardId: topMatch?.id,
          sessionId,
        }),
      )
    } catch (e) {
      logError('writeback_hook_error', e)
    }

    // ----------------------------------------------------------------
    // 6.6) Patent PoC — record routing decision for 方案A data collection.
    //       Best-effort; never blocks the response path.
    // ----------------------------------------------------------------
    try {
      const confidenceBand = decision.confidenceBand
      const confNum = confidenceBand === 'high' ? 0.9 : confidenceBand === 'medium' ? 0.6 : 0.3
      recordRoutingDecision({
        queryId: stored.id,
        features: {
          fSemantic: retrieval.summary.topScore ?? null,
          fRisk: decision.riskLevel === 'high' ? 1.0 : decision.riskLevel === 'medium' ? 0.5 : 0.1,
          fLang: 0, // Populated when f_lang I/O is wired to user sessions
          fTemporal: pathTrace.sourceClass === 'REALTIME',
        },
        routeTaken: pathTrace.sourceClass,
        costEstimate: understanding.source === 'openai' ? 0.01 : 0,
        confidenceScore: confNum,
        layer6Triggered: decision.shouldEscalate || decision.answerMode === 'handoff',
      })
    } catch (e) {
      logError('patent_metric_error', e)
    }

    // ----------------------------------------------------------------
    // 6.8) v8 — Evidence Chain Logger. Immutable audit record per query.
    //       Best-effort; never blocks the response path.
    // ----------------------------------------------------------------
    try {
      const ecRecord = createEvidenceRecord({
        module: 'routing',
        queryId: stored.id,
        sessionId: sessionId ?? requestId,
        input: {
          queryText: message,
          userLanguage: detectedLanguage,
          scenarioTag: ai.category || null,
        },
        routeTaken: pathTrace.sourceClass,
        decisionReasonCode: decision.decisionReason || 'UNKNOWN',
        decisionReasonDetails: {
          answerMode: decision.answerMode,
          riskLevel: decision.riskLevel,
          selectedRuleKeys: decision.selectedRuleKeys,
          reconcileNote: reconciled.note,
          queryQualityScore: qualityScore.score,
          queryQualityElements: qualityScore.elementsPresent,
        },
        evidenceUsed: retrieval.matches.map((m) => m.id),
        triggerScore: retrieval.summary.topScore ?? null,
        optimizerRoute: optimizerResult?.optimal ?? null,
        judgmentRuleId,
        answerType: pathTrace.sourceClass === 'STATIC' ? 'L1' : pathTrace.sourceClass === 'ESCALATION' ? 'L6' : 'L3',
        timeToFirstActionMs: Date.now() - startedAt,
      })
      logEvidenceRecord(ecRecord)
    } catch (e) {
      logError('evidence_chain_logger_error', e)
    }

    // ----------------------------------------------------------------
    // 6.9) Answer reliability classification (TASK 4-7).
    //       Derives answer_type, verification, evidence, escalation.
    // ----------------------------------------------------------------
    const answerMeta = classifyAnswer({
      decision,
      retrieval: retrieval.summary,
      llmCalled: pathTrace.llmCalled,
      shortcutTaken: canShortcut,
    })
    const metaValidation = validateAnswerMeta(answerMeta)
    const finalAnswerMeta = metaValidation.valid ? answerMeta : metaValidation.corrected!

    // False-claims check on LLM-generated text
    const falseClaims = detectFalseClaims(rendered.answer, finalAnswerMeta)
    if (falseClaims.hasCertaintyLanguage) {
      devLogJson({
        event: 'false_claims_warning',
        requestId,
        answer_type: finalAnswerMeta.answer_type,
        matchedPatterns: falseClaims.matchedPatterns,
      })
    }

    // Answer quality validation (TASK 14)
    const qualityCheck = validateAnswerQuality(rendered.answer, finalAnswerMeta, detectedLanguage)

    // Emit structured answer audit record (TASK 12)
    try {
      emitAnswerAudit(buildAnswerAuditRecord({
        requestId,
        sessionId,
        tier: canShortcut ? (shortcut === 'tier_a_shortcut' ? 'A' : 'B') : (decision.shouldEscalate ? 'L6' : 'C'),
        answerMeta: finalAnswerMeta,
        falseClaims,
        qualityIssues: qualityCheck.issues,
        latencyMs: Date.now() - startedAt,
      }))
    } catch (e) {
      logError('answer_audit_error', e)
    }

    // ----------------------------------------------------------------
    // 7) Response. New top-level fields match design doc §5.2; legacy
    //    fields (`decision`, `knowledge`, `aiAnswer`) are kept so the
    //    existing frontend keeps rendering without a redeploy.
    // ----------------------------------------------------------------
    const knowledge = retrieval.matches.map((m) => ({
      id: m.id,
      category: m.category,
      title: m.representative_title,
      answer: m.standard_answer,
      next_step_confirm: m.next_step_confirm,
      next_step_prepare: m.next_step_prepare,
      next_step_contact: m.next_step_contact,
      next_step_warning: m.next_step_warning ?? null,
      risk_level: m.risk_level,
    }))

    return ok({
      // ── §5.2 spec shape ──────────────────────────────────────────
      language: detectedLanguage,
      answer: rendered.answer,
      mode: apiMode,
      category: ai.category,
      subtopic: ai.subtopic,
      riskLevel: decision.riskLevel,
      missingInfo: ai.missingInfo,
      sources: retrieval.matches.map((m) => ({
        id: m.id,
        title: m.representative_title[detectedLanguage],
        type: 'faq' as const,
      })),
      handoff: decision.answerMode === 'handoff' || decision.shouldEscalate,
      officialOnly: decision.answerMode === 'official_only',
      // Spec §4 — labelled, validated output payload. Clients that understand
      // the contract should render from `payload.blocks` directly; the
      // legacy `answer` string is still returned for back-compat.
      payload: validatedPayload,
      // TASK 4-7 — answer reliability metadata
      answerMeta: finalAnswerMeta,
      // Spec §12 — minimal path trace per query.
      pathTrace,
      debug: {
        requestId,
        understandingSource: understanding.source,
        renderingSource: rendered.source,
        // v4 改进 #1 / #6: expose the tier-shortcut decision so the /review
        // dashboard and tests can verify "Tier A answered, LLM skipped".
        shortcut,
        shortcutTaken: canShortcut,
        topTier: retrieval.summary.topTier ?? null,
        topSourceType: retrieval.summary.topSourceType ?? null,
        payloadBlocked: validatedPayload.blocked ?? false,
        payloadBlockReason: validatedPayload.block_reason ?? null,
        latency: {
          understandMs: tUnderstand - startedAt,
          retrieveMs: tRetrieve - tUnderstand,
          decideMs: tDecide - tRetrieve,
          renderMs: tRender - tDecide,
          totalMs: tRender - startedAt,
        },
      },
      // ── Backwards-compat fields used by current page.tsx ─────────
      decision,
      knowledge,
      detectedLanguage,
      aiAnswer: {
        answer: rendered.answer,
        nextStepConfirm: '',
        nextStepPrepare: '',
        nextStepContact: '',
        warning: null,
      },
      understanding: {
        source: understanding.source,
        intent: ai.intent,
        category: ai.category,
        subtopic: ai.subtopic ?? '',
        missingInfo: ai.missingInfo,
      },
      // ── v9 — Question quality feedback ─────────────────────
      questionQuality: {
        score: qualityScore.score,
        elementsPresent: qualityScore.elementsPresent,
        suggestion: qualityScore.suggestion,
        badType: qualityScore.badType,
      },
    })
  } catch (error) {
    logError('router_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}
