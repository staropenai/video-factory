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

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'

import { runUnderstanding } from '@/lib/ai/understand'
import { renderFinalAnswer, faqToRetrieved } from '@/lib/ai/generate'
import { retrieveFromLocal, retrieveFromLocalMulti } from '@/lib/knowledge/retrieve'
import { decideRoute } from '@/lib/router/decide'
import { validateDecision } from '@/lib/validation/guardrails'
import { logRouterDecision, logError } from '@/lib/audit/logger'
import { insertUserQuery, insertHandoff } from '@/lib/db/tables'
import { env as openaiEnv } from '@/lib/ai/openai'

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
      return NextResponse.json(
        { error: 'message is required', debug: { requestId } },
        { status: 400 },
      )
    }

    // ----------------------------------------------------------------
    // 1) AI understanding (OpenAI Responses API). Falls back on failure.
    // ----------------------------------------------------------------
    const understanding = await runUnderstanding(message)
    const ai = understanding.understanding
    const detectedLanguage: Language = ai.language || detectLanguageFallback(message)
    const openaiUsed = understanding.source === 'openai'
    const fallbackUsed = understanding.source === 'fallback'

    // ----------------------------------------------------------------
    // 2) Retrieval — multi-query when AI gave us rewrites, else original.
    // ----------------------------------------------------------------
    const retrieval =
      ai.searchQueries.length > 0
        ? retrieveFromLocalMulti(message, ai.searchQueries)
        : retrieveFromLocal(message)

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

    const apiMode: ApiAnswerMode = ruleModeToApiMode(decision.answerMode)
    const topMatch = retrieval.matches[0] ?? null
    const knowledgeFound = retrieval.matches.length > 0

    // ----------------------------------------------------------------
    // 5) Render — OpenAI Responses API, plain text in the user's language.
    // ----------------------------------------------------------------
    const rendered = await renderFinalAnswer({
      userMessage: message,
      language: detectedLanguage,
      mode: apiMode,
      riskLevel: decision.riskLevel,
      missingInfo: ai.missingInfo,
      retrieved: retrieval.matches.map((m) => faqToRetrieved(m, detectedLanguage)),
    })

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
    console.log(
      JSON.stringify({
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
        openaiUsed,
        fallbackUsed,
        latencyMs: Date.now() - startedAt,
      }),
    )

    if (decision.answerMode === 'handoff' || decision.shouldEscalate) {
      insertHandoff({
        userQueryId: stored.id,
        timestamp: new Date().toISOString(),
        queryText: message.slice(0, 500),
        detectedLanguage,
        answerMode: decision.answerMode,
        riskLevel: decision.riskLevel,
        reason: decision.decisionReason || 'Routed to handoff.',
        sessionId,
      })
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

    return NextResponse.json({
      // ── §5.2 spec shape ──────────────────────────────────────────
      ok: true,
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
      debug: {
        requestId,
        understandingSource: understanding.source,
        renderingSource: rendered.source,
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
    })
  } catch (error) {
    logError('router_error', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal error',
        debug: { requestId },
      },
      { status: 500 },
    )
  }
}
