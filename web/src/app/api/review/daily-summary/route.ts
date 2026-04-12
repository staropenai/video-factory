/**
 * GET /api/review/daily-summary — JTG P1 admin triage read model.
 *
 * Returns a `DailyReviewSummary` computed from the candidates table and
 * the durable events table:
 *
 *   - Per-state candidate counts + up to 5 sample ids per state
 *   - Stale candidates: non-terminal, no updates in the last 7 days
 *   - Today's counts of CANDIDATE_REVIEWED / LIVE_FAQ_PUBLISHED /
 *     REJECTED transitions (REJECTED is counted from CANDIDATE_REVIEWED
 *     events whose metadata.to === 'REJECTED')
 *
 * Query params:
 *   - `since`: optional ISO-8601. Defaults to start-of-today (local UTC).
 *
 * This endpoint is read-only and safe to call repeatedly. It never
 * writes anything and never throws on empty state.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  listFaqCandidates,
  listEvents,
  type FaqCandidateRow,
} from '@/lib/db/tables'
import type { CandidateState } from '@/lib/domain/enums'
import type {
  DailyReviewSummary,
  CandidateStateBucket,
  StaleCandidatePointer,
} from '@/lib/domain/writeback'
import { logError } from '@/lib/audit/logger'

const NON_TERMINAL: ReadonlyArray<CandidateState> = [
  'NEW',
  'CLUSTERED',
  'REVIEWED',
  'NEEDS_EDIT',
]
const ALL_STATES: ReadonlyArray<CandidateState> = [
  'NEW',
  'CLUSTERED',
  'REVIEWED',
  'NEEDS_EDIT',
  'PUBLISHED',
  'REJECTED',
]

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

function todayStartIso(): string {
  const now = new Date()
  const utc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  return utc.toISOString()
}

function bucketize(
  rows: FaqCandidateRow[],
): CandidateStateBucket[] {
  const buckets = new Map<CandidateState, FaqCandidateRow[]>()
  for (const state of ALL_STATES) buckets.set(state, [])
  for (const r of rows) {
    const s = (r.state ?? 'NEW') as CandidateState
    const arr = buckets.get(s)
    if (arr) arr.push(r)
  }
  return ALL_STATES.map((state) => {
    const arr = buckets.get(state) ?? []
    return {
      state,
      count: arr.length,
      sampleIds: arr.slice(0, 5).map((r) => r.id),
    }
  })
}

function findStale(
  rows: FaqCandidateRow[],
  now: Date,
): StaleCandidatePointer[] {
  const out: StaleCandidatePointer[] = []
  for (const r of rows) {
    const state = (r.state ?? 'NEW') as CandidateState
    if (!(NON_TERMINAL as readonly string[]).includes(state)) continue
    const last = r.updatedAt ?? r.createdAt
    const lastMs = Date.parse(last)
    if (!Number.isFinite(lastMs)) continue
    const age = now.getTime() - lastMs
    if (age < STALE_THRESHOLD_MS) continue
    out.push({
      candidateId: r.id,
      state,
      lastUpdatedAt: last,
      ageDays: Math.floor(age / (24 * 60 * 60 * 1000)),
    })
  }
  // Oldest first so the UI highlights the worst offenders.
  out.sort((a, b) => b.ageDays - a.ageDays)
  return out.slice(0, 20)
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const sinceParam = url.searchParams.get('since')
    const since =
      sinceParam && Number.isFinite(Date.parse(sinceParam))
        ? sinceParam
        : todayStartIso()

    const candidates = listFaqCandidates()
    const now = new Date()

    const buckets = bucketize(candidates)
    const pendingTotal = buckets
      .filter((b) => (NON_TERMINAL as readonly string[]).includes(b.state))
      .reduce((acc, b) => acc + b.count, 0)
    const staleCandidates = findStale(candidates, now)

    // Event-sourced counters. REJECTED transitions are recorded as
    // CANDIDATE_REVIEWED events with metadata.to === 'REJECTED', so we
    // filter in memory.
    const reviewedEvents = listEvents({
      eventType: 'CANDIDATE_REVIEWED',
      since,
    })
    const publishedEvents = listEvents({
      eventType: 'LIVE_FAQ_PUBLISHED',
      since,
    })
    const rejectedToday = reviewedEvents.filter(
      (e) => (e.metadata as { to?: string } | undefined)?.to === 'REJECTED',
    ).length

    const summary: DailyReviewSummary = {
      asOfDate: now.toISOString().slice(0, 10),
      pendingTotal,
      buckets,
      staleCandidates,
      reviewedToday: reviewedEvents.length,
      publishedToday: publishedEvents.length,
      rejectedToday,
    }

    return NextResponse.json({ ok: true, summary, since })
  } catch (error) {
    logError('daily_summary_error', error)
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL',
          message: error instanceof Error ? error.message : 'Internal error',
          relatedIds: {},
        },
      },
      { status: 500 },
    )
  }
}
