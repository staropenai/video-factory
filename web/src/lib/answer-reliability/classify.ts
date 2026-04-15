/**
 * Answer Reliability — Classifier (TASK 4)
 *
 * Derives AnswerMeta from the existing pipeline outputs:
 *   RouterDecision + RetrievalSummary + pathTrace → AnswerMeta
 *
 * Classification logic:
 *   - Tier A/B shortcut with direct_answer → rule_based
 *   - High topScore + knowledge found + no LLM → retrieved_grounded
 *   - LLM called + knowledge found (hybrid) → inference_only (verified if topScore ≥ 0.7)
 *   - LLM called + no knowledge → unverified
 *   - shouldEscalate or handoff → human_review_required
 */

import type { RouterDecision, RetrievalSummary } from '@/lib/router/types'
import type { AnswerMeta, AnswerType } from './types'

/** Minimum retrieval score to consider answer "grounded" */
const GROUNDED_THRESHOLD = 0.7

/** Minimum retrieval score for inference to be considered "verified" */
const VERIFIED_INFERENCE_THRESHOLD = 0.7

/** Minimum source count for verification */
const MIN_VERIFIED_SOURCES = 1

export interface ClassifyInput {
  decision: RouterDecision
  retrieval: RetrievalSummary
  llmCalled: boolean
  shortcutTaken: boolean
}

export function classifyAnswer(input: ClassifyInput): AnswerMeta {
  const { decision, retrieval, llmCalled, shortcutTaken } = input
  const now = new Date().toISOString()

  // 1. Escalation / handoff → human_review_required
  if (decision.shouldEscalate || decision.answerMode === 'handoff') {
    return buildMeta({
      answer_type: 'human_review_required',
      verified: false,
      verification_notes: `Escalated: ${decision.decisionReason}`,
      source_count: retrieval.sourceCount,
      needs_human_review: true,
      rule_ids: decision.selectedRuleKeys,
      source_ids: retrieval.faqSlugs,
      evidence_snippets: [],
      reasoning_mode: 'deterministic',
      limitations: ['Answer is provisional pending human review'],
      escalation: {
        triggered: true,
        reason: decision.decisionReason,
        trigger_rule: decision.selectedRuleKeys[0],
        risk_level: decision.riskLevel === 'high' ? 'high' : decision.riskLevel === 'medium' ? 'medium' : 'low',
      },
      timestamp: now,
    })
  }

  // 2. Tier A/B shortcut → rule_based
  if (shortcutTaken && !llmCalled) {
    return buildMeta({
      answer_type: 'rule_based',
      verified: true,
      verification_notes: `Tier ${retrieval.shortcut === 'tier_a_shortcut' ? 'A' : 'B'} shortcut — deterministic match`,
      source_count: retrieval.sourceCount,
      needs_human_review: false,
      rule_ids: decision.selectedRuleKeys,
      source_ids: retrieval.faqSlugs,
      evidence_snippets: [],
      reasoning_mode: 'deterministic',
      limitations: [],
      escalation: { triggered: false },
      timestamp: now,
    })
  }

  // 3. Knowledge found + no LLM → retrieved_grounded
  const knowledgeFound = retrieval.faqSlugs.length > 0
  if (knowledgeFound && !llmCalled && retrieval.topScore >= GROUNDED_THRESHOLD) {
    return buildMeta({
      answer_type: 'retrieved_grounded',
      verified: true,
      verification_notes: `Grounded in ${retrieval.sourceCount} source(s), top score ${retrieval.topScore.toFixed(2)}`,
      source_count: retrieval.sourceCount,
      needs_human_review: false,
      rule_ids: decision.selectedRuleKeys,
      source_ids: retrieval.faqSlugs,
      evidence_snippets: [],
      reasoning_mode: 'retrieval',
      limitations: retrieval.hasStaleSource ? ['Some sources may be stale'] : [],
      escalation: { triggered: false },
      timestamp: now,
    })
  }

  // 4. LLM called + knowledge → inference_only (verified if strong evidence)
  if (llmCalled && knowledgeFound) {
    const verified =
      retrieval.topScore >= VERIFIED_INFERENCE_THRESHOLD &&
      retrieval.supportingSourceCount >= MIN_VERIFIED_SOURCES &&
      !retrieval.hasConflict

    const limitations: string[] = []
    if (retrieval.hasConflict) limitations.push('Conflicting sources detected')
    if (retrieval.hasStaleSource) limitations.push('Some sources may be stale')
    if (retrieval.hasDynamicDependencyWithoutVerification) limitations.push('Dynamic data not independently verified')

    return buildMeta({
      answer_type: verified ? 'inference_only' : 'unverified',
      verified,
      verification_notes: verified
        ? `LLM inference supported by ${retrieval.supportingSourceCount} source(s)`
        : `LLM inference with weak grounding (score ${retrieval.topScore.toFixed(2)})`,
      source_count: retrieval.sourceCount,
      needs_human_review: !verified,
      rule_ids: decision.selectedRuleKeys,
      source_ids: retrieval.faqSlugs,
      evidence_snippets: [],
      reasoning_mode: 'hybrid',
      limitations,
      escalation: { triggered: false },
      timestamp: now,
    })
  }

  // 5. LLM called + no knowledge → unverified
  return buildMeta({
    answer_type: 'unverified',
    verified: false,
    verification_notes: 'LLM generation without knowledge base support',
    source_count: 0,
    needs_human_review: true,
    rule_ids: decision.selectedRuleKeys,
    source_ids: [],
    evidence_snippets: [],
    reasoning_mode: 'inference',
    limitations: ['No knowledge base sources available', 'Answer is AI-generated without verification'],
    escalation: { triggered: false },
    timestamp: now,
  })
}

/** Internal helper — assembles the full AnswerMeta shape */
function buildMeta(input: {
  answer_type: AnswerType
  verified: boolean
  verification_notes: string
  source_count: number
  needs_human_review: boolean
  rule_ids: string[]
  source_ids: string[]
  evidence_snippets: string[]
  reasoning_mode: 'deterministic' | 'retrieval' | 'inference' | 'hybrid'
  limitations: string[]
  escalation: { triggered: boolean; reason?: string; trigger_rule?: string; risk_level?: 'low' | 'medium' | 'high' }
  timestamp: string
}): AnswerMeta {
  return {
    answer_type: input.answer_type,
    verification: {
      verified: input.verified,
      verification_notes: input.verification_notes,
      source_count: input.source_count,
      needs_human_review: input.needs_human_review,
    },
    evidence: {
      rule_ids: input.rule_ids,
      source_ids: input.source_ids,
      evidence_snippets: input.evidence_snippets,
      reasoning_mode: input.reasoning_mode,
      limitations: input.limitations,
    },
    escalation: input.escalation,
    timestamp: input.timestamp,
  }
}
