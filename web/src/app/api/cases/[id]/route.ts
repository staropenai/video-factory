/**
 * /api/cases/[id] — Phase 3 case detail + updates.
 *
 * GET    /api/cases/:id     fetch a case
 * PATCH  /api/cases/:id     update status/assignee/dueDate/notes/...
 *
 * Next.js 16 App Router: context.params is a Promise that must be awaited.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCase, updateCase, type CaseStatus, type CaseRow } from '@/lib/db/tables'
import { logError } from '@/lib/audit/logger'

const STATUSES: CaseStatus[] = [
  'open',
  'in_progress',
  'waiting_user',
  'resolved',
  'closed',
]

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const row = getCase(id)
    if (!row) {
      return NextResponse.json(
        { ok: false, error: 'case not found' },
        { status: 404 },
      )
    }
    return NextResponse.json({ ok: true, case: row })
  } catch (error) {
    logError('cases_get_error', error)
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
        return NextResponse.json(
          { ok: false, error: `invalid status: ${s}` },
          { status: 400 },
        )
      }
      patch.status = s as CaseStatus
    }
    if (body.assignee !== undefined)
      patch.assignee = body.assignee ? String(body.assignee).slice(0, 80) : null
    if (body.dueDate !== undefined)
      patch.dueDate = body.dueDate ? String(body.dueDate).slice(0, 40) : null
    if (body.notes !== undefined)
      patch.notes = body.notes ? String(body.notes).slice(0, 2000) : null
    if (body.resolutionSummary !== undefined)
      patch.resolutionSummary = body.resolutionSummary
        ? String(body.resolutionSummary).slice(0, 2000)
        : null
    if (body.category !== undefined)
      patch.category = body.category ? String(body.category).slice(0, 80) : null
    if (body.subtopic !== undefined)
      patch.subtopic = body.subtopic ? String(body.subtopic).slice(0, 80) : null

    const updated = updateCase(id, patch)
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'case not found' },
        { status: 404 },
      )
    }
    return NextResponse.json({ ok: true, case: updated })
  } catch (error) {
    logError('cases_update_error', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 500 },
    )
  }
}
