/**
 * Answer Audit Logger (TASK 12)
 *
 * Structured audit record for every answer produced by the system.
 * Captures the full decision chain: classification → verification → evidence → output.
 *
 * Every answer MUST be audited before being returned to the client.
 * Records are append-only and immutable.
 */

import type { AnswerMeta } from '@/lib/answer-reliability/types'
import type { FalseClaimsResult } from '@/lib/answer-reliability/validators'

export interface AnswerAuditRecord {
  /** Unique request identifier */
  requestId: string
  /** ISO 8601 timestamp */
  timestamp: string
  /** Session identifier */
  sessionId?: string
  /** Which tier answered: A, B, C, L6 (escalation) */
  tier: string
  /** The classified answer type */
  answerType: string
  /** Whether the answer passed verification */
  verified: boolean
  /** Whether human review is needed */
  needsHumanReview: boolean
  /** Number of evidence sources */
  sourceCount: number
  /** Rule IDs that fired */
  ruleIds: string[]
  /** Reasoning mode used */
  reasoningMode: string
  /** Known limitations */
  limitations: string[]
  /** Whether escalation was triggered */
  escalationTriggered: boolean
  /** Escalation reason (if any) */
  escalationReason?: string
  /** False-claims detection results */
  falseClaims: {
    hasCertaintyLanguage: boolean
    matchedPatterns: string[]
  }
  /** Answer quality validation result */
  qualityValidation: {
    passed: boolean
    issues: string[]
  }
  /** Latency in milliseconds */
  latencyMs: number
}

/**
 * Build a complete audit record from pipeline outputs.
 */
export function buildAnswerAuditRecord(input: {
  requestId: string
  sessionId?: string
  tier: string
  answerMeta: AnswerMeta
  falseClaims: FalseClaimsResult
  qualityIssues: string[]
  latencyMs: number
}): AnswerAuditRecord {
  return {
    requestId: input.requestId,
    timestamp: new Date().toISOString(),
    sessionId: input.sessionId,
    tier: input.tier,
    answerType: input.answerMeta.answer_type,
    verified: input.answerMeta.verification.verified,
    needsHumanReview: input.answerMeta.verification.needs_human_review,
    sourceCount: input.answerMeta.verification.source_count,
    ruleIds: input.answerMeta.evidence.rule_ids,
    reasoningMode: input.answerMeta.evidence.reasoning_mode,
    limitations: input.answerMeta.evidence.limitations,
    escalationTriggered: input.answerMeta.escalation.triggered,
    escalationReason: input.answerMeta.escalation.reason,
    falseClaims: {
      hasCertaintyLanguage: input.falseClaims.hasCertaintyLanguage,
      matchedPatterns: input.falseClaims.matchedPatterns,
    },
    qualityValidation: {
      passed: input.qualityIssues.length === 0,
      issues: input.qualityIssues,
    },
    latencyMs: input.latencyMs,
  }
}

/**
 * Emit the audit record. Currently logs to structured console output.
 * In production, this would write to an append-only audit store.
 */
export function emitAnswerAudit(record: AnswerAuditRecord): void {
  const entry = {
    timestamp: record.timestamp,
    level: 'audit' as const,
    event: 'answer_audit',
    data: record,
  }

  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(entry))
  } else {
    console.log(`[AUDIT] answer_audit`, {
      requestId: record.requestId,
      tier: record.tier,
      answerType: record.answerType,
      verified: record.verified,
      needsHumanReview: record.needsHumanReview,
      falseClaims: record.falseClaims.hasCertaintyLanguage,
    })
  }
}
