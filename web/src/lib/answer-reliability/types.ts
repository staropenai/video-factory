/**
 * Answer Reliability System — Types
 *
 * TASK 4: answer_type enum
 * TASK 5: verification status
 * TASK 6: evidence binding
 * TASK 7: escalation metadata
 *
 * Every AI answer must carry an AnswerMeta object that describes:
 * - HOW the answer was produced (answer_type)
 * - WHETHER it was verified (verified + verification_notes)
 * - WHAT evidence supports it (evidence)
 * - WHETHER it needs human review (needs_human_review + escalation)
 */

// ─── TASK 4: Answer Type ─────────────────────────────────────────────────────

/**
 * Every answer falls into exactly one type. The type determines
 * the UI treatment and audit classification.
 */
export const ANSWER_TYPES = [
  'rule_based',           // Deterministic rule match (Tier A/B shortcut)
  'retrieved_grounded',   // Knowledge retrieval with high confidence
  'inference_only',       // LLM generation with some evidence
  'unverified',           // LLM generation without sufficient evidence
  'human_review_required', // Escalated to human — answer is provisional
] as const

export type AnswerType = (typeof ANSWER_TYPES)[number]

// ─── TASK 5: Verification Status ─────────────────────────────────────────────

export interface VerificationStatus {
  /** Whether the answer is verified against known sources */
  verified: boolean
  /** Human-readable notes about verification (or lack thereof) */
  verification_notes: string
  /** Number of sources that support this answer */
  source_count: number
  /** Whether a human should review before the user acts on this */
  needs_human_review: boolean
}

// ─── TASK 6: Evidence Binding ────────────────────────────────────────────────

export interface EvidenceBinding {
  /** Rule keys that fired during routing (e.g. 'high_risk_gate') */
  rule_ids: string[]
  /** Knowledge card IDs used as sources */
  source_ids: string[]
  /** Short evidence excerpts (max 3, max 200 chars each) */
  evidence_snippets: string[]
  /** How the answer was produced */
  reasoning_mode: 'deterministic' | 'retrieval' | 'inference' | 'hybrid'
  /** Known limitations of this answer */
  limitations: string[]
}

// ─── TASK 7: Escalation Metadata ─────────────────────────────────────────────

export interface EscalationInfo {
  /** Whether escalation was triggered */
  triggered: boolean
  /** Why escalation was triggered */
  reason?: string
  /** Which rule triggered escalation */
  trigger_rule?: string
  /** Risk level that caused escalation */
  risk_level?: 'low' | 'medium' | 'high'
}

// ─── Combined Answer Metadata ────────────────────────────────────────────────

/**
 * AnswerMeta is attached to every answer at the API boundary.
 * It's the single source of truth for answer reliability.
 */
export interface AnswerMeta {
  answer_type: AnswerType
  verification: VerificationStatus
  evidence: EvidenceBinding
  escalation: EscalationInfo
  /** ISO 8601 timestamp when the answer was produced */
  timestamp: string
}
