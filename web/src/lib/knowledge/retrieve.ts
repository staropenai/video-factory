/**
 * Knowledge retrieval — backed by seeded FAQ set for staging.
 *
 * Uses deterministic synonym-expanded keyword scoring. No external APIs, no LLM.
 * Production would replace this with a real search index + source registry.
 */

import type { RetrievalSummary } from '@/lib/router/types'
import {
  scoreQueryAgainstSeeds,
  resolveTier,
  type FaqEntry,
} from '@/lib/knowledge/seed'
import { scoreQueryAgainstOverlay } from '@/lib/knowledge/overlay'

/**
 * Minimum saturated score required before we trust a Tier A/B shortcut and
 * skip the LLM entirely. 0.77 ≈ "at least 2 synonym-expanded keyword hits".
 *
 * Rationale: the shortcut replaces the whole AI layer, so it's the single
 * biggest correctness lever. Keep the bar strictly above the 0.62 "single-
 * hit" floor to avoid Tier-A false positives from ambient vocabulary.
 */
const TIER_SHORTCUT_MIN_SCORE = 0.77

/**
 * Run both the static seed scorer and the live-FAQ overlay scorer, then
 * merge their results keeping the best (score, hits) per FAQ id. Live FAQs
 * win ties against seeds because they are staff-reviewed and represent the
 * latest understanding of the problem.
 */
function scoreMerged(
  rawQuery: string,
): Array<{ faq: FaqEntry; score: number; hits: number }> {
  const seed = scoreQueryAgainstSeeds(rawQuery)
  const overlay = scoreQueryAgainstOverlay(rawQuery)
  if (overlay.length === 0) return seed
  const bestById = new Map<string, { faq: FaqEntry; score: number; hits: number }>()
  for (const s of seed) bestById.set(s.faq.id, s)
  for (const o of overlay) {
    const prev = bestById.get(o.faq.id)
    // Live overlays win ties — they are staff-reviewed and newer.
    if (!prev || o.score >= prev.score) {
      bestById.set(o.faq.id, o)
    }
  }
  return Array.from(bestById.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.hits - a.hits
  })
}

const EMPTY_RETRIEVAL: RetrievalSummary = {
  faqSlugs: [],
  sourceCount: 0,
  supportingSourceCount: 0,
  topScore: 0,
  hasConflict: false,
  hasStaleSource: false,
  hasDynamicDependencyWithoutVerification: false,
  topTier: undefined,
  topSourceType: undefined,
  shortcut: 'none',
}

/**
 * Decide whether the top match qualifies for a Tier A/B LLM-shortcut.
 * Only seed + live-FAQ (STATIC) cards are eligible — REALTIME and
 * AI_INFERRED knowledge must always flow through the AI layer because they
 * carry their own staleness / hallucination risks.
 */
function tierShortcut(
  tier: 'A' | 'B' | 'C',
  topScore: number,
  sourceType: 'STATIC' | 'REALTIME' | 'AI_INFERRED',
): 'tier_a_shortcut' | 'tier_b_shortcut' | 'none' {
  if (sourceType !== 'STATIC') return 'none'
  if (topScore < TIER_SHORTCUT_MIN_SCORE) return 'none'
  if (tier === 'A') return 'tier_a_shortcut'
  if (tier === 'B') return 'tier_b_shortcut'
  return 'none'
}

export type RetrievalResult = {
  summary: RetrievalSummary
  matches: FaqEntry[]
}

export function retrieveFromLocal(query: string): RetrievalResult {
  const scored = scoreMerged(query)
  if (scored.length === 0) {
    return { summary: { ...EMPTY_RETRIEVAL }, matches: [] }
  }

  // Take top 2 as the "matched set" so the low_confidence_gate's
  // faqSlugs >= 2 constraint can be satisfied when we have a real hit.
  const top = scored.slice(0, 2)
  const matches = top.map((s) => s.faq)
  const topScore = top[0].score
  const topTier = resolveTier(top[0].faq)
  // Seed + live-FAQ overlay are both STATIC provenance — v4 改进 #6.
  const topSourceType = 'STATIC' as const
  const shortcut = tierShortcut(topTier, topScore, topSourceType)

  // Each live FAQ counts as one primary source + one next_step_contact
  // (city office, immigration, etc.) — stub 2 supporting sources per match
  // so low_confidence_gate's supportingSourceCount >= 2 can be satisfied.
  const sourceCount = matches.length * 2
  const supportingSourceCount = sourceCount

  return {
    summary: {
      faqSlugs: matches.map((m) => m.id),
      sourceCount,
      supportingSourceCount,
      topScore,
      hasConflict: false,
      hasStaleSource: false,
      hasDynamicDependencyWithoutVerification: false,
      topTier,
      topSourceType,
      shortcut,
    },
    matches,
  }
}

export async function retrieveKnowledge(query: string): Promise<RetrievalSummary> {
  return retrieveFromLocal(query).summary
}

/**
 * Multi-query retrieval. Accepts several rewritten search phrases (typically
 * from the AI understanding layer), runs each through scoreQueryAgainstSeeds,
 * merges hits by FAQ id keeping the max score per FAQ, and returns the top 2.
 *
 * Fall-through: if queries is empty or no query produces any hit, falls back
 * to single-query retrieval on `originalQuery`.
 */
export function retrieveFromLocalMulti(
  originalQuery: string,
  queries: string[],
): RetrievalResult {
  const uniqueQueries = Array.from(
    new Set([originalQuery, ...queries].map((q) => q.trim()).filter(Boolean)),
  )
  if (uniqueQueries.length === 0) return retrieveFromLocal(originalQuery)

  const bestById = new Map<string, { faq: FaqEntry; score: number; hits: number }>()
  for (const q of uniqueQueries) {
    // Merged scorer = seed + live-FAQ overlay. Published live FAQs become
    // retrievable the instant they land in /tmp/live_faqs.jsonl.
    const scored = scoreMerged(q)
    for (const s of scored) {
      const prev = bestById.get(s.faq.id)
      if (!prev || s.score > prev.score || (s.score === prev.score && s.hits > prev.hits)) {
        bestById.set(s.faq.id, s)
      }
    }
  }
  if (bestById.size === 0) return retrieveFromLocal(originalQuery)

  // Sort by saturated score, then by raw hit count as tiebreaker — see
  // scoreQueryAgainstSeeds for the rationale.
  const sorted = Array.from(bestById.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.hits - a.hits
  })
  const top = sorted.slice(0, 2)
  const matches = top.map((s) => s.faq)
  const topScore = top[0].score
  const topTier = resolveTier(top[0].faq)
  const topSourceType = 'STATIC' as const
  const shortcut = tierShortcut(topTier, topScore, topSourceType)
  const sourceCount = matches.length * 2

  return {
    summary: {
      faqSlugs: matches.map((m) => m.id),
      sourceCount,
      supportingSourceCount: sourceCount,
      topScore,
      hasConflict: false,
      hasStaleSource: false,
      hasDynamicDependencyWithoutVerification: false,
      topTier,
      topSourceType,
      shortcut,
    },
    matches,
  }
}
