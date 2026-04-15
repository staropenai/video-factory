/**
 * Cross-Language Scene State Machine (方案C)
 *
 * Beyond translation: takes the user from "understanding information"
 * to "executing action" across language barriers.
 *
 * Translation tools help you understand Japanese.
 * This state machine helps you ACT in Japanese — make phone calls,
 * negotiate with landlords, handle disputes.
 *
 * Architecture: Pure/I/O separation.
 *  - FSM logic is pure (no side effects, fully testable)
 *  - Session persistence is I/O (JSONL, swappable)
 */

import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BridgeState =
  | 'idle'
  | 'scene_identified'
  | 'context_gathering'
  | 'script_preparing'
  | 'script_ready'
  | 'rehearsal'
  | 'executing'
  | 'followup'
  | 'completed'
  | 'escalated'

export type BridgeTransition =
  | 'identify_scene'
  | 'request_context'
  | 'context_complete'
  | 'script_generated'
  | 'start_rehearsal'
  | 'skip_rehearsal'
  | 'rehearsal_done'
  | 'call_ended'
  | 'resolved'
  | 'need_human'
  | 'retry'
  | 'abandon'

export interface BridgeSession {
  id: string
  state: BridgeState
  sceneTag: string
  userLocale: 'zh' | 'en' | 'vi' | 'ko' | 'other'
  targetLocale: 'ja'
  contextGathered: Record<string, string>
  currentScript?: string
  branches?: string[]
  stateHistory: { state: BridgeState; timestamp: string; note?: string }[]
  createdAt: string
  updatedAt: string
}

export interface TransitionResult {
  ok: boolean
  session: BridgeSession
  message?: string
  nextActions?: string[]
}

// ---------------------------------------------------------------------------
// Pure: Transition table
// ---------------------------------------------------------------------------

export const VALID_TRANSITIONS: Record<BridgeState, BridgeTransition[]> = {
  idle: ['identify_scene'],
  scene_identified: ['request_context', 'need_human', 'abandon'],
  context_gathering: ['context_complete', 'need_human', 'abandon'],
  script_preparing: ['script_generated', 'need_human', 'abandon'],
  script_ready: ['start_rehearsal', 'skip_rehearsal', 'need_human', 'abandon'],
  rehearsal: ['rehearsal_done', 'need_human', 'abandon'],
  executing: ['call_ended', 'need_human'],
  followup: ['resolved', 'retry', 'need_human', 'abandon'],
  completed: [],
  escalated: [],
}

// ---------------------------------------------------------------------------
// Pure: Transition → target state mapping
// ---------------------------------------------------------------------------

const TRANSITION_TARGET: Record<BridgeTransition, BridgeState> = {
  identify_scene: 'scene_identified',
  request_context: 'context_gathering',
  context_complete: 'script_preparing',
  script_generated: 'script_ready',
  start_rehearsal: 'rehearsal',
  skip_rehearsal: 'executing',
  rehearsal_done: 'executing',
  call_ended: 'followup',
  resolved: 'completed',
  need_human: 'escalated',
  retry: 'script_preparing',
  abandon: 'idle',
}

// ---------------------------------------------------------------------------
// Pure: FSM helpers
// ---------------------------------------------------------------------------

export function isValidTransition(
  currentState: BridgeState,
  transition: BridgeTransition,
): boolean {
  return VALID_TRANSITIONS[currentState].includes(transition)
}

export function getTargetState(transition: BridgeTransition): BridgeState {
  return TRANSITION_TARGET[transition]
}

// ---------------------------------------------------------------------------
// Pure: Session factory
// ---------------------------------------------------------------------------

export function createSession(
  sceneTag: string,
  userLocale: string,
): BridgeSession {
  const now = new Date().toISOString()
  const locale = (['zh', 'en', 'vi', 'ko'] as const).includes(
    userLocale as 'zh' | 'en' | 'vi' | 'ko',
  )
    ? (userLocale as 'zh' | 'en' | 'vi' | 'ko')
    : 'other'

  return {
    id: `bridge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    state: 'idle',
    sceneTag,
    userLocale: locale,
    targetLocale: 'ja',
    contextGathered: {},
    stateHistory: [{ state: 'idle', timestamp: now, note: 'session created' }],
    createdAt: now,
    updatedAt: now,
  }
}

// ---------------------------------------------------------------------------
// Pure: Apply transition
// ---------------------------------------------------------------------------

export function applyTransition(
  session: BridgeSession,
  transition: BridgeTransition,
  note?: string,
): TransitionResult {
  if (!isValidTransition(session.state, transition)) {
    return {
      ok: false,
      session,
      message: `Invalid transition '${transition}' from state '${session.state}'`,
    }
  }

  const targetState = getTargetState(transition)
  const now = new Date().toISOString()

  const updated: BridgeSession = {
    ...session,
    state: targetState,
    stateHistory: [
      ...session.stateHistory,
      { state: targetState, timestamp: now, note },
    ],
    updatedAt: now,
  }

  return {
    ok: true,
    session: updated,
    message: `Transitioned from '${session.state}' to '${targetState}'`,
    nextActions: getNextActions(updated),
  }
}

// ---------------------------------------------------------------------------
// Pure: Scene context requirements
// ---------------------------------------------------------------------------

const SCENE_CONTEXT_MAP: Record<string, string[]> = {
  'lease/*': ['management_company_phone', 'contract_number', 'move_date'],
  'equipment/*': ['management_company_phone', 'equipment_type', 'error_code'],
  'utilities/*': ['utility_provider', 'customer_number', 'target_date'],
  'moveout/*': ['management_company_phone', 'move_out_date', 'key_count'],
}

export function getRequiredContext(sceneTag: string): string[] {
  // Try exact match first
  if (SCENE_CONTEXT_MAP[sceneTag]) {
    return SCENE_CONTEXT_MAP[sceneTag]
  }

  // Try wildcard match on the category prefix
  const category = sceneTag.split('/')[0]
  const wildcardKey = `${category}/*`
  return SCENE_CONTEXT_MAP[wildcardKey] ?? []
}

export function isContextComplete(session: BridgeSession): boolean {
  const required = getRequiredContext(session.sceneTag)
  return required.every((field) => session.contextGathered[field] != null)
}

// ---------------------------------------------------------------------------
// Pure: Next actions
// ---------------------------------------------------------------------------

export function getNextActions(session: BridgeSession): string[] {
  switch (session.state) {
    case 'idle':
      return ['Start by describing your situation']
    case 'scene_identified':
      return ['Provide required details', 'Skip to script']
    case 'context_gathering': {
      const required = getRequiredContext(session.sceneTag)
      const missing = required.filter(
        (f) => session.contextGathered[f] == null,
      )
      return missing.length > 0
        ? missing.map((f) => `Provide: ${f}`)
        : ['All details collected — proceed to script']
    }
    case 'script_preparing':
      return ['Generating script...']
    case 'script_ready':
      return ['Review the script', 'Start rehearsal', 'Skip to call']
    case 'rehearsal':
      return ['Practice the opening', 'Try a branch', 'Ready for the call']
    case 'executing':
      return ['Call ended successfully', 'Need help']
    case 'followup':
      return ['Issue resolved', 'Try again', 'Talk to a person']
    case 'completed':
      return []
    case 'escalated':
      return []
  }
}

// ---------------------------------------------------------------------------
// Pure: Session metrics (patent data collection)
// ---------------------------------------------------------------------------

export function computeSessionMetrics(session: BridgeSession): {
  totalDurationMs: number
  statesTraversed: number
  reachedExecution: boolean
  completed: boolean
  escalated: boolean
} {
  const history = session.stateHistory
  if (history.length === 0) {
    return {
      totalDurationMs: 0,
      statesTraversed: 0,
      reachedExecution: false,
      completed: false,
      escalated: false,
    }
  }

  const start = new Date(history[0].timestamp).getTime()
  const end = new Date(history[history.length - 1].timestamp).getTime()

  return {
    totalDurationMs: end - start,
    statesTraversed: history.length,
    reachedExecution: history.some((h) => h.state === 'executing'),
    completed: session.state === 'completed',
    escalated: session.state === 'escalated',
  }
}

// ---------------------------------------------------------------------------
// Pure: Timeout
// ---------------------------------------------------------------------------

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

export function isSessionExpired(
  session: BridgeSession,
  now?: Date,
): boolean {
  const ref = (now ?? new Date()).getTime()
  const updated = new Date(session.updatedAt).getTime()
  return ref - updated > SESSION_TIMEOUT_MS
}

// ---------------------------------------------------------------------------
// I/O: Persistence (JSONL)
// ---------------------------------------------------------------------------

const DATA_DIR =
  process.env.VERCEL === '1'
    ? '/tmp'
    : path.join(process.cwd(), '.data')

const SESSIONS_FILE = path.join(DATA_DIR, 'bridge_sessions.jsonl')

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function readAllSessions(): BridgeSession[] {
  if (!fs.existsSync(SESSIONS_FILE)) return []

  const content = fs.readFileSync(SESSIONS_FILE, 'utf-8').trim()
  if (!content) return []

  return content
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as BridgeSession)
}

export function persistSession(session: BridgeSession): void {
  ensureDataDir()

  const existing = readAllSessions()
  const idx = existing.findIndex((s) => s.id === session.id)

  if (idx >= 0) {
    existing[idx] = session
  } else {
    existing.push(session)
  }

  const jsonl = existing.map((s) => JSON.stringify(s)).join('\n') + '\n'
  fs.writeFileSync(SESSIONS_FILE, jsonl, 'utf-8')
}

export function loadSession(sessionId: string): BridgeSession | null {
  const sessions = readAllSessions()
  return sessions.find((s) => s.id === sessionId) ?? null
}

export function listActiveSessions(): BridgeSession[] {
  const now = new Date()
  return readAllSessions().filter(
    (s) =>
      s.state !== 'completed' &&
      s.state !== 'escalated' &&
      !isSessionExpired(s, now),
  )
}
