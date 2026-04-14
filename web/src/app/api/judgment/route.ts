/**
 * POST /api/judgment — JudgmentRegistry evaluation endpoint.
 * GET  /api/judgment — Stats and rule listing.
 *
 * v7 P0-3: Exposes the JudgmentRegistry for external evaluation
 * and outcome recording. Used by the staff dashboard and patent
 * data collection pipeline.
 */

import { NextRequest } from 'next/server'
import {
  evaluateAll,
  JUDGMENT_RULES,
  recordJudgmentOutcome,
  getJudgmentStats,
} from '@/lib/judgment/registry'
import type { JudgmentContext } from '@/lib/judgment/registry'
import { logError } from '@/lib/audit/logger'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { ok, fail, rateLimited } from '@/lib/utils/api-response'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`judgment:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.ai);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const authCheck = requireAdmin(req);
  if (!authCheck.ok) return authCheck.response;

  try {
    const stats = getJudgmentStats()
    return ok({
      ruleCount: JUDGMENT_RULES.length,
      rules: JUDGMENT_RULES.map((r) => ({
        ruleId: r.ruleId,
        domain: r.domain,
        action: r.action,
        confidence: r.confidence,
        patentRelevant: r.patentRelevant,
      })),
      stats,
    })
  } catch (error) {
    logError('judgment_get_error', error)
    return fail('Internal error', 500)
  }
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`judgment:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.ai);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const authCheck = requireAdmin(req);
  if (!authCheck.ok) return authCheck.response;

  try {
    const body = await req.json()
    const action = String(body.action ?? 'evaluate').trim()

    if (action === 'evaluate') {
      const context = (body.context ?? {}) as JudgmentContext
      const result = evaluateAll(JUDGMENT_RULES, context)
      return ok({
        activatedCount: result.activatedRules.length,
        topRule: result.topRule
          ? { ruleId: result.topRule.ruleId, action: result.topRule.action, confidence: result.topRule.confidence }
          : null,
        action: result.action,
        confidence: result.confidence,
        activatedRules: result.activatedRules.map((r) => ({
          ruleId: r.ruleId, action: r.action, confidence: r.confidence,
        })),
      })
    }

    if (action === 'record_outcome') {
      const { ruleId, context, actualOutcome, success } = body
      if (!ruleId || actualOutcome === undefined) {
        return fail('ruleId and actualOutcome required', 400, 'MISSING_PARAMS')
      }
      recordJudgmentOutcome({ ruleId, context: context ?? {}, actualOutcome: String(actualOutcome), success: !!success })
      return ok({})
    }

    return fail(`Unknown action: ${action}`, 400, 'UNKNOWN_ACTION')
  } catch (error) {
    logError('judgment_post_error', error)
    return fail('Internal error', 500)
  }
}
