/**
 * In-memory LRU cache for AI understanding results.
 *
 * Single-instance deployment — no Redis needed. Saves an OpenAI round-trip
 * when the same (normalized) query is repeated within the TTL window.
 *
 * Normalization: trim + collapse whitespace. Case is preserved (Chinese/
 * Japanese are case-insensitive anyway; we keep English case for display).
 */

import type { UnderstandingResult } from '@/lib/ai/types'

const MAX_ENTRIES = 500
const TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  result: UnderstandingResult
  expiresAt: number
}

/** Normalize query for cache key: trim + collapse internal whitespace. */
function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ')
}

/**
 * Simple LRU Map. On every get/set the accessed key is moved to the end
 * (most-recent). When the map exceeds MAX_ENTRIES the first (oldest) key
 * is evicted.
 */
const cache = new Map<string, CacheEntry>()

export function getCachedUnderstanding(query: string): UnderstandingResult | null {
  const key = normalizeQuery(query)
  const entry = cache.get(key)
  if (!entry) return null

  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }

  // Move to end (most-recently used)
  cache.delete(key)
  cache.set(key, entry)
  return entry.result
}

/**
 * Cache a successful understanding result. Only caches results where
 * `source` is 'openai' (not fallback/error results).
 */
/** Test-only: clear the entire cache. */
export function __clearCacheForTests(): void {
  cache.clear()
}

export function setCachedUnderstanding(query: string, result: UnderstandingResult): void {
  if (result.source !== 'openai') return

  const key = normalizeQuery(query)

  // Evict oldest if at capacity
  if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }

  cache.set(key, {
    result,
    expiresAt: Date.now() + TTL_MS,
  })
}
