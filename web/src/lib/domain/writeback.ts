/**
 * JTG P1 — Staff writeback & daily review contract.
 *
 * This file holds the types that staff-facing review flows need in order to
 * record WHY a candidate moved to REVIEWED or REJECTED, plus the shape of
 * the daily triage summary endpoint. Nothing here persists anything — it's
 * pure contract + validator so the PATCH handler and the daily-summary
 * route handler can share one source of truth.
 *
 * Rule we care about most: a REJECTED decision MUST carry a
 * `rejectionReason` (even if the staff writes just one word). We don't
 * want silent rejects — every REJECTED row should answer "why" when
 * we audit the pipeline.
 */

import type { CandidateState, KnowledgeCardTier } from './enums'

// ---------------------------------------------------------------------
// Review decision.
// ---------------------------------------------------------------------

/** The subset of states a PATCH call can drive a candidate into. */
export type ReviewTargetState = Extract<
  CandidateState,
  'REVIEWED' | 'NEEDS_EDIT' | 'REJECTED' | 'CLUSTERED'
>

export interface ReviewDecision {
  decidedBy: string
  toState: ReviewTargetState
  /** Required when toState === 'REJECTED'. */
  rejectionReason?: string
  /** Optional rationale for REVIEWED / NEEDS_EDIT. */
  promoteReason?: string
  reviewNote?: string
  /** Optional tier suggestion for downstream publish flow. */
  suggestedCardTier?: KnowledgeCardTier
}

export const WRITEBACK_ERROR_CODES = {
  INVALID_TO_STATE: 'INVALID_TO_STATE',
  MISSING_REJECTION_REASON: 'MISSING_REJECTION_REASON',
  MISSING_DECIDER: 'MISSING_DECIDER',
  INVALID_TIER: 'INVALID_TIER',
} as const
export type WritebackErrorCode =
  (typeof WRITEBACK_ERROR_CODES)[keyof typeof WRITEBACK_ERROR_CODES]

export interface ReviewDecisionOk {
  ok: true
  decision: ReviewDecision
}
export interface ReviewDecisionErr {
  ok: false
  code: WritebackErrorCode
  message: string
}
export type ReviewDecisionResult = ReviewDecisionOk | ReviewDecisionErr

const ALLOWED_TO_STATES: ReadonlyArray<ReviewTargetState> = [
  'REVIEWED',
  'NEEDS_EDIT',
  'REJECTED',
  'CLUSTERED',
]

export function validateReviewDecision(
  raw: Partial<ReviewDecision> & { toState?: string },
): ReviewDecisionResult {
  const to = raw.toState
  if (
    typeof to !== 'string' ||
    !(ALLOWED_TO_STATES as readonly string[]).includes(to)
  ) {
    return {
      ok: false,
      code: WRITEBACK_ERROR_CODES.INVALID_TO_STATE,
      message: `toState must be one of ${ALLOWED_TO_STATES.join(', ')}; got ${JSON.stringify(to)}`,
    }
  }
  if (!raw.decidedBy || typeof raw.decidedBy !== 'string') {
    return {
      ok: false,
      code: WRITEBACK_ERROR_CODES.MISSING_DECIDER,
      message: 'decidedBy is required',
    }
  }
  if (to === 'REJECTED' && !raw.rejectionReason) {
    return {
      ok: false,
      code: WRITEBACK_ERROR_CODES.MISSING_REJECTION_REASON,
      message: 'REJECTED decisions must include a rejectionReason',
    }
  }
  if (
    raw.suggestedCardTier &&
    raw.suggestedCardTier !== 'A' &&
    raw.suggestedCardTier !== 'B' &&
    raw.suggestedCardTier !== 'C'
  ) {
    return {
      ok: false,
      code: WRITEBACK_ERROR_CODES.INVALID_TIER,
      message: `suggestedCardTier must be A|B|C; got ${raw.suggestedCardTier}`,
    }
  }
  return {
    ok: true,
    decision: {
      decidedBy: raw.decidedBy,
      toState: to as ReviewTargetState,
      rejectionReason: raw.rejectionReason,
      promoteReason: raw.promoteReason,
      reviewNote: raw.reviewNote,
      suggestedCardTier: raw.suggestedCardTier,
    },
  }
}

// ---------------------------------------------------------------------
// Daily review summary — read model for /api/review/daily-summary.
// ---------------------------------------------------------------------

export interface CandidateStateBucket {
  state: CandidateState
  count: number
  sampleIds: string[]
}

export interface StaleCandidatePointer {
  candidateId: string
  state: CandidateState
  lastUpdatedAt: string
  ageDays: number
}

export interface DailyReviewSummary {
  /** ISO date (yyyy-mm-dd) the summary was generated for. */
  asOfDate: string
  /** Total across all non-terminal states. */
  pendingTotal: number
  /** Per-state counts + up to 5 sample ids per state. */
  buckets: CandidateStateBucket[]
  /** Candidates with no updates in the last 7 days that are non-terminal. */
  staleCandidates: StaleCandidatePointer[]
  /** CANDIDATE_REVIEWED events in the since window. */
  reviewedToday: number
  /** LIVE_FAQ_PUBLISHED events in the since window. */
  publishedToday: number
  /** Count of REJECTED transitions recorded in the since window. */
  rejectedToday: number
}
