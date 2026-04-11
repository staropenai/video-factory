/**
 * Post-decision guardrails.
 *
 * Hard boundary: low confidence + direct_answer is NEVER allowed.
 * This is the last safety check before a decision is returned.
 *
 * This module complements `@/lib/guardrails/policy.ts` which handles
 * the broader policy evaluation. This module specifically validates
 * RouterDecision objects from the TS rule engine.
 */

import type { RouterDecision } from '@/lib/router/types'

export function validateDecision(decision: RouterDecision): RouterDecision {
  // Hard guardrail: low confidence must not produce direct_answer
  if (decision.confidenceBand === 'low' && decision.answerMode === 'direct_answer') {
    return {
      ...decision,
      answerMode: 'clarify',
      decisionReason: `${decision.decisionReason} | Guardrail: downgraded direct answer under low confidence.`,
      traceTags: [...decision.traceTags, 'guardrail:low_confidence_no_direct_answer'],
    }
  }

  // Hard guardrail: high risk should escalate
  if (decision.riskLevel === 'high' && !decision.shouldEscalate) {
    return {
      ...decision,
      shouldEscalate: true,
      decisionReason: `${decision.decisionReason} | Guardrail: high risk must escalate.`,
      traceTags: [...decision.traceTags, 'guardrail:high_risk_must_escalate'],
    }
  }

  return decision
}
