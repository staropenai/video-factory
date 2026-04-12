/**
 * /api/templates/[id] — fetch / update / delete a template.
 *
 * GET     /api/templates/:id        fetch a template
 * PATCH   /api/templates/:id        update title/body/language/category/tags/status
 * DELETE  /api/templates/:id        remove a template
 *
 * Next.js 16: context.params is a Promise that must be awaited.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
  incrementTemplateUse,
  type TemplateStatus,
  type TemplateRow,
} from '@/lib/db/tables'
import { logError } from '@/lib/audit/logger'

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

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const row = getTemplate(id)
    if (!row) {
      return NextResponse.json(
        { ok: false, error: 'template not found' },
        { status: 404 },
      )
    }
    return NextResponse.json({ ok: true, template: row })
  } catch (error) {
    logError('templates_get_error', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = await req.json()

    const patch: Partial<
      Pick<
        TemplateRow,
        'title' | 'body' | 'language' | 'category' | 'tags' | 'status'
      >
    > = {}

    if (body.title !== undefined)
      patch.title = String(body.title).slice(0, 200)
    if (body.body !== undefined)
      patch.body = String(body.body).slice(0, 8000)
    if (body.language !== undefined) {
      const l = normalizeLang(body.language)
      if (!l) {
        return NextResponse.json(
          { ok: false, error: `invalid language: ${body.language}` },
          { status: 400 },
        )
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
        return NextResponse.json(
          { ok: false, error: `invalid status: ${s}` },
          { status: 400 },
        )
      }
      patch.status = s as TemplateStatus
    }

    const updated = updateTemplate(id, patch)
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'template not found' },
        { status: 404 },
      )
    }
    return NextResponse.json({ ok: true, template: updated })
  } catch (error) {
    logError('templates_update_error', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 500 },
    )
  }
}

/**
 * POST /api/templates/:id — record a "use" of this template (increments
 * useCount). Called when staff insert a template into a handoff reply.
 * Returns the updated row.
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const updated = incrementTemplateUse(id)
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'template not found' },
        { status: 404 },
      )
    }
    console.log('TEMPLATE_USED', { id, useCount: updated.useCount })
    return NextResponse.json({ ok: true, template: updated })
  } catch (error) {
    logError('templates_use_error', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const removed = deleteTemplate(id)
    if (!removed) {
      return NextResponse.json(
        { ok: false, error: 'template not found' },
        { status: 404 },
      )
    }
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    logError('templates_delete_error', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 500 },
    )
  }
}
