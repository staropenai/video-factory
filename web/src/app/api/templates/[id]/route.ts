/**
 * /api/templates/[id] — fetch / update / delete a template.
 *
 * GET     /api/templates/:id        fetch a template
 * PATCH   /api/templates/:id        update title/body/language/category/tags/status
 * DELETE  /api/templates/:id        remove a template
 *
 * Next.js 16: context.params is a Promise that must be awaited.
 */

import { NextRequest } from 'next/server'
import { ok, fail, notFound, rateLimited } from '@/lib/utils/api-response'
import { sanitizeInput } from '@/lib/utils/sanitize'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
  incrementTemplateUse,
  type TemplateStatus,
  type TemplateRow,
} from '@/lib/db/tables'
import { logError } from '@/lib/audit/logger'
import { devLog } from '@/lib/utils/dev-log'
import { requireAdmin } from '@/lib/auth/admin-guard'

type Ctx = { params: Promise<{ id: string }> }
type Lang = 'en' | 'zh' | 'ja'
const STATUSES: TemplateStatus[] = ['draft', 'active', 'archived']

function normalizeLang(v: unknown): Lang | undefined {
  if (v === 'en' || v === 'zh' || v === 'ja') return v
  return undefined
}

function normalizeTags(v: unknown): string[] | undefined {
  if (Array.isArray(v))
    return v
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 20)
  if (typeof v === 'string')
    return v
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20)
  return undefined
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const rl = checkRateLimit(`template-detail:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const authCheck = requireAdmin(req);
  if (!authCheck.ok) return authCheck.response;

  try {
    const { id } = await ctx.params
    const row = getTemplate(id)
    if (!row) {
      return notFound('Template')
    }
    return ok({ template: row })
  } catch (error) {
    logError('templates_get_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const rl = checkRateLimit(`template-detail:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const authCheck = requireAdmin(req);
  if (!authCheck.ok) return authCheck.response;

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
        TemplateRow,
        'title' | 'body' | 'language' | 'category' | 'tags' | 'status'
      >
    > = {}

    if (body.title !== undefined)
      patch.title = sanitizeInput(String(body.title), 200)
    if (body.body !== undefined)
      patch.body = String(body.body).slice(0, 8000)
    if (body.language !== undefined) {
      const l = normalizeLang(body.language)
      if (!l) {
        return fail(`invalid language: ${body.language}`)
      }
      patch.language = l
    }
    if (body.category !== undefined)
      patch.category = body.category ? String(body.category).slice(0, 80) : null
    if (body.tags !== undefined) {
      const t = normalizeTags(body.tags)
      if (t) patch.tags = t
    }
    if (body.status !== undefined) {
      const s = String(body.status)
      if (!(STATUSES as string[]).includes(s)) {
        return fail(`invalid status: ${s}`)
      }
      patch.status = s as TemplateStatus
    }

    const updated = updateTemplate(id, patch)
    if (!updated) {
      return notFound('Template')
    }
    return ok({ template: updated })
  } catch (error) {
    logError('templates_update_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}

/**
 * POST /api/templates/:id — record a "use" of this template (increments
 * useCount). Called when staff insert a template into a handoff reply.
 * Returns the updated row.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const rl = checkRateLimit(`template-detail:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const authCheck = requireAdmin(req);
  if (!authCheck.ok) return authCheck.response;

  try {
    const { id } = await ctx.params
    const updated = incrementTemplateUse(id)
    if (!updated) {
      return notFound('Template')
    }
    devLog('TEMPLATE_USED', { id, useCount: updated.useCount })
    return ok({ template: updated })
  } catch (error) {
    logError('templates_use_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const rl = checkRateLimit(`template-detail:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const authCheck = requireAdmin(req);
  if (!authCheck.ok) return authCheck.response;

  try {
    const { id } = await ctx.params
    const removed = deleteTemplate(id)
    if (!removed) {
      return notFound('Template')
    }
    return ok({ id })
  } catch (error) {
    logError('templates_delete_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}
