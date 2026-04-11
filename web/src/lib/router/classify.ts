/**
 * Query classifier — deterministic, multilingual, seed-driven.
 *
 * Currently: if the query hits any seeded FAQ keyword, classify as 'faq'.
 * Otherwise 'out_of_scope'. Deliberately simple for staging.
 */

import type { QueryType } from '@/lib/router/types'
import { scoreQueryAgainstSeeds } from '@/lib/knowledge/seed'

export function classifyQuery(query: string): QueryType {
  const scored = scoreQueryAgainstSeeds(query)
  if (scored.length > 0 && scored[0].score >= 0.6) return 'faq'
  return 'out_of_scope'
}
