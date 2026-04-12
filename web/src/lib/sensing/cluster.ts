/**
 * Sensing cluster — groups repeated no-match queries so staff can spot
 * high-frequency gaps in the knowledge base.
 *
 * Pure function. Takes the raw `user_queries` rows and returns a list of
 * clusters with `{signature, sampleQuery, count, byLanguage, queries}`.
 * The clusterer is deterministic and cheap (one pass). It's good enough
 * for the signal "this question has now been asked 5 times today and we
 * still have no answer"; it is NOT a replacement for embeddings.
 *
 * Clustering key:
 *   1. lower-case
 *   2. strip punctuation + extra whitespace
 *   3. collapse digits to '#' so "budget 100000" and "budget 80000" cluster
 *   4. take the first N significant tokens (default 4) to form the signature
 *
 * For CJK text with no spaces we fall back to a character-trigram signature
 * so Chinese and Japanese queries can still cluster meaningfully.
 */

import type { UserQueryRow } from '@/lib/db/tables'

export interface Cluster {
  signature: string
  sampleQuery: string
  count: number
  byLanguage: Record<string, number>
  queries: string[]
  firstSeen: string
  lastSeen: string
}

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'to',
  'of',
  'for',
  'and',
  'or',
  'in',
  'on',
  'how',
  'what',
  'when',
  'where',
  'why',
  'do',
  'does',
  'can',
  'i',
  'my',
  'me',
  '我',
  '的',
  '是',
  '吗',
  'を',
  'が',
  'の',
  'に',
  'は',
])

/** Collapse punctuation, numbers, whitespace. Lowercase. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0-9]+/g, '#')
    .replace(/[^\p{L}\p{N}#\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Signature: first 4 significant tokens, or char trigram fallback for CJK. */
export function clusterSignature(text: string, nTokens = 4): string {
  const norm = normalize(text)
  if (!norm) return ''

  // Split on whitespace. For CJK-heavy queries this often yields just one
  // "word" because CJK has no spaces — detect that and use a trigram instead.
  const tokens = norm.split(' ').filter((t) => t && !STOP_WORDS.has(t))
  if (tokens.length >= 2) {
    return tokens.slice(0, nTokens).join(' ')
  }

  // Char-level trigram signature. Strip # to avoid collapsing distinct
  // numeric anchors into the same bucket.
  const chars = norm.replace(/[\s#]/g, '')
  if (chars.length < 3) return chars
  const grams: string[] = []
  for (let i = 0; i <= chars.length - 3 && grams.length < 3; i++) {
    grams.push(chars.slice(i, i + 3))
  }
  return grams.join('|')
}

export interface ClusterOptions {
  /** Only include queries where knowledgeFound === false. Default true. */
  noMatchOnly?: boolean
  /** Drop clusters smaller than this. Default 2. */
  minCount?: number
  /** Max clusters to return (largest first). Default 50. */
  limit?: number
}

/**
 * Group user_queries rows into clusters. Returns the biggest clusters first.
 */
export function clusterNoMatchQueries(
  rows: UserQueryRow[],
  options: ClusterOptions = {},
): Cluster[] {
  const noMatchOnly = options.noMatchOnly ?? true
  const minCount = options.minCount ?? 2
  const limit = options.limit ?? 50

  const pool = noMatchOnly ? rows.filter((r) => !r.knowledgeFound) : rows
  const buckets = new Map<string, Cluster>()

  for (const row of pool) {
    const text = row.queryText || ''
    if (!text) continue
    const sig = clusterSignature(text)
    if (!sig) continue

    const existing = buckets.get(sig)
    if (existing) {
      existing.count++
      existing.queries.push(text)
      existing.byLanguage[row.detectedLanguage] =
        (existing.byLanguage[row.detectedLanguage] || 0) + 1
      if (row.timestamp > existing.lastSeen) existing.lastSeen = row.timestamp
      if (row.timestamp < existing.firstSeen) existing.firstSeen = row.timestamp
    } else {
      buckets.set(sig, {
        signature: sig,
        sampleQuery: text,
        count: 1,
        byLanguage: { [row.detectedLanguage]: 1 },
        queries: [text],
        firstSeen: row.timestamp,
        lastSeen: row.timestamp,
      })
    }
  }

  return Array.from(buckets.values())
    .filter((c) => c.count >= minCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
