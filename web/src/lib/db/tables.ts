/**
 * File-backed JSONL "tables" — minimum viable persistence layer.
 *
 * Each table is an append-only JSONL file on the writable filesystem.
 *
 * Backend selection at module load time:
 *   - On Vercel (VERCEL=1): `/tmp` — survives across warm Fluid Compute
 *     invocations on the same instance. Cold starts wipe `/tmp`.
 *   - Local dev: `<repo>/web/.data` — persistent across restarts.
 *
 * [KNOWN LIMITATION] On Vercel, `/tmp` is per-instance and ephemeral across
 * cold starts. This is an explicit Phase-1 trade-off so the data loop closes
 * today without blocking on DB provisioning. The table abstraction is stable:
 * Phase 2 swaps the backend to Vercel Blob / Postgres / Neon without touching
 * any caller.
 *
 * Tables:
 *   - user_queries     — every router invocation (required by the data loop)
 *   - handoff_queue    — open/resolved staff escalations
 *   - faq_candidates   — candidate FAQs created from staff writeback
 *
 * All operations are synchronous + best-effort. Write errors are logged and
 * swallowed so they cannot break the user-facing request path.
 */

import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR =
  process.env.VERCEL === '1'
    ? '/tmp'
    : path.join(process.cwd(), '.data')

function ensureDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
  } catch (err) {
    // Logged, not thrown — the caller path must not break.
    console.error('[tables] ensureDir failed', err)
  }
}

function filePath(table: string): string {
  return path.join(DATA_DIR, `${table}.jsonl`)
}

function appendRow<T>(table: string, row: T): void {
  ensureDir()
  try {
    fs.appendFileSync(filePath(table), JSON.stringify(row) + '\n', 'utf8')
  } catch (err) {
    console.error(`[tables] append ${table} failed`, err)
  }
}

function readAll<T>(table: string): T[] {
  try {
    if (!fs.existsSync(filePath(table))) return []
    const raw = fs.readFileSync(filePath(table), 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const rows: T[] = []
    for (const line of lines) {
      try {
        rows.push(JSON.parse(line) as T)
      } catch {
        // skip corrupt line
      }
    }
    return rows
  } catch (err) {
    console.error(`[tables] read ${table} failed`, err)
    return []
  }
}

/**
 * Rewrite a table by applying `transform` to every row. Used by `update`
 * operations (JSONL is append-only, so updates require a full rewrite).
 */
function rewriteAll<T>(table: string, rows: T[]): void {
  ensureDir()
  try {
    const payload = rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '')
    fs.writeFileSync(filePath(table), payload, 'utf8')
  } catch (err) {
    console.error(`[tables] rewrite ${table} failed`, err)
  }
}

// ============================================================
// Schemas
// ============================================================

export interface UserQueryRow {
  id: string
  timestamp: string
  queryText: string
  detectedLanguage: 'en' | 'zh' | 'ja'
  answerMode: string
  riskLevel: string
  confidenceBand: string
  shouldEscalate: boolean
  knowledgeFound: boolean
  topFaqId: string | null
  topFaqCategory: string | null
  topScore: number
  matchCount: number
  selectedRuleKeys: string[]
  sessionId?: string
}

export interface HandoffRow {
  id: string
  userQueryId: string
  timestamp: string
  queryText: string
  detectedLanguage: 'en' | 'zh' | 'ja'
  answerMode: string
  riskLevel: string
  reason: string
  status: 'open' | 'in_progress' | 'resolved'
  humanReply?: string
  resolution?: string
  resolvedAt?: string
  resolvedBy?: string
  faqCandidateId?: string
  sessionId?: string
}

export interface FaqCandidateRow {
  id: string
  createdAt: string
  source: 'handoff' | 'user_feedback'
  sourceHandoffId?: string
  sourceFeedbackId?: string
  sourceQueryText: string
  detectedLanguage: 'en' | 'zh' | 'ja'
  candidateTitle: string
  candidateAnswer: string
  riskLevel: string
  status: 'pending_review' | 'promoted' | 'rejected'
  createdBy: string
}

export interface UserFeedbackRow {
  id: string
  createdAt: string
  queryText: string
  systemAnswer: string
  answerMode: string
  isSatisfied: boolean
  humanReply: string | null
  language: 'en' | 'zh' | 'ja'
}

// ============================================================
// user_queries
// ============================================================

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function insertUserQuery(row: Omit<UserQueryRow, 'id'>): UserQueryRow {
  const full: UserQueryRow = { id: newId('q'), ...row }
  appendRow('user_queries', full)
  return full
}

export function listUserQueries(limit = 200): UserQueryRow[] {
  const rows = readAll<UserQueryRow>('user_queries')
  return rows.slice(-limit).reverse()
}

// ============================================================
// handoff_queue
// ============================================================

export function insertHandoff(row: Omit<HandoffRow, 'id' | 'status'>): HandoffRow {
  const full: HandoffRow = { id: newId('hf'), status: 'open', ...row }
  appendRow('handoff_queue', full)
  return full
}

export function listHandoffs(status?: HandoffRow['status']): HandoffRow[] {
  const rows = readAll<HandoffRow>('handoff_queue')
  const filtered = status ? rows.filter((r) => r.status === status) : rows
  return filtered.slice().reverse()
}

export function getHandoff(id: string): HandoffRow | null {
  const rows = readAll<HandoffRow>('handoff_queue')
  return rows.find((r) => r.id === id) ?? null
}

/**
 * Resolve a handoff with the staff writeback. Rewrites the table so the
 * resolved row replaces the open one. Returns the updated row, or null if
 * the id was not found.
 */
export function resolveHandoffRow(
  id: string,
  patch: {
    humanReply: string
    resolution: string
    resolvedBy: string
    faqCandidateId?: string
  },
): HandoffRow | null {
  const rows = readAll<HandoffRow>('handoff_queue')
  const idx = rows.findIndex((r) => r.id === id)
  if (idx < 0) return null
  const updated: HandoffRow = {
    ...rows[idx],
    humanReply: patch.humanReply,
    resolution: patch.resolution,
    resolvedBy: patch.resolvedBy,
    resolvedAt: new Date().toISOString(),
    status: 'resolved',
    faqCandidateId: patch.faqCandidateId,
  }
  rows[idx] = updated
  rewriteAll('handoff_queue', rows)
  return updated
}

// ============================================================
// faq_candidates
// ============================================================

export function insertFaqCandidate(
  row: Omit<FaqCandidateRow, 'id' | 'createdAt' | 'status'>,
): FaqCandidateRow {
  const full: FaqCandidateRow = {
    id: newId('fc'),
    createdAt: new Date().toISOString(),
    status: 'pending_review',
    ...row,
  }
  appendRow('faq_candidates', full)
  return full
}

// ============================================================
// user_feedback
// ============================================================

export function insertUserFeedback(
  row: Omit<UserFeedbackRow, 'id' | 'createdAt'>,
): UserFeedbackRow {
  const full: UserFeedbackRow = {
    id: newId('fb'),
    createdAt: new Date().toISOString(),
    ...row,
  }
  appendRow('user_feedback', full)
  return full
}

export function listUserFeedback(limit = 200): UserFeedbackRow[] {
  const rows = readAll<UserFeedbackRow>('user_feedback')
  return rows.slice(-limit).reverse()
}

export function listFaqCandidates(
  status?: FaqCandidateRow['status'],
): FaqCandidateRow[] {
  const rows = readAll<FaqCandidateRow>('faq_candidates')
  const filtered = status ? rows.filter((r) => r.status === status) : rows
  return filtered.slice().reverse()
}

// ============================================================
// Aggregate stats (for /review)
// ============================================================

export function getReviewStats() {
  const queries = readAll<UserQueryRow>('user_queries')
  const handoffs = readAll<HandoffRow>('handoff_queue')
  const candidates = readAll<FaqCandidateRow>('faq_candidates')

  const byMode: Record<string, number> = {}
  const byLang: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  const byFaqId: Record<string, number> = {}
  const noMatchQueries: string[] = []
  const highRiskQueries: string[] = []

  for (const e of queries) {
    byMode[e.answerMode] = (byMode[e.answerMode] || 0) + 1
    byLang[e.detectedLanguage] = (byLang[e.detectedLanguage] || 0) + 1
    if (e.topFaqCategory) byCategory[e.topFaqCategory] = (byCategory[e.topFaqCategory] || 0) + 1
    if (e.topFaqId) byFaqId[e.topFaqId] = (byFaqId[e.topFaqId] || 0) + 1
    if (!e.knowledgeFound) noMatchQueries.push(e.queryText)
    if (e.riskLevel === 'high' || e.shouldEscalate) highRiskQueries.push(e.queryText)
  }

  const topFaqs = Object.entries(byFaqId)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  return {
    total: queries.length,
    byMode,
    byLang,
    byCategory,
    topFaqs,
    noMatchCount: noMatchQueries.length,
    noMatchSample: noMatchQueries.slice(-20).reverse(),
    highRiskCount: highRiskQueries.length,
    highRiskSample: highRiskQueries.slice(-20).reverse(),
    openHandoffs: handoffs.filter((r) => r.status === 'open').length,
    totalHandoffs: handoffs.length,
    faqCandidatesPending: candidates.filter((c) => c.status === 'pending_review').length,
    faqCandidatesTotal: candidates.length,
    dataDir: DATA_DIR,
  }
}
