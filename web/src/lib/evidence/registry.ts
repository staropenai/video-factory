/**
 * JTG P2 — Evidence Registry (v5 改进 #5).
 *
 * Higher-level operations over the evidence table in tables.ts. The raw
 * CRUD lives in tables.ts (same pattern as every other table); this module
 * adds:
 *
 *   1. **searchEvidenceRecords** — pure filter: topic tags + location +
 *      minimum confidence level. Used by the answer pipeline to auto-attach
 *      proof to high-risk / high-value responses.
 *
 *   2. **findExpiredRecords** — pure scan for records past their expiryDate.
 *      The daily-summary cron (P3) will call this and surface the list to
 *      staff so stale evidence doesn't silently back an answer.
 *
 *   3. **confidenceRank** — total ordering over confidence levels so
 *      `minConfidence: 'verified'` means "verified or better".
 *
 * Everything exported from this file that the P2 test suite needs is PURE
 * (takes data arrays as input, returns data). The I/O wrappers at the
 * bottom are thin helpers for route handlers.
 */

import type {
  EvidenceRecord,
  EvidenceConfidence,
} from '@/lib/db/tables'
import { listEvidence } from '@/lib/db/tables'

// ---------------------------------------------------------------------
// Confidence ordering.
// ---------------------------------------------------------------------

const CONFIDENCE_RANK: Record<EvidenceConfidence, number> = {
  unverified: 0,
  verified: 1,
  official: 2,
}

export const CONFIDENCE_LEVELS: readonly EvidenceConfidence[] = [
  'unverified',
  'verified',
  'official',
] as const

/**
 * Numeric rank for a confidence level. Higher = more trustworthy.
 * Unknown values return -1 so they sort below everything.
 */
export function confidenceRank(level: EvidenceConfidence): number {
  return CONFIDENCE_RANK[level] ?? -1
}

// ---------------------------------------------------------------------
// Pure search / filter.
// ---------------------------------------------------------------------

export interface EvidenceSearchQuery {
  /** At least one tag must match (case-insensitive substring). */
  topicTags?: string[]
  /** Location must match (case-insensitive substring). Null = skip filter. */
  location?: string | null
  /** Minimum confidence level (inclusive). Default: 'unverified'. */
  minConfidence?: EvidenceConfidence
  /** If true, exclude records whose expiryDate < asOf. Default: false. */
  excludeExpired?: boolean
  /** Reference date for expiry check. Default: now. */
  asOf?: Date
}

/**
 * Pure filter over an array of evidence records. No I/O.
 * Returns matching records sorted by confidence (highest first), then
 * by dateCollected (newest first).
 */
export function searchEvidenceRecords(
  records: EvidenceRecord[],
  query: EvidenceSearchQuery,
): EvidenceRecord[] {
  const minRank = confidenceRank(query.minConfidence ?? 'unverified')
  const asOfMs = (query.asOf ?? new Date()).getTime()

  let out = records.filter((r) => r.status === 'active')

  // Topic tag filter — at least one tag must match.
  if (query.topicTags && query.topicTags.length > 0) {
    const needles = query.topicTags.map((t) => t.toLowerCase())
    out = out.filter((r) =>
      r.topicTags.some((tag) => {
        const lower = tag.toLowerCase()
        return needles.some((n) => lower.includes(n))
      }),
    )
  }

  // Location filter.
  if (query.location) {
    const loc = query.location.toLowerCase()
    out = out.filter(
      (r) => r.location != null && r.location.toLowerCase().includes(loc),
    )
  }

  // Confidence floor.
  out = out.filter((r) => confidenceRank(r.confidenceLevel) >= minRank)

  // Expiry filter.
  if (query.excludeExpired) {
    out = out.filter((r) => {
      if (!r.expiryDate) return true
      return Date.parse(r.expiryDate) > asOfMs
    })
  }

  // Sort: confidence desc, then dateCollected desc.
  return out.sort((a, b) => {
    const cr = confidenceRank(b.confidenceLevel) - confidenceRank(a.confidenceLevel)
    if (cr !== 0) return cr
    return b.dateCollected.localeCompare(a.dateCollected)
  })
}

/**
 * Pure scan: find records whose expiryDate is on or before `asOf`.
 * Only considers 'active' records (already-archived ones are skipped).
 */
export function findExpiredRecords(
  records: EvidenceRecord[],
  asOf: Date = new Date(),
): EvidenceRecord[] {
  const asOfMs = asOf.getTime()
  return records
    .filter((r) => {
      if (r.status !== 'active') return false
      if (!r.expiryDate) return false
      return Date.parse(r.expiryDate) <= asOfMs
    })
    .sort((a, b) => {
      // Earliest-expired first.
      return (a.expiryDate ?? '').localeCompare(b.expiryDate ?? '')
    })
}

// ---------------------------------------------------------------------
// I/O wrappers (thin; route handlers call these).
// ---------------------------------------------------------------------

/** Read all evidence from JSONL + apply search filter. */
export function searchEvidence(query: EvidenceSearchQuery): EvidenceRecord[] {
  return searchEvidenceRecords(listEvidence(), query)
}

/** Find all evidence records that are past their expiry date. */
export function findExpiredEvidence(asOf?: Date): EvidenceRecord[] {
  return findExpiredRecords(listEvidence(), asOf)
}
