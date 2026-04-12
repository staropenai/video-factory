/**
 * JTG V6 P0-1C — Knowledge gap detector.
 *
 * Reads from user_queries (via sensing/cluster) and faq_candidates to
 * identify recurring no-match clusters that haven't been addressed yet.
 *
 * V6 spec (执行文件 §P0-1C):
 *   "如果同一类问题连续7天Layer1未命中超过5次
 *    → 自动生成'新知识卡片候选'提案
 *    → 发送到人工review队列"
 *
 * Pure functions:
 *   - `identifyGaps` — takes clusters + existing candidates, returns unaddressed gaps
 *   - `rankGapsByUrgency` — sorts gaps by count * recency
 *
 * I/O wrapper:
 *   - `detectKnowledgeGaps` — reads from tables, runs pure logic, returns ranked gaps
 */

import type { Cluster } from '@/lib/sensing/cluster'
import type { FaqCandidateRow } from '@/lib/db/tables'

// ---------------------------------------------------------------------
// Pure: gap identification.
// ---------------------------------------------------------------------

export interface KnowledgeGap {
  signature: string
  sampleQuery: string
  hitCount: number
  languages: Record<string, number>
  firstSeen: string
  lastSeen: string
  /** Days between firstSeen and lastSeen. */
  spanDays: number
  /** Whether an existing candidate already covers this signature. */
  hasCandidate: boolean
  /** Urgency score: hitCount * recency weight. Higher = more urgent. */
  urgencyScore: number
}

/**
 * Identify unaddressed knowledge gaps from cluster data.
 * Pure — no I/O.
 *
 * A gap is "unaddressed" if no non-REJECTED candidate exists with
 * a matching clusterSignature.
 */
export function identifyGaps(
  clusters: Cluster[],
  candidates: FaqCandidateRow[],
  options: { minCount?: number; asOf?: Date } = {},
): KnowledgeGap[] {
  const minCount = options.minCount ?? 5
  const asOfMs = (options.asOf ?? new Date()).getTime()

  // Index existing candidate signatures (non-REJECTED only).
  const coveredSignatures = new Set(
    candidates
      .filter((c) => c.state !== 'REJECTED')
      .map((c) => c.clusterSignature)
      .filter(Boolean),
  )

  return clusters
    .filter((c) => c.count >= minCount)
    .map((c) => {
      const firstMs = Date.parse(c.firstSeen)
      const lastMs = Date.parse(c.lastSeen)
      const spanDays = Number.isFinite(firstMs) && Number.isFinite(lastMs)
        ? Math.max(1, Math.ceil((lastMs - firstMs) / 86_400_000))
        : 1

      // Recency weight: clusters with recent activity score higher.
      // Weight = 1.0 for today, decays by 0.1 per day of inactivity.
      const daysSinceLastSeen = Number.isFinite(lastMs)
        ? Math.max(0, (asOfMs - lastMs) / 86_400_000)
        : 30
      const recencyWeight = Math.max(0.1, 1.0 - daysSinceLastSeen * 0.1)

      return {
        signature: c.signature,
        sampleQuery: c.sampleQuery,
        hitCount: c.count,
        languages: c.byLanguage,
        firstSeen: c.firstSeen,
        lastSeen: c.lastSeen,
        spanDays,
        hasCandidate: coveredSignatures.has(c.signature),
        urgencyScore: Math.round(c.count * recencyWeight * 100) / 100,
      }
    })
}

/**
 * Rank gaps by urgency (highest first), filtering out already-addressed ones.
 * Pure — no I/O.
 */
export function rankGapsByUrgency(
  gaps: KnowledgeGap[],
  options: { includeAddressed?: boolean; limit?: number } = {},
): KnowledgeGap[] {
  const includeAddressed = options.includeAddressed ?? false
  const limit = options.limit ?? 20

  let out = gaps
  if (!includeAddressed) {
    out = out.filter((g) => !g.hasCandidate)
  }

  return out
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
    .slice(0, limit)
}

// ---------------------------------------------------------------------
// I/O wrapper.
// ---------------------------------------------------------------------

import { listUserQueries, listFaqCandidates } from '@/lib/db/tables'
import { clusterNoMatchQueries } from '@/lib/sensing/cluster'

export interface GapDetectorResult {
  gaps: KnowledgeGap[]
  totalNoMatch: number
  totalClusters: number
  scannedQueries: number
}

/**
 * Full gap detection pass. Reads user_queries, clusters no-match rows,
 * cross-references existing candidates, returns ranked gaps.
 */
export function detectKnowledgeGaps(options?: {
  scanWindow?: number
  minCount?: number
  limit?: number
}): GapDetectorResult {
  const scanWindow = options?.scanWindow ?? 500
  const minCount = options?.minCount ?? 5
  const limit = options?.limit ?? 20

  const queries = listUserQueries(scanWindow)
  const clusters = clusterNoMatchQueries(queries, {
    noMatchOnly: true,
    minCount: 2, // Get all clusters >= 2 for analysis
    limit: 200,
  })
  const candidates = listFaqCandidates()

  const gaps = identifyGaps(clusters, candidates, { minCount })
  const ranked = rankGapsByUrgency(gaps, { limit })

  return {
    gaps: ranked,
    totalNoMatch: queries.filter((q) => !q.knowledgeFound).length,
    totalClusters: clusters.length,
    scannedQueries: queries.length,
  }
}
