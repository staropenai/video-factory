/**
 * POST /api/router/stream — SSE streaming variant of /api/router.
 *
 * V12 Latency Sprint — Fix 1: SSE Streaming Endpoint.
 *
 * BEHAVIOR:
 *   Tier A/B shortcut → returns plain JSON immediately (already fast, no streaming needed)
 *   Tier C (LLM)      → returns SSE stream: thinking → token* → done
 *   Error / escalation → returns plain JSON with appropriate status
 *
 * SSE EVENT FORMAT:
 *   data: {"type":"thinking"}\n\n
 *   data: {"type":"token","text":"..."}\n\n
 *   data: {"type":"done","tier":"C","sources":[...]}\n\n
 *   data: {"type":"error","message":"..."}\n\n
 *
 * CONSTRAINT: V11 routing logic is UNCHANGED. Only the output layer differs.
 */

import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { ok, fail } from "@/lib/utils/api-response";

import { runUnderstanding } from "@/lib/ai/understand";
import {
  getCachedUnderstanding,
  setCachedUnderstanding,
} from "@/lib/ai/understanding-cache";
import { faqToRetrieved } from "@/lib/ai/generate";
import { streamRenderAnswer } from "@/lib/ai/generate-stream";
import {
  retrieveFromLocal,
  retrieveFromLocalMulti,
} from "@/lib/knowledge/retrieve";
import { decideRoute } from "@/lib/router/decide";
import { validateDecision } from "@/lib/validation/guardrails";
import { logRouterDecision, logError } from "@/lib/audit/logger";
import { insertUserQuery, insertHandoff, insertEvent } from "@/lib/db/tables";
import { checkPromptInjection, sanitizeForLog } from "@/lib/security/prompt-injection";
import {
  buildSecurityEvent,
  classifySecuritySeverity,
  logSecurityEvent,
} from "@/lib/security/event-log";
import { resolveIdentity } from "@/lib/auth/identity";
import { devLogJson } from "@/lib/utils/dev-log";
import {
  validateMessageLength,
  enforceQuota,
  enforceRateLimit,
} from "@/app/api/router/quota-gate";
import { extractClientIp } from "@/lib/security/rate-limit";
import { recordRouterLatency, recordTTFT, recordTierHit } from "@/lib/monitoring/ttft";
import { createEvidenceRecord, logEvidenceRecord } from "@/lib/patent/evidence-chain-logger";
import { captureError } from "@/lib/monitoring/sentry";

import type { AnswerMode as RuleAnswerMode, RiskLevel } from "@/lib/router/types";
import type {
  AnswerMode as ApiAnswerMode,
  AIUnderstandingResult,
  Language,
} from "@/lib/ai/types";

function ruleModeToApiMode(rm: RuleAnswerMode): ApiAnswerMode {
  if (rm === "direct_answer") return "normal";
  return rm;
}

function detectLanguageFallback(text: string): Language {
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja";
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh";
  return "en";
}

function reconcileDecision(
  ruleAnswerMode: RuleAnswerMode,
  ruleRisk: RiskLevel,
  ai: AIUnderstandingResult
): { answerMode: RuleAnswerMode; riskLevel: RiskLevel; note: string } {
  let answerMode = ruleAnswerMode;
  let riskLevel = ruleRisk;
  const notes: string[] = [];

  const rank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
  if (rank[ai.riskLevel] > rank[riskLevel]) {
    riskLevel = ai.riskLevel;
    notes.push(`ai_raised_risk:${ai.riskLevel}`);
  }

  if (ai.shouldHandoff && answerMode !== "handoff") {
    answerMode = "handoff";
    notes.push("ai_forced_handoff");
  } else if (
    ai.shouldOfficialOnly &&
    answerMode !== "handoff" &&
    answerMode !== "official_only"
  ) {
    answerMode = "official_only";
    notes.push("ai_forced_official_only");
  }

  return { answerMode, riskLevel, note: notes.join(",") };
}

/** Encode an SSE data frame. */
function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const requestId = randomUUID();

  // V5 T4: Read idempotency key from header (frontend generates UUID per new query)
  const idempotencyKey =
    req.headers.get("x-idempotency-key") ?? undefined;

  try {
    const body = await req.json();
    const message = String(body.message ?? body.queryText ?? "").trim();
    const sessionId = (body.sessionId as string | undefined) ?? undefined;
    const taskState = body.taskState ?? {};
    const clarificationRounds = Number(body.clarificationRounds || 0);

    if (!message) {
      return fail("message is required");
    }

    // Rate limit
    const ipRateCheck = enforceRateLimit(extractClientIp(req.headers));
    if (!ipRateCheck.ok) return ipRateCheck.response;

    // Message length guard
    const lengthCheck = validateMessageLength(message, requestId);
    if (!lengthCheck.ok) return lengthCheck.response;

    // Prompt injection detection
    const injectionCheck = checkPromptInjection(message);
    if (injectionCheck.detected && injectionCheck.highestSeverity === "high") {
      const secClass = classifySecuritySeverity(injectionCheck.highestSeverity);
      logSecurityEvent(
        buildSecurityEvent({
          eventType: secClass.eventType,
          severity: secClass.severity,
          route: "/api/router/stream",
          inputPreview: sanitizeForLog(message, 200),
          matchedPatternIds: injectionCheck.matchedPatterns.map((p) => p.id),
          description: `Prompt injection blocked: ${injectionCheck.matchedPatterns.map((p) => p.description).join("; ")}`,
          blocked: true,
        })
      );
      return fail("Your input could not be processed. Please rephrase your question.");
    }

    // Persist query event
    insertEvent({
      eventType: "QUERY_RECEIVED",
      route: "/api/router/stream",
      relatedIds: { sessionId },
      metadata: { requestId, messageLength: message.length, languageGuess: detectLanguageFallback(message) },
    });

    // Quota enforcement
    const identity = await resolveIdentity();
    const detectedLanguageEarly = detectLanguageFallback(message);
    const sessionToken = body?.sessionToken as string | undefined;

    const quotaGate = await enforceQuota(sessionToken, identity, detectedLanguageEarly, requestId, idempotencyKey);
    if (!quotaGate.ok) return quotaGate.response;

    // ── Fast-path: Tier A/B shortcut WITHOUT calling LLM ──────────────
    // retrieveFromLocal is synchronous keyword matching (~1ms). If it
    // produces a shortcut-eligible result AND the rule engine confirms
    // direct_answer + low-risk, we can skip the $0.02 understanding call
    // entirely and return in <50ms.
    const baselineRetrieval = retrieveFromLocal(message);

    if (baselineRetrieval.summary.shortcut !== "none") {
      const fastRuleRaw = decideRoute({
        queryText: message,
        normalizedQuery: message.toLowerCase(),
        taskState,
        retrieval: baselineRetrieval.summary,
        clarificationRounds,
      });
      const fastRule = validateDecision(fastRuleRaw);
      const fastTop = baselineRetrieval.matches[0] ?? null;

      const canFastShortcut =
        fastRule.answerMode === "direct_answer" &&
        !fastRule.shouldEscalate &&
        fastRule.riskLevel !== "high" &&
        fastTop != null;

      if (canFastShortcut) {
        const fastLang = detectLanguageFallback(message);
        const answer = fastTop!.standard_answer[fastLang];
        const tier = baselineRetrieval.summary.shortcut === "tier_a_shortcut" ? "A" : "B";
        const sources = baselineRetrieval.matches.map((m) => ({
          id: m.id,
          title: m.representative_title[fastLang],
          type: "faq" as const,
        }));

        // Non-blocking audit (same pattern as existing shortcut path)
        queueMicrotask(() => {
          try {
            const stored = insertUserQuery({
              timestamp: new Date().toISOString(),
              queryText: message.slice(0, 500),
              detectedLanguage: fastLang,
              answerMode: fastRule.answerMode,
              riskLevel: fastRule.riskLevel,
              confidenceBand: fastRule.confidenceBand,
              shouldEscalate: false,
              knowledgeFound: true,
              topFaqId: fastTop?.id ?? null,
              topFaqCategory: fastTop?.category ?? null,
              topScore: baselineRetrieval.summary.topScore,
              matchCount: baselineRetrieval.matches.length,
              selectedRuleKeys: fastRule.selectedRuleKeys,
              sessionId,
            });
            logRouterDecision(message, fastRule, sessionId, {
              detectedLanguage: fastLang,
              topFaqId: fastTop?.id ?? null,
              topFaqCategory: fastTop?.category ?? null,
              topFaqSubtopic: fastTop?.subtopic ?? null,
              topScore: baselineRetrieval.summary.topScore,
              knowledgeFound: true,
              matchCount: baselineRetrieval.matches.length,
            });
            devLogJson({
              event: "router_stream_audit",
              requestId,
              userQueryId: stored.id,
              tier: `fast_${tier}`,
              fastPath: true,
              latencyMs: Date.now() - startedAt,
            });
          } catch (e) {
            logError("fast_path_audit_error", e);
          }
        });

        const fastLatency = Date.now() - startedAt;
        recordRouterLatency(fastLatency, tier, { fastPath: true, language: fastLang });
        recordTierHit(tier);

        // V5 T2: Evidence record with ttft_ms and kb_hit (non-blocking)
        queueMicrotask(() => {
          try {
            const ecRecord = createEvidenceRecord({
              module: "routing",
              queryId: requestId,
              sessionId: sessionId ?? requestId,
              input: { queryText: message.slice(0, 500), userLanguage: fastLang, scenarioTag: null },
              routeTaken: tier === "A" ? "L1_STATIC" : "L1_STATIC",
              decisionReasonCode: "L1_SEMANTIC_HIT",
              decisionReasonDetails: {
                shortcut: baselineRetrieval.summary.shortcut,
                topScore: baselineRetrieval.summary.topScore,
                fastPath: true,
              },
              evidenceUsed: baselineRetrieval.matches.map((m) => m.id),
              triggerScore: baselineRetrieval.summary.topScore,
              answerType: "L1",
              timeToFirstActionMs: fastLatency,
            });
            // V5 T1/T2 + V6: Attach patent evidence fields
            ecRecord.ttft_ms = fastLatency;
            ecRecord.kb_hit = true;
            ecRecord.tier = tier;
            ecRecord.llm_called = false; // V6: KB hit → no LLM call (patent evidence)
            ecRecord.confidence_score = baselineRetrieval.summary.topScore;
            // V6: matched keyword for Tier A traceability
            if (tier === "A" && fastTop) {
              ecRecord.matched_keyword = fastTop.subtopic ?? fastTop.id;
            }
            const written = logEvidenceRecord(ecRecord);
            if (!written) {
              // ω5: evidence write failure must not silently pass
              captureError(new Error("evidence_write_failed_fast_path"), {
                tags: { requestId, tier, source: "fast_path" },
              });
            }
          } catch (e) {
            // ω5: evidence write failure must be reported
            captureError(e, { tags: { source: "fast_path_evidence" } });
            logError("fast_path_evidence_error", e);
          }
        });

        return ok({
          content: answer,
          tier,
          kb_hit: true,
          source: "knowledge_base",
          language: fastLang,
          mode: "normal" as ApiAnswerMode,
          sources,
          debug: { requestId, latencyMs: fastLatency, fastPath: true },
        });
      }
    }

    // ── Understanding ──────────────────────────────────────────────────
    const cachedUnderstanding = getCachedUnderstanding(message);
    let understandingCached = false;

    let understanding: Awaited<ReturnType<typeof runUnderstanding>>;
    if (cachedUnderstanding) {
      understanding = cachedUnderstanding;
      understandingCached = true;
    } else {
      understanding = await runUnderstanding(message);
      setCachedUnderstanding(message, understanding);
    }

    const ai = understanding.understanding;
    const detectedLanguage: Language = ai.language || detectLanguageFallback(message);

    // ── Retrieval ──────────────────────────────────────────────────────
    const retrieval =
      ai.searchQueries.length > 0
        ? retrieveFromLocalMulti(message, ai.searchQueries)
        : baselineRetrieval;

    // ── Rule engine ────────────────────────────────────────────────────
    const rawDecision = decideRoute({
      queryText: message,
      normalizedQuery: message.toLowerCase(),
      taskState,
      retrieval: retrieval.summary,
      clarificationRounds,
    });
    const ruleDecision = validateDecision(rawDecision);

    // ── Reconcile ──────────────────────────────────────────────────────
    const reconciled = reconcileDecision(ruleDecision.answerMode, ruleDecision.riskLevel, ai);
    const decision = {
      ...ruleDecision,
      answerMode: reconciled.answerMode,
      riskLevel: reconciled.riskLevel,
      shouldEscalate: ruleDecision.shouldEscalate || reconciled.answerMode === "handoff",
      decisionReason: [ruleDecision.decisionReason, reconciled.note].filter(Boolean).join(" | "),
    };

    const apiMode: ApiAnswerMode = ruleModeToApiMode(decision.answerMode);
    const topMatch = retrieval.matches[0] ?? null;
    const knowledgeFound = retrieval.matches.length > 0;
    const shortcut = retrieval.summary.shortcut ?? "none";
    const canShortcut =
      shortcut !== "none" &&
      decision.answerMode === "direct_answer" &&
      !decision.shouldEscalate &&
      decision.riskLevel !== "high" &&
      topMatch != null;

    const sources = retrieval.matches.map((m) => ({
      id: m.id,
      title: m.representative_title[detectedLanguage],
      type: "faq" as const,
    }));

    // ── Tier A/B: fast JSON path (no streaming needed) ─────────────────
    if (canShortcut) {
      const answer = topMatch!.standard_answer[detectedLanguage];

      // Audit (non-blocking — V12 Fix 3)
      queueMicrotask(() => {
        try {
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
          });
          logRouterDecision(message, decision, sessionId, {
            detectedLanguage,
            topFaqId: topMatch?.id ?? null,
            topFaqCategory: topMatch?.category ?? null,
            topFaqSubtopic: topMatch?.subtopic ?? null,
            topScore: retrieval.summary.topScore,
            knowledgeFound,
            matchCount: retrieval.matches.length,
          });
          devLogJson({
            event: "router_stream_audit",
            requestId,
            userQueryId: stored.id,
            tier: "shortcut",
            latencyMs: Date.now() - startedAt,
          });
        } catch (e) {
          logError("stream_audit_error", e);
        }
      });

      return ok({
        content: answer,
        tier: shortcut === "tier_a_shortcut" ? "A" : "B",
        source: "knowledge_base",
        language: detectedLanguage,
        mode: apiMode,
        sources,
        debug: { requestId, latencyMs: Date.now() - startedAt },
      });
    }

    // ── Handoff / escalation: return JSON (no LLM call) ───────────────
    if (decision.answerMode === "handoff" || decision.shouldEscalate) {
      queueMicrotask(() => {
        try {
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
          });
          insertHandoff({
            userQueryId: stored.id,
            timestamp: new Date().toISOString(),
            queryText: message.slice(0, 500),
            detectedLanguage,
            answerMode: decision.answerMode,
            riskLevel: decision.riskLevel,
            reason: decision.decisionReason || "Routed to handoff.",
            sessionId,
          });
        } catch (e) {
          logError("stream_handoff_audit_error", e);
        }
      });

      return ok({
        content: null,
        tier: "L6",
        reason: decision.decisionReason || "ESCALATION",
        language: detectedLanguage,
        mode: apiMode,
        handoff: true,
        sources,
        debug: { requestId, latencyMs: Date.now() - startedAt },
      });
    }

    // ── Tier C: SSE stream ────────────────────────────────────────────
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        // Signal thinking immediately
        controller.enqueue(encoder.encode(sseEvent({ type: "thinking" })));

        let fullContent = "";
        let firstTokenEmitted = false;
        try {
          const tokenStream = streamRenderAnswer({
            userMessage: message,
            language: detectedLanguage,
            mode: apiMode,
            riskLevel: decision.riskLevel,
            missingInfo: ai.missingInfo,
            retrieved: retrieval.matches.map((m) => faqToRetrieved(m, detectedLanguage)),
          });

          for await (const token of tokenStream) {
            if (!firstTokenEmitted) {
              firstTokenEmitted = true;
              recordTTFT(Date.now() - startedAt);
            }
            fullContent += token;
            controller.enqueue(encoder.encode(sseEvent({ type: "token", text: token })));
          }

          // Done event with metadata
          const tierCLatency = Date.now() - startedAt;
          recordRouterLatency(tierCLatency, "C", { language: detectedLanguage });
          recordTierHit("C");
          controller.enqueue(
            encoder.encode(
              sseEvent({
                type: "done",
                tier: "C",
                language: detectedLanguage,
                mode: apiMode,
                sources,
                debug: { requestId, latencyMs: tierCLatency },
              })
            )
          );
        } catch (error) {
          logError("stream_render_error", error);
          controller.enqueue(
            encoder.encode(
              sseEvent({
                type: "error",
                message: "Service temporarily unavailable",
              })
            )
          );
        }

        // Ensure controller is always closed, even if audit writes throw unexpectedly
        try {
          // Audit write (non-blocking — V12 Fix 3)
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
          });
          logRouterDecision(message, decision, sessionId, {
            detectedLanguage,
            topFaqId: topMatch?.id ?? null,
            topFaqCategory: topMatch?.category ?? null,
            topFaqSubtopic: topMatch?.subtopic ?? null,
            topScore: retrieval.summary.topScore,
            knowledgeFound,
            matchCount: retrieval.matches.length,
          });
          devLogJson({
            event: "router_stream_audit",
            requestId,
            userQueryId: stored.id,
            tier: "C",
            streamed: true,
            contentLength: fullContent.length,
            latencyMs: Date.now() - startedAt,
          });

          // V5 T2: Evidence record for Tier C with ttft_ms
          const tierCTotalMs = Date.now() - startedAt;
          try {
            const ecRecord = createEvidenceRecord({
              module: "routing",
              queryId: requestId,
              sessionId: sessionId ?? requestId,
              input: { queryText: message.slice(0, 500), userLanguage: detectedLanguage, scenarioTag: null },
              routeTaken: "L3_AI",
              decisionReasonCode: "L3_AI_INFERRED",
              decisionReasonDetails: {
                answerMode: decision.answerMode,
                riskLevel: decision.riskLevel,
                confidenceBand: decision.confidenceBand,
                topScore: retrieval.summary.topScore,
              },
              evidenceUsed: retrieval.matches.map((m) => m.id),
              triggerScore: retrieval.summary.topScore,
              answerType: "L3",
              timeToFirstActionMs: tierCTotalMs,
            });
            ecRecord.ttft_ms = tierCTotalMs;
            ecRecord.kb_hit = false;
            ecRecord.tier = "C";
            ecRecord.llm_called = true; // V6: Tier C always calls LLM (patent evidence)
            ecRecord.confidence_score = retrieval.summary.topScore;
            const written = logEvidenceRecord(ecRecord);
            if (!written) {
              captureError(new Error("evidence_write_failed_tier_c"), {
                tags: { requestId, source: "tier_c" },
              });
            }
          } catch (ecErr) {
            captureError(ecErr, { tags: { source: "tier_c_evidence" } });
            logError("tier_c_evidence_error", ecErr);
          }
        } catch (e) {
          logError("stream_audit_error", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    logError("router_stream_error", error);
    return fail(error instanceof Error ? error.message : "Internal error", 500);
  }
}
