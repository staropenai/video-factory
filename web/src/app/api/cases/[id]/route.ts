/**
 * /api/cases/[id] — Phase 3 case detail + updates.
 *
 * GET    /api/cases/:id     fetch a case
 * PATCH  /api/cases/:id     update status/assignee/dueDate/notes/...
 *
 * Next.js 16 App Router: context.params is a Promise that must be awaited.
 */

import { NextRequest } from 'next/server'
import { getCase, updateCase, type CaseStatus, type CaseRow } from '@/lib/db/tables'
import { logError } from '@/lib/audit/logger'
import { ok, fail, notFound, rateLimited } from '@/lib/utils/api-response'
import { sanitizeInput } from '@/lib/utils/sanitize'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'

const STATUSES: CaseStatus[] = [
  'open',
  'in_progress',
  'waiting_user',
  'resolved',
  'closed',
]

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const rl = checkRateLimit(`case-detail:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  try {
    const { id } = await ctx.params
    const row = getCase(id)
    if (!row) {
      return notFound('Case')
    }
    return ok({ case: row })
  } catch (error) {
    logError('cases_get_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const rl = checkRateLimit(`case-detail:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const { id } = await ctx.params
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('invalid_body')
  }

  try {
    const patch: Partial<
      Pick<
        CaseRow,
        | 'status'
        | 'assignee'
        | 'dueDate'
        | 'notes'
        | 'resolutionSummary'
        | 'category'
        | 'subtopic'
      >
    > = {}

    if (body.status !== undefined) {
      const s = String(body.status)
      if (!(STATUSES as string[]).includes(s)) {
        return fail(`invalid status: ${s}`)
      }
      patch.status = s as CaseStatus
    }
    if (body.assignee !== undefined)
      patch.assignee = body.assignee ? sanitizeInput(String(body.assignee), 200) : null
    if (body.dueDate !== undefined)
      patch.dueDate = body.dueDate ? String(body.dueDate).slice(0, 40) : null
    if (body.notes !== undefined)
      patch.notes = body.notes ? sanitizeInput(String(body.notes), 4000) : null
    if (body.resolutionSummary !== undefined)
      patch.resolutionSummary = body.resolutionSummary
        ? sanitizeInput(String(body.resolutionSummary), 4000)
        : null
    if (body.category !== undefined)
      patch.category = body.category ? String(body.category).slice(0, 80) : null
    if (body.subtopic !== undefined)
      patch.subtopic = body.subtopic ? String(body.subtopic).slice(0, 80) : null

    const updated = updateCase(id, patch)
    if (!updated) {
      return notFound('Case')
    }
    return ok({ case: updated })
  } catch (error) {
    logError('cases_update_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}
