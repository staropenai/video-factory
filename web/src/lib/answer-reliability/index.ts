/**
 * Answer Reliability System — public API
 *
 * Usage:
 *   import { classifyAnswer, validateAnswerMeta, detectFalseClaims } from '@/lib/answer-reliability'
 */

export { classifyAnswer } from './classify'
export type { ClassifyInput } from './classify'
export { validateAnswerMeta, detectFalseClaims } from './validators'
export type { ValidationResult, FalseClaimsResult } from './validators'
export { ANSWER_TYPES } from './types'
export type { AnswerType, AnswerMeta, VerificationStatus, EvidenceBinding, EscalationInfo } from './types'
