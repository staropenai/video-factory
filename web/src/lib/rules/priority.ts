/**
 * Rule Priority System (TASK 9)
 *
 * Formalizes the priority-based override ordering that was previously
 * implicit in decide.ts's last-writer-wins loop + manual safety override.
 *
 * Priority semantics:
 *   - Lower number = runs FIRST (like z-index)
 *   - Higher-priority rules (higher number) can TIGHTEN but never LOOSEN
 *   - "Tighten" = raise risk, escalate, or restrict answer mode
 *   - escalation (shouldEscalate=true) always forces handoff regardless of order
 *
 * Override ordering for answerMode (from least to most restrictive):
 *   direct_answer < clarify < official_only < handoff
 *
 * Override ordering for riskLevel:
 *   low < medium < high
 *
 * This module provides a pure function that aggregates RuleResult[] into
 * a single resolved state, replacing the ad-hoc loop in decide.ts.
 */

import type { RuleResult } from '@/lib/router/types'
import type { AnswerMode, RiskLevel, ConfidenceBand } from '@/lib/router/types'

/** Strictness rank: higher number = more restrictive */
const ANSWER_MODE_RANK: Record<AnswerMode, number> = {
  direct_answer: 0,
  clarify: 1,
  official_only: 2,
  handoff: 3,
}

const RISK_RANK: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
}

const CONFIDENCE_RANK: Record<ConfidenceBand, number> = {
  high: 2,
  medium: 1,
  low: 0,
}

export interface AggregatedRuleState {
  answerMode: AnswerMode
  riskLevel: RiskLevel
  confidenceBand: ConfidenceBand
  shouldEscalate: boolean
  selectedRuleKeys: string[]
  traceTags: string[]
  reasons: string[]
  missingInputs: string[]
}

/**
 * Aggregates rule results using tighten-only semantics.
 *
 * For each field, only TIGHTER values are accepted:
 * - answerMode: can only move toward handoff, never back to direct_answer
 * - riskLevel: can only increase, never decrease
 * - confidenceBand: can only decrease, never increase
 * - shouldEscalate: once true, stays true
 *
 * Final safety invariant: if shouldEscalate=true, answerMode is forced to handoff.
 */
export function aggregateRuleResults(
  results: RuleResult[],
  defaults: { answerMode: AnswerMode; riskLevel: RiskLevel; confidenceBand: ConfidenceBand } = {
    answerMode: 'direct_answer',
    riskLevel: 'low',
    confidenceBand: 'high',
  },
): AggregatedRuleState {
  let answerMode = defaults.answerMode
  let riskLevel = defaults.riskLevel
  let confidenceBand = defaults.confidenceBand
  let shouldEscalate = false

  const selectedRuleKeys: string[] = []
  const traceTags: string[] = []
  const reasons: string[] = []
  const missingInputs: string[] = []

  for (const result of results) {
    selectedRuleKeys.push(result.ruleKey)
    if (result.traceTag) traceTags.push(result.traceTag)
    if (result.reason) reasons.push(result.reason)
    if (result.missingInputs?.length) missingInputs.push(...result.missingInputs)

    // Tighten-only: answerMode can only become MORE restrictive
    if (result.answerModeOverride) {
      const currentRank = ANSWER_MODE_RANK[answerMode]
      const proposedRank = ANSWER_MODE_RANK[result.answerModeOverride]
      if (proposedRank > currentRank) {
        answerMode = result.answerModeOverride
      }
    }

    // Tighten-only: riskLevel can only INCREASE
    if (result.riskLevelOverride) {
      const currentRank = RISK_RANK[riskLevel]
      const proposedRank = RISK_RANK[result.riskLevelOverride]
      if (proposedRank > currentRank) {
        riskLevel = result.riskLevelOverride
      }
    }

    // Tighten-only: confidenceBand can only DECREASE
    if (result.confidenceOverride) {
      const currentRank = CONFIDENCE_RANK[confidenceBand]
      const proposedRank = CONFIDENCE_RANK[result.confidenceOverride]
      if (proposedRank < currentRank) {
        confidenceBand = result.confidenceOverride
      }
    }

    // Once escalated, stays escalated
    if (result.shouldEscalate) {
      shouldEscalate = true
    }
  }

  // Final safety invariant: escalation forces handoff
  if (shouldEscalate && answerMode !== 'handoff') {
    answerMode = 'handoff'
    traceTags.push('priority:handoff_override_due_to_escalation')
    reasons.push('Escalation flag forced answerMode=handoff (tighten-only invariant).')
  }

  return {
    answerMode,
    riskLevel,
    confidenceBand,
    shouldEscalate,
    selectedRuleKeys,
    traceTags: [...new Set(traceTags)],
    reasons,
    missingInputs: [...new Set(missingInputs)],
  }
}
