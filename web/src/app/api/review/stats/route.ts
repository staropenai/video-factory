/**
 * GET /api/review/stats — internal review snapshot.
 *
 * Returns aggregated counts from the in-memory router log buffer plus the
 * current handoff queue. Used by the /review page.
 *
 * [KNOWN LIMITATION] Buffer is in-process. Cold starts wipe it. Phase 2 swaps
 * the store for a real persistence layer.
 */

import { NextRequest } from 'next/server'
import {
  getReviewStats,
  listUserQueries,
  listHandoffs,
  listFaqCandidates,
} from '@/lib/db/tables'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { CATEGORY_COUNTS } from '@/lib/knowledge/seed'
import { CANDIDATE_STATES } from '@/lib/domain/enums'
import type { CandidateState } from '@/lib/domain/enums'
import { logError } from '@/lib/audit/logger'
import { ok, fail, rateLimited } from '@/lib/utils/api-response'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`review-stats:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const authCheck = requireAdmin(req);
  if (!authCheck.ok) return authCheck.response;

  try {
    // Spec §9 — backend-driven state filter. The /review UI passes ?state=
    // and we hand back exactly what the state machine says, no frontend
    // reshuffling. Empty/unknown filters return the full unfiltered list.
    const url = new URL(req.url)
    const stateParam = url.searchParams.get('state')
    const state =
      stateParam && (CANDIDATE_STATES as readonly string[]).includes(stateParam)
        ? (stateParam as CandidateState)
        : undefined

    return ok({
      stats: getReviewStats(),
      recentLog: listUserQueries(50),
      handoffs: listHandoffs(),
      faqCandidates: listFaqCandidates(state ? { state } : undefined),
      candidateStateFilter: state ?? null,
      content: CATEGORY_COUNTS,
    })
  } catch (error) {
    logError('review_stats_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}
