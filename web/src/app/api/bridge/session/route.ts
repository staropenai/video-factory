/**
 * POST /api/bridge/session — Cross-Language Scene State Machine (方案C).
 *
 * Manages bridge sessions that guide users from "understanding" to "action"
 * across language barriers. Each session is a finite state machine that
 * tracks the user's progress through scene preparation → rehearsal → execution.
 *
 * Actions:
 *   { action: 'create', sceneTag: 'lease/renewal', userLocale: 'zh' }
 *   { action: 'transition', sessionId: '...', transition: 'identify_scene' }
 *   { action: 'status', sessionId: '...' }
 *   { action: 'list' }  — list active sessions
 *
 * GET /api/bridge/session?sessionId=... — get session status
 */

import { NextRequest } from 'next/server'
import {
  createSession,
  applyTransition,
  getNextActions,
  getRequiredContext,
  isContextComplete,
  computeSessionMetrics,
  persistSession,
  loadSession,
  listActiveSessions,
} from '@/lib/bridge/state-machine'
import { requireAdmin } from '@/lib/auth/admin-guard'
import type { BridgeTransition } from '@/lib/bridge/state-machine'
import { logError } from '@/lib/audit/logger'
import { recordBridgeSession } from '@/lib/patent/metrics-collector'
import { createEvidenceRecord, logEvidenceRecord } from '@/lib/patent/evidence-chain-logger'
import { ok, fail, notFound, rateLimited } from '@/lib/utils/api-response'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`bridge-session:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.ai);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const authCheck = requireAdmin(req);
  if (!authCheck.ok) return authCheck.response;

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (sessionId) {
    const session = loadSession(sessionId)
    if (!session) {
      return notFound('Session')
    }
    return ok({
      session,
      nextActions: getNextActions(session),
      contextComplete: isContextComplete(session),
      requiredContext: getRequiredContext(session.sceneTag),
      metrics: computeSessionMetrics(session),
    })
  }
  // List active sessions
  const sessions = listActiveSessions()
  return ok({ sessions, count: sessions.length })
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`bridge-session:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.ai);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const authCheck = requireAdmin(req);
  if (!authCheck.ok) return authCheck.response;

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('invalid_body')
  }

  try {
    const action = String(body.action ?? '').trim()

    if (action === 'create') {
      const sceneTag = String(body.sceneTag ?? '').trim()
      const userLocale = String(body.userLocale ?? 'en').trim()
      if (!sceneTag) {
        return fail('sceneTag is required', 400, 'MISSING_SCENE')
      }
      const session = createSession(sceneTag, userLocale)
      const t = applyTransition(session, 'identify_scene')
      try { persistSession(t.session) } catch (e) { logError('bridge_session_persist_error', e) }
      return ok({
        session: t.session,
        nextActions: getNextActions(t.session),
        requiredContext: getRequiredContext(sceneTag),
      })
    }

    if (action === 'transition') {
      const sessionId = String(body.sessionId ?? '').trim()
      const transition = String(body.transition ?? '').trim() as BridgeTransition
      if (!sessionId || !transition) {
        return fail('sessionId and transition required', 400, 'MISSING_PARAMS')
      }
      const session = loadSession(sessionId)
      if (!session) {
        return notFound('Session')
      }
      const result = applyTransition(session, transition, body.note as string | undefined)
      if (!result.ok) {
        return fail(result.message ?? 'Invalid transition', 400, 'INVALID_TRANSITION')
      }
      try { persistSession(result.session) } catch (e) { logError('bridge_session_persist_error', e) }

      // Patent data collection: record completed/escalated sessions
      if (result.session.state === 'completed' || result.session.state === 'escalated') {
        const sessionMetrics = computeSessionMetrics(result.session)
        try {
          recordBridgeSession({
            sessionId: result.session.id,
            sceneTag: result.session.sceneTag,
            timeToFirstScript: sessionMetrics.totalDurationMs / 1000,
            statesTraversed: result.session.stateHistory.map((h) => h.state),
            userCopiedScript: sessionMetrics.reachedExecution,
            followupQuestions: 0,
            riskLevel: 'medium',
            userLocale: result.session.userLocale,
          })
        } catch (e) {
          logError('patent_bridge_metric_error', e)
        }

        // v8: Evidence chain record for bridge sessions
        try {
          const ecRecord = createEvidenceRecord({
            module: 'bridge',
            queryId: result.session.id,
            sessionId: result.session.id,
            input: {
              queryText: result.session.sceneTag,
              userLanguage: result.session.userLocale,
              scenarioTag: result.session.sceneTag,
            },
            routeTaken: 'L5_BRIDGE',
            decisionReasonCode: `bridge_${result.session.state}`,
            decisionReasonDetails: { finalState: result.session.state },
            evidenceUsed: [],
            stateTransitionPath: result.session.stateHistory.map((h) => h.state),
            answerType: 'L5',
            timeToFirstActionMs: sessionMetrics.totalDurationMs,
          })
          logEvidenceRecord(ecRecord)
        } catch (e) {
          logError('evidence_chain_bridge_error', e)
        }
      }

      return ok({
        session: result.session,
        message: result.message,
        nextActions: result.nextActions ?? getNextActions(result.session),
        metrics: computeSessionMetrics(result.session),
      })
    }

    if (action === 'status') {
      const sessionId = String(body.sessionId ?? '').trim()
      const session = loadSession(sessionId)
      if (!session) {
        return notFound('Session')
      }
      return ok({
        session,
        nextActions: getNextActions(session),
        contextComplete: isContextComplete(session),
        metrics: computeSessionMetrics(session),
      })
    }

    return fail(`Unknown action: ${action}`, 400, 'UNKNOWN_ACTION')
  } catch (error) {
    logError('bridge_session_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}
