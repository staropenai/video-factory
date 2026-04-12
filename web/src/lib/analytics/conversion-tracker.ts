/**
 * JTG V5 改进6 — Conversion signal tracker.
 *
 * Tracks user transitions from "knowledge consumption" to "service intent".
 * Minimal implementation — only the tracking logic and summary computation.
 * No UI.
 *
 * Signal types:
 *   - content_to_service_inquiry: used knowledge → clicked "contact us"
 *   - language_bridge_completed: completed bridge preparation
 *   - evidence_viewed: viewed official evidence
 *   - handoff_requested: requested human escalation
 *   - repeat_visit: returned within 7 days
 *
 * Pure functions: buildConversionSignal, computeWeeklySummary
 * I/O functions: recordConversionSignal, getWeeklyConversionSummary
 */

import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export type ConversionSignalType =
  | 'content_to_service_inquiry'
  | 'language_bridge_completed'
  | 'evidence_viewed'
  | 'handoff_requested'
  | 'repeat_visit'

export interface ConversionSignal {
  id: string
  signalType: ConversionSignalType
  userId?: string
  sessionId: string
  /** Number of queries in this session. */
  queryCount: number
  /** Knowledge categories touched in this session. */
  topCategories: string[]
  timestamp: string
}

export interface WeeklyConversionSummary {
  period: { from: string; to: string }
  totalSessions: number
  /** Unique signals by type. */
  byType: Record<ConversionSignalType, number>
  handoffRequested: number
  languageBridgeCompleted: number
  evidenceViewed: number
  /**
   * Conservative service inquiry rate estimate.
   * = handoff_requested / totalSessions (lower bound)
   */
  estimatedServiceInquiryRate: number
}

// ---------------------------------------------------------------------
// Pure: builders.
// ---------------------------------------------------------------------

let signalCounter = 0
function newSignalId(): string {
  return `conv_${Date.now()}_${(++signalCounter).toString(36)}`
}

/**
 * Build a conversion signal record.
 * Pure — no I/O.
 */
export function buildConversionSignal(input: {
  signalType: ConversionSignalType
  userId?: string
  sessionId: string
  queryCount?: number
  topCategories?: string[]
}): ConversionSignal {
  return {
    id: newSignalId(),
    signalType: input.signalType,
    userId: input.userId,
    sessionId: input.sessionId,
    queryCount: input.queryCount ?? 0,
    topCategories: input.topCategories ?? [],
    timestamp: new Date().toISOString(),
  }
}

/**
 * Compute weekly conversion summary from signal records.
 * Pure — no I/O.
 */
export function computeWeeklySummary(
  signals: ConversionSignal[],
  asOf: Date = new Date(),
): WeeklyConversionSummary {
  const weekAgo = new Date(asOf.getTime() - 7 * 86_400_000)
  const inWindow = signals.filter((s) => {
    const ts = Date.parse(s.timestamp)
    return Number.isFinite(ts) && ts >= weekAgo.getTime() && ts <= asOf.getTime()
  })

  const byType: Record<ConversionSignalType, number> = {
    content_to_service_inquiry: 0,
    language_bridge_completed: 0,
    evidence_viewed: 0,
    handoff_requested: 0,
    repeat_visit: 0,
  }
  for (const s of inWindow) {
    byType[s.signalType] = (byType[s.signalType] ?? 0) + 1
  }

  // Unique sessions.
  const uniqueSessions = new Set(inWindow.map((s) => s.sessionId)).size

  const handoffRequested = byType.handoff_requested
  const estimatedRate = uniqueSessions > 0
    ? Math.round((handoffRequested / uniqueSessions) * 10000) / 10000
    : 0

  return {
    period: {
      from: weekAgo.toISOString().slice(0, 10),
      to: asOf.toISOString().slice(0, 10),
    },
    totalSessions: uniqueSessions,
    byType,
    handoffRequested,
    languageBridgeCompleted: byType.language_bridge_completed,
    evidenceViewed: byType.evidence_viewed,
    estimatedServiceInquiryRate: estimatedRate,
  }
}

// ---------------------------------------------------------------------
// I/O: JSONL persistence.
// ---------------------------------------------------------------------

const DATA_DIR =
  process.env.VERCEL === '1'
    ? '/tmp'
    : path.join(process.cwd(), '.data')

const CONVERSION_FILE = path.join(DATA_DIR, 'conversion_signals.jsonl')

function ensureDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
  } catch {
    // swallow
  }
}

/**
 * Persist a conversion signal.
 */
export function recordConversionSignal(
  input: Parameters<typeof buildConversionSignal>[0],
): ConversionSignal {
  const signal = buildConversionSignal(input)
  ensureDir()
  try {
    fs.appendFileSync(CONVERSION_FILE, JSON.stringify(signal) + '\n', 'utf8')
  } catch (err) {
    console.error('[conversion] write failed', err)
  }
  return signal
}

/**
 * Read all conversion signals from JSONL.
 */
function listConversionSignals(limit = 1000): ConversionSignal[] {
  try {
    if (!fs.existsSync(CONVERSION_FILE)) return []
    const raw = fs.readFileSync(CONVERSION_FILE, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const signals: ConversionSignal[] = []
    for (const line of lines) {
      try {
        signals.push(JSON.parse(line) as ConversionSignal)
      } catch {
        // skip
      }
    }
    return signals.slice(-limit)
  } catch {
    return []
  }
}

/**
 * Get weekly conversion summary from persisted signals.
 * I/O — reads from JSONL.
 */
export function getWeeklyConversionSummary(): WeeklyConversionSummary {
  const signals = listConversionSignals()
  return computeWeeklySummary(signals)
}
