/**
 * PATCH /api/review/faq-candidates/[id] — drive a candidate through the
 * lifecycle state machine (Spec §6).
 *
 * Body: { to: CandidateState, reviewNote?: string }
 *   where `to` is one of NEW | CLUSTERED | REVIEWED | NEEDS_EDIT | PUBLISHED | REJECTED.
 *
 * Legacy shim: requests that still send `{ status: 'promoted' | 'rejected' }`
 * are mapped to `{ to: 'PUBLISHED' | 'REJECTED' }`. This keeps the existing
 * /review UI working without a redeploy. Publish requests sent via this
 * endpoint are rejected — publish MUST go through
 * /api/review/faq-candidates/[id]/publish so the live_faq is atomically
 * written and audited.
 *
 * Spec compliance:
 *   §6.1 transitions validated via canTransition()
 *   §8.3 persists CANDIDATE_REVIEWED event on success
 *   §13 returns structured errors with stable codes
 */

import { NextRequest } from 'next/server'
import {
  getFaqCandidate,
  setCandidateState,
  insertEvent,
} from '@/lib/db/tables'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { canTransition } from '@/lib/candidate/state'
import type { CandidateState } from '@/lib/domain/enums'
import { CANDIDATE_STATES } from '@/lib/domain/enums'
import {
  validateReviewDecision,
  type ReviewDecision,
} from '@/lib/domain/writeback'
import { logError } from '@/lib/audit/logger'
import { ok, fail, notFound, rateLimited } from '@/lib/utils/api-response'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'

type Ctx = { params: Promise<{ id: string }> }

/** Stable structured-error builder (Spec §13). */
function err(
  code: string,
  message: string,
  status: number,
) {
  return fail(message, status, code)
}

function coerceTo(body: Record<string, unknown>): CandidateState | null {
  const to = body.to
  if (typeof to === 'string' && (CANDIDATE_STATES as readonly string[]).includes(to)) {
    return to as CandidateState
  }
  // Legacy shim — old UI sends {status: 'promoted' | 'rejected'}.
  const legacy = body.status
  if (legacy === 'promoted') return 'PUBLISHED'
  if (legacy === 'rejected') return 'REJECTED'
  return null
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const rl = checkRateLimit(`faq-candidate:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const authCheck = requireAdmin(req);
  if (!authCheck.ok) return authCheck.response;

  try {
    const { id } = await ctx.params
    const body = (await req.json()) as Record<string, unknown>
    const to = coerceTo(body)
    if (!to) {
      return err(
        'INVALID_INPUT',
        `body must include a valid "to" state; allowed: ${CANDIDATE_STATES.join(', ')}`,
        400,
      )
    }

    // Spec §7 — PATCH must NEVER publish. Publishing requires the atomic
    // /publish endpoint so live_faq + candidate update + audit event all run
    // inside one controlled path.
    if (to === 'PUBLISHED') {
      return err(
        'PUBLISH_WRONG_ENDPOINT',
        'publish must go through POST /api/review/faq-candidates/[id]/publish',
        400,
      )
    }

    const candidate = getFaqCandidate(id)
    if (!candidate) {
      return err('CANDIDATE_NOT_FOUND', `candidate ${id} not found`, 404)
    }

    const from = candidate.state ?? 'NEW'
    const check = canTransition(from, to)
    if (!check.ok) {
      return err(check.code, check.message, 409)
    }

    const reviewNote =
      typeof body.reviewNote === 'string'
        ? body.reviewNote.slice(0, 4000)
        : undefined

    // P1 §writeback — accept an optional structured ReviewDecision in the
    // body and validate it with the domain validator. We still drive the
    // state machine with `to` (for back-compat with the existing UI); the
    // decision object just enriches the audit event metadata. Missing the
    // decision field is fine — old callers keep working.
    let decision: ReviewDecision | null = null
    if (body.decision != null && typeof body.decision === 'object') {
      const candidateDecision = {
        ...(body.decision as Record<string, unknown>),
        // Fill in toState from `to` if the caller didn't set it; saves the
        // UI from duplicating the state.
        toState:
          (body.decision as { toState?: unknown }).toState ?? to,
      }
      const check = validateReviewDecision(
        candidateDecision as Partial<ReviewDecision> & { toState?: string },
      )
      if (!check.ok) {
        return err(check.code, check.message, 400)
      }
      decision = check.decision
    }

    const updated = setCandidateState(id, to, {
      reviewNote: decision?.reviewNote ?? reviewNote,
    })
    if (!updated) {
      return err('PERSIST_FAILED', 'failed to persist state transition', 500)
    }

    insertEvent({
      eventType: 'CANDIDATE_REVIEWED',
      route: '/api/review/faq-candidates/[id]',
      relatedIds: { candidateId: id },
      metadata: {
        from,
        to,
        reviewNote: decision?.reviewNote ?? reviewNote ?? null,
        // Persist the structured decision when provided so the daily
        // summary can count rejections with reasons.
        decidedBy: decision?.decidedBy ?? null,
        rejectionReason: decision?.rejectionReason ?? null,
        promoteReason: decision?.promoteReason ?? null,
        suggestedCardTier: decision?.suggestedCardTier ?? null,
      },
    })

    return ok({ candidate: updated, decision })
  } catch (error) {
    logError('faq_candidate_review_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500, 'INTERNAL')
  }
}
