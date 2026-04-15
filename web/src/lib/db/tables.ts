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
 *   - user_feedback    — thumbs up/down + optional human reply per answer
 *   - cases            — Phase 3: lightweight case tracking with assignee /
 *                        due date / status. Auto-created when a query routes
 *                        to handoff; can also be created manually from /cases.
 *   - templates        — Phase 3: reusable answer-template library. Staff can
 *                        insert a template into a handoff reply and/or promote
 *                        a successful writeback into a new template.
 *   - live_faqs        — Phase 3: staff-authored FAQ entries that the retriever
 *                        merges with the seeded SEED_FAQS at query time. This
 *                        closes the sense → cluster → review → publish loop so
 *                        new knowledge lands in production without a redeploy.
 *
 * All operations are synchronous + best-effort. Write errors are logged and
 * swallowed so they cannot break the user-facing request path.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { CandidateState, EventType, SourceType } from '@/lib/domain/enums'
import { coerceCandidateState } from '@/lib/domain/enums'

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
  /** Spec §6.3 — required. New writes must set this. */
  updatedAt?: string
  source: 'handoff' | 'user_feedback' | 'sensing'
  sourceHandoffId?: string
  sourceFeedbackId?: string
  sourceQueryText: string
  detectedLanguage: 'en' | 'zh' | 'ja'
  candidateTitle: string
  candidateAnswer: string
  riskLevel: string
  /**
   * Legacy free-string status kept for back-compat with older JSONL rows.
   * New code SHOULD read/write `state` instead. `status` is derived from
   * `state` on write.
   */
  status: 'pending_review' | 'promoted' | 'rejected'
  /** Spec §6.1 canonical lifecycle state. */
  state?: CandidateState
  /** Spec §6.3 optional review note captured by staff. */
  reviewNote?: string
  createdBy: string
  // ---- Sensing / cluster-derived fields (optional) ----
  clusterSignature?: string
  clusterSize?: number
  clusterQueries?: string[]
  notes?: string
  // Set when a candidate has been published into the live knowledge base.
  publishedLiveFaqId?: string
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
  // ---- Phase 2 / §7.2 extended writeback fields ----
  resolutionSummary?: string | null
  shouldCreateFaq?: boolean
  shouldUpdateFaq?: boolean
  shouldAddRule?: boolean
  shouldAddSource?: boolean
  notes?: string | null
  category?: string | null
  subtopic?: string | null
}

// ============================================================
// cases (Phase 3: lightweight case tracking)
// ============================================================

export type CaseStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'

export interface CaseRow {
  id: string
  createdAt: string
  updatedAt: string
  queryText: string
  language: 'en' | 'zh' | 'ja'
  category: string | null
  subtopic: string | null
  status: CaseStatus
  riskLevel: string
  assignee: string | null
  dueDate: string | null            // ISO date
  notes: string | null
  sourceUserQueryId: string | null  // links back to user_queries
  sourceHandoffId: string | null    // when auto-created from a handoff
  resolutionSummary: string | null
  resolvedAt: string | null
}

// ============================================================
// events (Spec v1 §8: durable audit events)
// ============================================================

/**
 * Durable audit event. Spec §8 requires these to be PERSISTED, not just
 * logged. Every JTG lifecycle signal (query received, candidate created,
 * publish succeeded/failed, retrieval source hit) emits one row here.
 */
export interface EventRow {
  id: string
  timestamp: string
  eventType: EventType
  route: string | null
  relatedIds: {
    queryId?: string
    candidateId?: string
    liveFaqId?: string
    cardId?: string
    sourceId?: string
    handoffId?: string
    sessionId?: string
  }
  metadata: Record<string, unknown>
}

// ============================================================
// live_faqs (Phase 3: published knowledge overlay)
// ============================================================

export interface LocalizedText3 {
  en: string
  zh: string
  ja: string
}

/**
 * Card entropy tier — v4 改进 #1.
 *   A = one-sentence answer (token ≤ 80), router returns directly, skips LLM.
 *   B = short procedural answer (≤ 5 steps), router returns directly, skips LLM.
 *   C = needs AI judgement → injected as context into the AI understanding layer.
 *
 * Unknown / missing = treated as C to stay safe.
 */
export type FaqTier = 'A' | 'B' | 'C'

/**
 * Source-type contract — v4 改进 #6.
 *   STATIC      — hand-curated knowledge card (seed FAQ or staff-published live FAQ).
 *   REALTIME    — fetched from a live API (listings, visa status, etc.); must be time-tagged.
 *   AI_INFERRED — model-generated fallback; must be labelled to the user.
 *
 * Every knowledge artifact that enters the answer pipeline carries one of
 * these tags so the answer layer never silently mixes them.
 */
// SourceType is defined in @/lib/domain/enums and imported at the top of
// this file. We re-export it at the bottom so existing `import {SourceType}
// from '@/lib/db/tables'` call sites keep working without a rewrite.

export interface LiveFaqRow {
  id: string
  createdAt: string
  updatedAt: string
  createdBy: string
  category: 'renting' | 'home_buying' | 'visa' | 'daily_life' | 'other'
  subtopic: string
  riskLevel: 'low' | 'medium' | 'high'
  /** Card entropy tier. Defaults to 'C' on legacy rows. */
  tier: FaqTier
  /** Provenance class. Published live FAQs are always STATIC. */
  sourceType: SourceType
  /**
   * Confidence half-life in days. After this interval the card is treated as
   * stale and re-routed through the AI layer. Null = never expires.
   */
  confidenceHalfLifeDays: number | null
  representative_title: LocalizedText3
  standard_answer: LocalizedText3
  next_step_confirm: LocalizedText3
  next_step_prepare: LocalizedText3
  next_step_contact: LocalizedText3
  next_step_warning: LocalizedText3 | null
  keywords: { en: string[]; zh: string[]; ja: string[] }
  sourceFaqCandidateId: string | null
  status: 'active' | 'archived'
}

// ============================================================
// templates (Phase 3: reusable answer-template library)
// ============================================================

export type TemplateStatus = 'draft' | 'active' | 'archived'

export interface TemplateRow {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  body: string
  language: 'en' | 'zh' | 'ja'
  category: string | null
  tags: string[]
  status: TemplateStatus
  useCount: number
  createdBy: string
  sourceHandoffId: string | null
  sourceFeedbackId: string | null
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

/**
 * Map the legacy free-string `status` (pending_review/promoted/rejected)
 * onto the spec §3.2 canonical `state`. This keeps old JSONL rows readable
 * after the v1 spec upgrade — sensing-sourced rows become CLUSTERED;
 * handoff/user_feedback sourced rows become NEW; promoted → PUBLISHED;
 * rejected → REJECTED.
 */
function deriveStateFromStatus(row: FaqCandidateRow): CandidateState {
  if (row.state) return row.state
  if (row.status === 'promoted') return 'PUBLISHED'
  if (row.status === 'rejected') return 'REJECTED'
  // pending_review: sensing clusters start in CLUSTERED, everything else NEW.
  return row.source === 'sensing' ? 'CLUSTERED' : 'NEW'
}

/** Derive the legacy `status` from the canonical `state`. */
function statusFromState(state: CandidateState): FaqCandidateRow['status'] {
  if (state === 'PUBLISHED') return 'promoted'
  if (state === 'REJECTED') return 'rejected'
  return 'pending_review'
}

/** Fill in `state` / `updatedAt` on legacy rows at read time. */
function normalizeCandidateRow(row: FaqCandidateRow): FaqCandidateRow {
  return {
    ...row,
    state: coerceCandidateState(row.state ?? deriveStateFromStatus(row)),
    updatedAt: row.updatedAt ?? row.createdAt,
  }
}

export function insertFaqCandidate(
  row: Omit<FaqCandidateRow, 'id' | 'createdAt' | 'status' | 'state'> & {
    state?: CandidateState
  },
): FaqCandidateRow {
  const now = new Date().toISOString()
  const state: CandidateState =
    row.state ?? (row.source === 'sensing' ? 'CLUSTERED' : 'NEW')
  const full: FaqCandidateRow = {
    id: newId('fc'),
    createdAt: now,
    updatedAt: now,
    status: statusFromState(state),
    state,
    ...row,
  }
  // Re-assert state after spread so callers can't accidentally override it
  // back to a stale value via the legacy fields.
  full.state = state
  full.status = statusFromState(state)
  appendRow('faq_candidates', full)
  return full
}

/**
 * Apply a state transition atomically by rewriting the candidates table.
 * Returns null if the candidate doesn't exist — caller must translate that
 * into a structured error. Callers should validate the transition with
 * `canTransition` BEFORE calling this helper (the helper does no validation;
 * it only writes).
 */
export function setCandidateState(
  id: string,
  state: CandidateState,
  patch: { reviewNote?: string; publishedLiveFaqId?: string } = {},
): FaqCandidateRow | null {
  const rows = readAll<FaqCandidateRow>('faq_candidates')
  const idx = rows.findIndex((r) => r.id === id)
  if (idx < 0) return null
  const updated: FaqCandidateRow = {
    ...rows[idx],
    state,
    status: statusFromState(state),
    updatedAt: new Date().toISOString(),
  }
  if (patch.reviewNote != null) updated.reviewNote = patch.reviewNote
  if (patch.publishedLiveFaqId != null)
    updated.publishedLiveFaqId = patch.publishedLiveFaqId
  rows[idx] = updated
  rewriteAll('faq_candidates', rows)
  return updated
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
  filter?: {
    status?: FaqCandidateRow['status']
    state?: CandidateState
  },
): FaqCandidateRow[] {
  const rows = readAll<FaqCandidateRow>('faq_candidates').map(
    normalizeCandidateRow,
  )
  let out = rows
  if (filter?.status) out = out.filter((r) => r.status === filter.status)
  if (filter?.state) out = out.filter((r) => r.state === filter.state)
  return out.slice().reverse()
}

// ============================================================
// cases
// ============================================================

export function insertCase(
  row: Omit<CaseRow, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'resolvedAt'> & {
    status?: CaseStatus
  },
): CaseRow {
  const now = new Date().toISOString()
  const full: CaseRow = {
    id: newId('case'),
    createdAt: now,
    updatedAt: now,
    status: row.status ?? 'open',
    resolvedAt: null,
    ...row,
  }
  appendRow('cases', full)
  return full
}

export function listCases(filter?: {
  status?: CaseStatus
  assignee?: string
  language?: 'en' | 'zh' | 'ja'
}): CaseRow[] {
  const rows = readAll<CaseRow>('cases')
  let out = rows
  if (filter?.status) out = out.filter((r) => r.status === filter.status)
  if (filter?.assignee) out = out.filter((r) => r.assignee === filter.assignee)
  if (filter?.language) out = out.filter((r) => r.language === filter.language)
  return out.slice().reverse()
}

export function getCase(id: string): CaseRow | null {
  const rows = readAll<CaseRow>('cases')
  return rows.find((r) => r.id === id) ?? null
}

export function updateCase(
  id: string,
  patch: Partial<
    Pick<CaseRow, 'status' | 'assignee' | 'dueDate' | 'notes' | 'resolutionSummary' | 'category' | 'subtopic'>
  >,
): CaseRow | null {
  const rows = readAll<CaseRow>('cases')
  const idx = rows.findIndex((r) => r.id === id)
  if (idx < 0) return null
  const prev = rows[idx]
  const updated: CaseRow = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
    resolvedAt:
      (patch.status === 'resolved' || patch.status === 'closed') && !prev.resolvedAt
        ? new Date().toISOString()
        : prev.resolvedAt,
  }
  rows[idx] = updated
  rewriteAll('cases', rows)
  return updated
}

// ============================================================
// live_faqs CRUD
// ============================================================

export function insertLiveFaq(
  row: Omit<
    LiveFaqRow,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'status'
    | 'tier'
    | 'sourceType'
    | 'confidenceHalfLifeDays'
  > & {
    status?: LiveFaqRow['status']
    tier?: FaqTier
    sourceType?: SourceType
    confidenceHalfLifeDays?: number | null
  },
): LiveFaqRow {
  const now = new Date().toISOString()
  const full: LiveFaqRow = {
    id: newId('lfaq'),
    createdAt: now,
    updatedAt: now,
    status: row.status ?? 'active',
    // Default tier C so a row published without an explicit tier stays on the
    // conservative (LLM-routed) path — never "accidentally" skip the AI layer.
    tier: row.tier ?? 'C',
    // Staff-published live FAQs are always STATIC provenance; REALTIME/
    // AI_INFERRED rows are produced by other pipelines, not this endpoint.
    sourceType: row.sourceType ?? 'STATIC',
    confidenceHalfLifeDays: row.confidenceHalfLifeDays ?? null,
    ...row,
  }
  appendRow('live_faqs', full)
  return full
}

/**
 * Legacy rows written before v4 don't carry tier / sourceType / half-life.
 * Fill them in on read so the rest of the code can assume the v4 shape.
 */
function normalizeLiveFaqRow(row: LiveFaqRow): LiveFaqRow {
  return {
    ...row,
    tier: row.tier ?? 'C',
    sourceType: row.sourceType ?? 'STATIC',
    confidenceHalfLifeDays: row.confidenceHalfLifeDays ?? null,
  }
}

export function listLiveFaqs(filter?: {
  status?: LiveFaqRow['status']
  category?: LiveFaqRow['category']
}): LiveFaqRow[] {
  const rows = readAll<LiveFaqRow>('live_faqs').map(normalizeLiveFaqRow)
  let out = rows
  if (filter?.status) out = out.filter((r) => r.status === filter.status)
  if (filter?.category) out = out.filter((r) => r.category === filter.category)
  return out.slice().reverse()
}

export function getLiveFaq(id: string): LiveFaqRow | null {
  const rows = readAll<LiveFaqRow>('live_faqs')
  return rows.find((r) => r.id === id) ?? null
}

export function updateLiveFaqStatus(
  id: string,
  status: LiveFaqRow['status'],
): LiveFaqRow | null {
  const rows = readAll<LiveFaqRow>('live_faqs')
  const idx = rows.findIndex((r) => r.id === id)
  if (idx < 0) return null
  rows[idx] = { ...rows[idx], status, updatedAt: new Date().toISOString() }
  rewriteAll('live_faqs', rows)
  return rows[idx]
}

// ============================================================
// templates CRUD
// ============================================================

export function insertTemplate(
  row: Omit<TemplateRow, 'id' | 'createdAt' | 'updatedAt' | 'useCount'> & {
    useCount?: number
  },
): TemplateRow {
  const now = new Date().toISOString()
  const full: TemplateRow = {
    id: newId('tpl'),
    createdAt: now,
    updatedAt: now,
    useCount: row.useCount ?? 0,
    ...row,
  }
  appendRow('templates', full)
  return full
}

export function listTemplates(filter?: {
  status?: TemplateStatus
  language?: 'en' | 'zh' | 'ja'
  category?: string
  q?: string
}): TemplateRow[] {
  const rows = readAll<TemplateRow>('templates')
  let out = rows
  if (filter?.status) out = out.filter((r) => r.status === filter.status)
  if (filter?.language) out = out.filter((r) => r.language === filter.language)
  if (filter?.category) out = out.filter((r) => r.category === filter.category)
  if (filter?.q) {
    const q = filter.q.toLowerCase()
    out = out.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.body.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }
  // Active first, then by useCount desc, then by createdAt desc.
  return out.slice().sort((a, b) => {
    const aa = a.status === 'active' ? 0 : a.status === 'draft' ? 1 : 2
    const bb = b.status === 'active' ? 0 : b.status === 'draft' ? 1 : 2
    if (aa !== bb) return aa - bb
    if (b.useCount !== a.useCount) return b.useCount - a.useCount
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export function getTemplate(id: string): TemplateRow | null {
  const rows = readAll<TemplateRow>('templates')
  return rows.find((r) => r.id === id) ?? null
}

export function updateTemplate(
  id: string,
  patch: Partial<
    Pick<
      TemplateRow,
      'title' | 'body' | 'language' | 'category' | 'tags' | 'status'
    >
  >,
): TemplateRow | null {
  const rows = readAll<TemplateRow>('templates')
  const idx = rows.findIndex((r) => r.id === id)
  if (idx < 0) return null
  rows[idx] = {
    ...rows[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  rewriteAll('templates', rows)
  return rows[idx]
}

export function deleteTemplate(id: string): boolean {
  const rows = readAll<TemplateRow>('templates')
  const next = rows.filter((r) => r.id !== id)
  if (next.length === rows.length) return false
  rewriteAll('templates', next)
  return true
}

/**
 * Increment `useCount` when a staff member inserts a template into a reply.
 * Best-effort — missing id is a no-op.
 */
export function incrementTemplateUse(id: string): TemplateRow | null {
  const rows = readAll<TemplateRow>('templates')
  const idx = rows.findIndex((r) => r.id === id)
  if (idx < 0) return null
  rows[idx] = {
    ...rows[idx],
    useCount: rows[idx].useCount + 1,
    updatedAt: new Date().toISOString(),
  }
  rewriteAll('templates', rows)
  return rows[idx]
}

// ============================================================
// evidence (v5 改进 #5: Evidence Registry)
// ============================================================

/**
 * Structured evidence record. Every piece of proof — a government
 * brochure, on-site photo, official website screenshot — gets one row
 * here. The evidence registry is the "trust backbone" (v5 §2): the
 * system never cites an uncaptured source.
 */
export type EvidenceType =
  | 'official_brochure'
  | 'government_website'
  | 'on_site_photo'
  | 'window_inquiry'
  | 'other'
export type EvidenceConfidence = 'official' | 'verified' | 'unverified'
export type EvidenceStatus = 'active' | 'expired' | 'archived'

export interface EvidenceRecord {
  id: string
  type: EvidenceType
  /** Topic tags for retrieval matching (e.g. ['地価', '公示価格']). */
  topicTags: string[]
  /** Location scope; null = nationwide. */
  location: string | null
  /** ISO-8601 date when this evidence was collected. */
  dateCollected: string
  contentSummary: string
  sourceUrl: string | null
  filePath: string | null
  confidenceLevel: EvidenceConfidence
  /** ISO-8601 date after which this evidence should be re-verified. Null = never expires. */
  expiryDate: string | null
  /** Card IDs this evidence backs. */
  linkedCardIds: string[]
  createdAt: string
  updatedAt: string
  status: EvidenceStatus
}

export function insertEvidence(
  row: Omit<EvidenceRecord, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
    status?: EvidenceStatus
  },
): EvidenceRecord {
  const now = new Date().toISOString()
  const full: EvidenceRecord = {
    id: newId('ev_rec'),
    createdAt: now,
    updatedAt: now,
    status: row.status ?? 'active',
    ...row,
  }
  appendRow('evidence', full)
  return full
}

export function listEvidence(filter?: {
  status?: EvidenceStatus
  type?: EvidenceType
  topicTag?: string
  notExpired?: boolean
}): EvidenceRecord[] {
  const rows = readAll<EvidenceRecord>('evidence')
  let out = rows
  if (filter?.status) out = out.filter((r) => r.status === filter.status)
  if (filter?.type) out = out.filter((r) => r.type === filter.type)
  if (filter?.topicTag) {
    const tag = filter.topicTag.toLowerCase()
    out = out.filter((r) =>
      r.topicTags.some((t) => t.toLowerCase().includes(tag)),
    )
  }
  if (filter?.notExpired) {
    const now = Date.now()
    out = out.filter(
      (r) => !r.expiryDate || Date.parse(r.expiryDate) > now,
    )
  }
  return out.slice().reverse()
}

export function getEvidence(id: string): EvidenceRecord | null {
  const rows = readAll<EvidenceRecord>('evidence')
  return rows.find((r) => r.id === id) ?? null
}

export function updateEvidenceStatus(
  id: string,
  status: EvidenceStatus,
): EvidenceRecord | null {
  const rows = readAll<EvidenceRecord>('evidence')
  const idx = rows.findIndex((r) => r.id === id)
  if (idx < 0) return null
  rows[idx] = { ...rows[idx], status, updatedAt: new Date().toISOString() }
  rewriteAll('evidence', rows)
  return rows[idx]
}

/**
 * Link an evidence record to a knowledge card. Appends the cardId to
 * linkedCardIds (deduped). Returns null if the evidence id doesn't exist.
 */
export function linkEvidenceToCard(
  evidenceId: string,
  cardId: string,
): EvidenceRecord | null {
  const rows = readAll<EvidenceRecord>('evidence')
  const idx = rows.findIndex((r) => r.id === evidenceId)
  if (idx < 0) return null
  const existing = rows[idx].linkedCardIds ?? []
  if (!existing.includes(cardId)) {
    rows[idx] = {
      ...rows[idx],
      linkedCardIds: [...existing, cardId],
      updatedAt: new Date().toISOString(),
    }
    rewriteAll('evidence', rows)
  }
  return rows[idx]
}

// ============================================================
// Aggregate stats (for /review)
// ============================================================

export function getReviewStats() {
  const queries = readAll<UserQueryRow>('user_queries')
  const handoffs = readAll<HandoffRow>('handoff_queue')
  const candidates = readAll<FaqCandidateRow>('faq_candidates')
  const feedback = readAll<UserFeedbackRow>('user_feedback')
  const cases = readAll<CaseRow>('cases')
  const templates = readAll<TemplateRow>('templates')
  const liveFaqs = readAll<LiveFaqRow>('live_faqs')

  const byMode: Record<string, number> = {}
  const byLang: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  const byFaqId: Record<string, number> = {}
  const noMatchQueries: string[] = []
  const highRiskQueries: string[] = []
  const dailyCounts: Record<string, number> = {} // YYYY-MM-DD → count

  for (const e of queries) {
    byMode[e.answerMode] = (byMode[e.answerMode] || 0) + 1
    byLang[e.detectedLanguage] = (byLang[e.detectedLanguage] || 0) + 1
    if (e.topFaqCategory) byCategory[e.topFaqCategory] = (byCategory[e.topFaqCategory] || 0) + 1
    if (e.topFaqId) byFaqId[e.topFaqId] = (byFaqId[e.topFaqId] || 0) + 1
    if (!e.knowledgeFound) noMatchQueries.push(e.queryText)
    if (e.riskLevel === 'high' || e.shouldEscalate) highRiskQueries.push(e.queryText)
    const day = (e.timestamp || '').slice(0, 10)
    if (day) dailyCounts[day] = (dailyCounts[day] || 0) + 1
  }

  const topFaqs = Object.entries(byFaqId)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // Last 7 days, oldest → newest
  const last7Days: Array<{ date: string; count: number }> = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    last7Days.push({ date: key, count: dailyCounts[key] || 0 })
  }

  // Satisfaction rate from feedback table
  const satisfiedCount = feedback.filter((f) => f.isSatisfied).length
  const dissatisfiedCount = feedback.filter((f) => !f.isSatisfied).length
  const satisfactionRate =
    feedback.length > 0 ? Math.round((satisfiedCount / feedback.length) * 100) : null

  // Case stats
  const casesByStatus: Record<string, number> = {}
  for (const c of cases) casesByStatus[c.status] = (casesByStatus[c.status] || 0) + 1

  // Average time-to-resolve (resolved cases only), in hours
  const resolvedCases = cases.filter((c) => c.resolvedAt && c.createdAt)
  const avgResolveHours =
    resolvedCases.length > 0
      ? Math.round(
          (resolvedCases.reduce((acc, c) => {
            const start = new Date(c.createdAt).getTime()
            const end = new Date(c.resolvedAt as string).getTime()
            return acc + Math.max(0, end - start)
          }, 0) /
            resolvedCases.length /
            3_600_000) *
            10,
        ) / 10
      : null

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
    // ---- Phase 2/3 additions ----
    feedbackTotal: feedback.length,
    feedbackSatisfied: satisfiedCount,
    feedbackDissatisfied: dissatisfiedCount,
    satisfactionRate, // 0–100 or null
    last7Days,
    cases: {
      total: cases.length,
      byStatus: casesByStatus,
      avgResolveHours,
    },
    templates: {
      total: templates.length,
      active: templates.filter((t) => t.status === 'active').length,
      draft: templates.filter((t) => t.status === 'draft').length,
      archived: templates.filter((t) => t.status === 'archived').length,
    },
    liveFaqs: {
      total: liveFaqs.length,
      active: liveFaqs.filter((f) => f.status === 'active').length,
      archived: liveFaqs.filter((f) => f.status === 'archived').length,
    },
    dataDir: DATA_DIR,
  }
}

/**
 * FAQ candidate review actions — Phase 2 mapping_reviews surface.
 * Updates the row's status in place.
 */
export function updateFaqCandidateStatus(
  id: string,
  status: FaqCandidateRow['status'],
): FaqCandidateRow | null {
  const rows = readAll<FaqCandidateRow>('faq_candidates')
  const idx = rows.findIndex((r) => r.id === id)
  if (idx < 0) return null
  rows[idx] = { ...rows[idx], status }
  rewriteAll('faq_candidates', rows)
  return rows[idx]
}

/** Fetch a candidate by id (scans the small JSONL table). */
export function getFaqCandidate(id: string): FaqCandidateRow | null {
  const rows = readAll<FaqCandidateRow>('faq_candidates').map(
    normalizeCandidateRow,
  )
  return rows.find((r) => r.id === id) ?? null
}

/**
 * Marks a candidate as PUBLISHED and records the published live-FAQ id.
 * Used by the publish endpoint after the live_faqs row is inserted.
 * Spec §7.2 — acceptance rule: a PUBLISHED candidate MUST carry a
 * non-null publishedLiveFaqId.
 */
export function markFaqCandidatePublished(
  id: string,
  publishedLiveFaqId: string,
): FaqCandidateRow | null {
  const rows = readAll<FaqCandidateRow>('faq_candidates')
  const idx = rows.findIndex((r) => r.id === id)
  if (idx < 0) return null
  rows[idx] = {
    ...rows[idx],
    state: 'PUBLISHED',
    status: 'promoted',
    publishedLiveFaqId,
    updatedAt: new Date().toISOString(),
  }
  rewriteAll('faq_candidates', rows)
  return rows[idx]
}

// ============================================================
// events CRUD — Spec §8 durable audit events
// ============================================================

export function insertEvent(
  row: Omit<EventRow, 'id' | 'timestamp'> & { timestamp?: string },
): EventRow {
  const full: EventRow = {
    id: newId('ev'),
    timestamp: row.timestamp ?? new Date().toISOString(),
    eventType: row.eventType,
    route: row.route ?? null,
    relatedIds: row.relatedIds ?? {},
    metadata: row.metadata ?? {},
  }
  appendRow('events', full)
  return full
}

export function listEvents(filter?: {
  eventType?: EventType
  candidateId?: string
  liveFaqId?: string
  /** ISO-8601 inclusive lower bound. Added for P1 daily-summary endpoint. */
  since?: string
  limit?: number
}): EventRow[] {
  const rows = readAll<EventRow>('events')
  let out = rows
  if (filter?.eventType)
    out = out.filter((r) => r.eventType === filter.eventType)
  if (filter?.candidateId)
    out = out.filter((r) => r.relatedIds?.candidateId === filter.candidateId)
  if (filter?.liveFaqId)
    out = out.filter((r) => r.relatedIds?.liveFaqId === filter.liveFaqId)
  if (filter?.since) {
    const sinceMs = Date.parse(filter.since)
    if (Number.isFinite(sinceMs)) {
      out = out.filter((r) => Date.parse(r.timestamp) >= sinceMs)
    }
  }
  const limit = filter?.limit ?? 500
  return out.slice(-limit).reverse()
}

/**
 * Delete a live_faq row by id. Used by the publish endpoint's compensating
 * path when the candidate-state write fails after the live_faq insert (Spec
 * §7). Returns true if a row was removed.
 */
export function deleteLiveFaq(id: string): boolean {
  const rows = readAll<LiveFaqRow>('live_faqs')
  const next = rows.filter((r) => r.id !== id)
  if (next.length === rows.length) return false
  rewriteAll('live_faqs', next)
  return true
}

// Re-export domain types so consumers only need to import from @/lib/db/tables.
export type { CandidateState, EventType, SourceType }
