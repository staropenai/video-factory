/**
 * AI Guardrail Policy — V1.4 Low-Confidence and Escalation Rules
 *
 * This module codifies the decision policy for when the system should:
 * - answer directly
 * - answer with disclaimer
 * - ask for clarification
 * - block free-form generation
 * - escalate to human
 *
 * The LLM is NEVER the fact layer. It may only:
 * - clarify, rewrite, normalize, or format language
 * - summarize retrieved knowledge
 * - unify multilingual responses
 *
 * The LLM may NOT:
 * - fabricate property facts
 * - make legal judgments
 * - make price commitments
 * - speak with false certainty
 */

import type {
  AnswerMode,
  ConfidenceBand,
  RiskLevel,
  QueryType,
  EscalationPolicy,
} from "@/lib/types";

export interface PolicyContext {
  queryType: QueryType;
  riskLevel: RiskLevel;
  retrievalCount: number;
  sourceCount: number;
  sourceConflict: boolean;
  sourceStale: boolean;
  hasDynamicDependency: boolean;
  dynamicRefreshAvailable: boolean;
  matchedFAQCount: number;
  matchedRuleCount: number;
  missingInputs: string[];
}

export interface PolicyDecision {
  confidenceBand: ConfidenceBand;
  answerMode: AnswerMode;
  shouldEscalate: boolean;
  escalationPolicy: EscalationPolicy;
  reasons: string[];
  blockedFromDirectAnswer: boolean;
}

/**
 * Low-confidence triggers — V1.4 Section 11.1
 * Any ONE match = low confidence
 */
const LOW_CONFIDENCE_CHECKS: Array<{
  name: string;
  check: (ctx: PolicyContext) => boolean;
  answerMode: AnswerMode;
  shouldEscalate: boolean;
}> = [
  {
    name: "retrieval_count_low",
    check: (ctx) => ctx.retrievalCount < 2,
    answerMode: "clarify",
    shouldEscalate: false,
  },
  {
    name: "source_count_low",
    check: (ctx) => ctx.sourceCount < 2,
    answerMode: "official_only",
    shouldEscalate: false,
  },
  {
    name: "source_conflict",
    check: (ctx) => ctx.sourceConflict,
    answerMode: "clarify",
    shouldEscalate: true,
  },
  {
    name: "source_stale",
    check: (ctx) => ctx.sourceStale,
    answerMode: "official_only",
    shouldEscalate: false,
  },
  {
    name: "dynamic_data_no_refresh",
    check: (ctx) => ctx.hasDynamicDependency && !ctx.dynamicRefreshAvailable,
    answerMode: "handoff",
    shouldEscalate: true,
  },
  {
    name: "high_risk_case_specific",
    check: (ctx) =>
      ctx.riskLevel === "high" && ctx.queryType === "case_specific",
    answerMode: "handoff",
    shouldEscalate: true,
  },
];

/**
 * Evaluate the full policy for a given context.
 * Returns a structured decision — never a vague recommendation.
 */
export function evaluatePolicy(ctx: PolicyContext): PolicyDecision {
  const reasons: string[] = [];
  let shouldEscalate = false;

  // Out of scope — always direct, no escalation
  if (ctx.queryType === "out_of_scope") {
    return {
      confidenceBand: "high",
      answerMode: "direct",
      shouldEscalate: false,
      escalationPolicy: "auto_answer",
      reasons: ["Query outside supported domain — polite redirect"],
      blockedFromDirectAnswer: false,
    };
  }

  // Check low-confidence triggers
  const triggered = LOW_CONFIDENCE_CHECKS.filter((c) => c.check(ctx));

  if (triggered.length > 0) {
    for (const t of triggered) {
      reasons.push(`Low confidence: ${t.name}`);
      if (t.shouldEscalate) shouldEscalate = true;
    }

    // Most restrictive answer mode wins
    const MODE_PRIORITY: Record<AnswerMode, number> = {
      handoff: 0,
      official_only: 1,
      clarify: 2,
      direct: 3,
    };
    const bestMode = triggered.reduce((best, t) =>
      MODE_PRIORITY[t.answerMode] < MODE_PRIORITY[best.answerMode] ? t : best
    );

    return {
      confidenceBand: "low",
      answerMode: bestMode.answerMode,
      shouldEscalate,
      escalationPolicy: shouldEscalate ? "require_expert" : "suggest_expert",
      reasons,
      blockedFromDirectAnswer: true,
    };
  }

  // Missing inputs — clarify
  if (ctx.missingInputs.length > 0) {
    return {
      confidenceBand: "medium",
      answerMode: "clarify",
      shouldEscalate: false,
      escalationPolicy: "auto_answer",
      reasons: [`Missing inputs: ${ctx.missingInputs.join(", ")}`],
      blockedFromDirectAnswer: false,
    };
  }

  // High confidence path
  const confidenceBand: ConfidenceBand =
    ctx.sourceCount >= 2 && ctx.retrievalCount >= 2 ? "high" : "medium";

  const escalationPolicy: EscalationPolicy =
    ctx.riskLevel === "high"
      ? "answer_with_disclaimer"
      : ctx.riskLevel === "medium"
        ? "answer_with_disclaimer"
        : "auto_answer";

  return {
    confidenceBand,
    answerMode: "direct",
    shouldEscalate: false,
    escalationPolicy,
    reasons:
      ctx.matchedRuleCount > 0
        ? ["Rule-governed answer"]
        : ctx.matchedFAQCount > 0
          ? ["FAQ match with verified sources"]
          : ["General knowledge match"],
    blockedFromDirectAnswer: false,
  };
}
