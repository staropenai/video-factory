/**
 * Human Correction System — Types (TASK 15 + 16)
 *
 * When a human reviews an AI answer and corrects it, the correction
 * is persisted as a CorrectionRecord. This enables:
 * - Tracking which answers needed correction
 * - Measuring AI accuracy over time
 * - Feeding corrections back into the knowledge base
 * - Building error attribution reports (TASK 17)
 */

/**
 * What type of correction was made.
 */
export type CorrectionType =
  | 'factual_error'        // AI stated something incorrect
  | 'missing_info'         // AI omitted important information
  | 'wrong_escalation'     // Should/shouldn't have been escalated
  | 'wrong_language'       // Response in wrong language
  | 'tone_inappropriate'   // Tone was wrong for the situation
  | 'outdated_info'        // Information was stale/outdated
  | 'safety_issue'         // Safety boundary not properly enforced
  | 'other'

export const CORRECTION_TYPES: CorrectionType[] = [
  'factual_error',
  'missing_info',
  'wrong_escalation',
  'wrong_language',
  'tone_inappropriate',
  'outdated_info',
  'safety_issue',
  'other',
]

/**
 * A single correction record. Immutable once created.
 */
export interface CorrectionRecord {
  id: string
  createdAt: string
  /** The request that produced the incorrect answer */
  requestId: string
  /** The case this correction is attached to (if any) */
  caseId?: string
  /** The original user query */
  originalQuery: string
  /** The AI-generated answer that was corrected */
  originalAnswer: string
  /** The corrected answer provided by the human */
  correctedAnswer: string
  /** What type of error this was */
  correctionType: CorrectionType
  /** Human-provided explanation of what was wrong */
  explanation: string
  /** Who made the correction */
  correctedBy: string
  /** The original answer's classification */
  originalAnswerType: string
  /** Whether the original was marked as verified */
  originalWasVerified: boolean
  /** The tier that produced the original answer */
  originalTier: string
  /** Rule keys that fired on the original query */
  originalRuleKeys: string[]
  /** Whether this correction has been applied to the knowledge base */
  appliedToKnowledgeBase: boolean
}

/**
 * Input for creating a new correction.
 */
export type CorrectionInput = Omit<CorrectionRecord, 'id' | 'createdAt' | 'appliedToKnowledgeBase'>
