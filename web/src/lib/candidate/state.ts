/**
 * JTG Spec v1 §6 — Candidate lifecycle state machine.
 *
 * Enforces the allowed transitions as a single table so every route handler
 * shares the same rule. Invalid transitions return a structured error
 * (§13) instead of silently overwriting the field.
 *
 * Allowed transitions:
 *   NEW       -> CLUSTERED
 *   CLUSTERED -> REVIEWED | REJECTED
 *   REVIEWED  -> NEEDS_EDIT | PUBLISHED | REJECTED
 *   NEEDS_EDIT -> REVIEWED
 *   PUBLISHED -> (terminal)
 *   REJECTED  -> (terminal)
 */

import type { CandidateState } from '@/lib/domain/enums'

const ALLOWED: Record<CandidateState, ReadonlyArray<CandidateState>> = {
  NEW: ['CLUSTERED'],
  CLUSTERED: ['REVIEWED', 'REJECTED'],
  REVIEWED: ['NEEDS_EDIT', 'PUBLISHED', 'REJECTED'],
  NEEDS_EDIT: ['REVIEWED'],
  PUBLISHED: [],
  REJECTED: [],
}

export interface TransitionOk {
  ok: true
  from: CandidateState
  to: CandidateState
}

export interface TransitionErr {
  ok: false
  code:
    | 'INVALID_TRANSITION'
    | 'TERMINAL_STATE'
    | 'UNKNOWN_STATE'
  message: string
  from: CandidateState
  to: CandidateState
}

export type TransitionResult = TransitionOk | TransitionErr

/** Pure: does `from` → `to` satisfy §6.1? */
export function canTransition(
  from: CandidateState,
  to: CandidateState,
): TransitionResult {
  const allowed = ALLOWED[from]
  if (!allowed) {
    return {
      ok: false,
      code: 'UNKNOWN_STATE',
      message: `unknown state: ${from}`,
      from,
      to,
    }
  }
  if (allowed.length === 0) {
    return {
      ok: false,
      code: 'TERMINAL_STATE',
      message: `${from} is terminal; no further transitions allowed`,
      from,
      to,
    }
  }
  if (!allowed.includes(to)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: `${from} -> ${to} is not allowed; allowed: ${allowed.join(', ')}`,
      from,
      to,
    }
  }
  return { ok: true, from, to }
}
