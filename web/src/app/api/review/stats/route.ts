/**
 * GET /api/review/stats — internal review snapshot.
 *
 * Returns aggregated counts from the in-memory router log buffer plus the
 * current handoff queue. Used by the /review page.
 *
 * [KNOWN LIMITATION] Buffer is in-process. Cold starts wipe it. Phase 2 swaps
 * the store for a real persistence layer.
 */

import { NextResponse } from 'next/server'
import {
  getReviewStats,
  listUserQueries,
  listHandoffs,
  listFaqCandidates,
} from '@/lib/db/tables'
import { CATEGORY_COUNTS } from '@/lib/knowledge/seed'
import { logError } from '@/lib/audit/logger'

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      stats: getReviewStats(),
      recentLog: listUserQueries(50),
      handoffs: listHandoffs(),
      faqCandidates: listFaqCandidates(),
      content: CATEGORY_COUNTS,
    })
  } catch (error) {
    logError('review_stats_error', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    )
  }
}
