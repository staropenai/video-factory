/**
 * JTG V6 P0-3B — Independent security event log.
 *
 * V6 spec (执行文件 §P0-3C, 总方案 §6.1):
 *   "独立的安全事件日志（不与普通日志混合）"
 *
 * Security events are stored in a SEPARATE JSONL file from the main
 * audit events table. This ensures:
 *   1. Security events can't be tampered with via the main events API
 *   2. Security log can be shipped to a separate monitoring system
 *   3. Security events include request metadata (IP, user-agent) that
 *      the main audit log deliberately excludes
 *
 * Pure functions:
 *   - `buildSecurityEvent` — shapes event data (no I/O)
 *   - `classifySecuritySeverity` — maps detection results to severity
 *
 * I/O functions:
 *   - `logSecurityEvent` — appends to security JSONL
 *   - `listSecurityEvents` — reads from security JSONL
 */

import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export type SecurityEventType =
  | 'PROMPT_INJECTION_BLOCKED'
  | 'PROMPT_INJECTION_WARNING'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_INPUT'
  | 'UNAUTHORIZED_ACCESS'
  | 'OUTPUT_SAFETY_VIOLATION'

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface SecurityEvent {
  id: string
  timestamp: string
  eventType: SecurityEventType
  severity: SecuritySeverity
  /** Route where the event occurred. */
  route: string
  /** Sanitized input (first 200 chars, no PII). */
  inputPreview: string
  /** Request metadata. */
  request: {
    ip: string | null
    userAgent: string | null
  }
  /** Pattern IDs that matched (for injection events). */
  matchedPatternIds: string[]
  /** Human-readable description. */
  description: string
  /** Whether the request was blocked. */
  blocked: boolean
}

// ---------------------------------------------------------------------
// Pure: event building.
// ---------------------------------------------------------------------

let eventCounter = 0

function newSecId(): string {
  return `sec_${Date.now()}_${(++eventCounter).toString(36)}`
}

/**
 * Build a security event object. Pure — no I/O.
 */
export function buildSecurityEvent(input: {
  eventType: SecurityEventType
  severity: SecuritySeverity
  route: string
  inputPreview: string
  ip?: string | null
  userAgent?: string | null
  matchedPatternIds?: string[]
  description: string
  blocked: boolean
}): SecurityEvent {
  return {
    id: newSecId(),
    timestamp: new Date().toISOString(),
    eventType: input.eventType,
    severity: input.severity,
    route: input.route,
    inputPreview: input.inputPreview.slice(0, 200),
    request: {
      ip: input.ip ?? null,
      userAgent: input.userAgent ? input.userAgent.slice(0, 200) : null,
    },
    matchedPatternIds: input.matchedPatternIds ?? [],
    description: input.description,
    blocked: input.blocked,
  }
}

/**
 * Map injection detection severity to security event type.
 * Pure — no I/O.
 */
export function classifySecuritySeverity(
  injectionSeverity: 'high' | 'medium' | 'none',
): { eventType: SecurityEventType; severity: SecuritySeverity; blocked: boolean } {
  switch (injectionSeverity) {
    case 'high':
      return {
        eventType: 'PROMPT_INJECTION_BLOCKED',
        severity: 'high',
        blocked: true,
      }
    case 'medium':
      return {
        eventType: 'PROMPT_INJECTION_WARNING',
        severity: 'medium',
        blocked: false,
      }
    default:
      return {
        eventType: 'SUSPICIOUS_INPUT',
        severity: 'info',
        blocked: false,
      }
  }
}

// ---------------------------------------------------------------------
// I/O: JSONL persistence (separate from main events table).
// ---------------------------------------------------------------------

const DATA_DIR =
  process.env.VERCEL === '1'
    ? '/tmp'
    : path.join(process.cwd(), '.data')

const SECURITY_LOG_FILE = path.join(DATA_DIR, 'security_events.jsonl')

function ensureDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
  } catch {
    // swallow — best-effort
  }
}

/**
 * Append a security event to the dedicated security JSONL.
 * Also emits to console.error so Vercel's log drain captures it.
 */
export function logSecurityEvent(event: SecurityEvent): void {
  ensureDir()
  try {
    fs.appendFileSync(SECURITY_LOG_FILE, JSON.stringify(event) + '\n', 'utf8')
  } catch (err) {
    console.error('[security] write failed', err)
  }
  // Always also emit to stderr for log drain / monitoring.
  console.error(
    JSON.stringify({
      _security_event: true,
      id: event.id,
      type: event.eventType,
      severity: event.severity,
      route: event.route,
      blocked: event.blocked,
      timestamp: event.timestamp,
    }),
  )
}

/**
 * Read security events from the dedicated JSONL.
 * Returns newest-first.
 */
export function listSecurityEvents(limit = 200): SecurityEvent[] {
  try {
    if (!fs.existsSync(SECURITY_LOG_FILE)) return []
    const raw = fs.readFileSync(SECURITY_LOG_FILE, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const events: SecurityEvent[] = []
    for (const line of lines) {
      try {
        events.push(JSON.parse(line) as SecurityEvent)
      } catch {
        // skip corrupt line
      }
    }
    return events.slice(-limit).reverse()
  } catch {
    return []
  }
}
