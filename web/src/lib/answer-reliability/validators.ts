/**
 * Answer Reliability — Validators (TASK 5 + 6)
 *
 * Post-classification checks:
 * 1. Unverified answers MUST be explicitly marked (never passed as verified)
 * 2. False-claims detection: certainty language without evidence
 * 3. Evidence binding sanity: evidence.source_ids must not be empty for
 *    rule_based / retrieved_grounded types
 */

import type { AnswerMeta } from './types'

export interface ValidationResult {
  valid: boolean
  issues: string[]
  /** If invalid, a corrected AnswerMeta (always marks as unverified on failure) */
  corrected?: AnswerMeta
}

/**
 * Validates the classified AnswerMeta for consistency.
 * Returns corrected version if issues are found.
 */
export function validateAnswerMeta(meta: AnswerMeta): ValidationResult {
  const issues: string[] = []

  // Rule 1: rule_based and retrieved_grounded MUST have source_ids
  if (
    (meta.answer_type === 'rule_based' || meta.answer_type === 'retrieved_grounded') &&
    meta.evidence.source_ids.length === 0
  ) {
    issues.push(`${meta.answer_type} answer has no source_ids — downgrading to unverified`)
  }

  // Rule 2: verified=true requires source_count > 0
  if (meta.verification.verified && meta.verification.source_count === 0) {
    issues.push('Marked verified but source_count is 0 — correcting to unverified')
  }

  // Rule 3: human_review_required MUST have needs_human_review=true
  if (meta.answer_type === 'human_review_required' && !meta.verification.needs_human_review) {
    issues.push('human_review_required but needs_human_review is false — correcting')
  }

  // Rule 4: escalation.triggered MUST be true for human_review_required
  if (meta.answer_type === 'human_review_required' && !meta.escalation.triggered) {
    issues.push('human_review_required but escalation not triggered — correcting')
  }

  if (issues.length === 0) {
    return { valid: true, issues: [] }
  }

  // Build corrected version
  const corrected: AnswerMeta = {
    ...meta,
    answer_type: meta.answer_type === 'human_review_required' ? 'human_review_required' : 'unverified',
    verification: {
      ...meta.verification,
      verified: false,
      needs_human_review: true,
      verification_notes: `[CORRECTED] ${issues.join('; ')}. Original: ${meta.verification.verification_notes}`,
    },
    escalation: meta.answer_type === 'human_review_required'
      ? { ...meta.escalation, triggered: true }
      : meta.escalation,
  }

  return { valid: false, issues, corrected }
}

// ─── False-Claims Detection (TASK 13 partial) ────────────────────────────────

/**
 * Certainty language patterns that should NOT appear in unverified answers.
 * Multilingual: EN, ZH, JA.
 */
const CERTAINTY_PATTERNS = [
  // English
  /\b(definitely|absolutely|guaranteed|certainly|100%|always|never fails|without doubt)\b/i,
  /\b(we can confirm|it is confirmed|this is verified|proven fact)\b/i,
  // Chinese
  /(绝对|一定|肯定|保证|百分之百|毫无疑问|确认无误)/,
  // Japanese
  /(絶対|必ず|確実|保証|間違いなく|確認済み)/,
]

export interface FalseClaimsResult {
  hasCertaintyLanguage: boolean
  matchedPatterns: string[]
}

/**
 * Checks answer text for certainty language that shouldn't appear
 * when the answer is unverified or has weak evidence.
 */
export function detectFalseClaims(
  answerText: string,
  meta: AnswerMeta,
): FalseClaimsResult {
  // Only flag certainty language for unverified / inference_only answers
  if (meta.answer_type === 'rule_based' || meta.answer_type === 'retrieved_grounded') {
    return { hasCertaintyLanguage: false, matchedPatterns: [] }
  }

  const matchedPatterns: string[] = []
  for (const pattern of CERTAINTY_PATTERNS) {
    const match = answerText.match(pattern)
    if (match) {
      matchedPatterns.push(match[0])
    }
  }

  return {
    hasCertaintyLanguage: matchedPatterns.length > 0,
    matchedPatterns,
  }
}
