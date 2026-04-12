/**
 * /api/cases — Phase 3 lightweight case tracking.
 *
 * GET    /api/cases?status=&assignee=&language=   list cases
 * POST   /api/cases                                manually create a case
 *
 * See lib/db/tables.ts (CaseRow) for the schema. Auto-creation from
 * handoff happens in /api/router; this endpoint is for the /cases UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  insertCase,
  listCases,
  type CaseStatus,
  type CaseRow,
} from '@/lib/db/tables'
import { logError } from '@/lib/audit/logger'

const STATUSES: CaseStatus[] = [
  'open',
  'in_progress',
  'waiting_user',
  'resolved',
  'closed',
]

type Lang = 'en' | 'zh' | 'ja'
function normalizeLang(v: unknown): Lang {
  return v === 'zh' || v === 'ja' ? v : 'en'
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const statusParam = url.searchParams.get('status') || undefined
    const assignee = url.searchParams.get('assignee') || undefined
    const languageParam = url.searchParams.get('language') || undefined

    const status =
      statusParam && (STATUSES as string[]).includes(statusParam)
        ? (statusParam as CaseStatus)
        : undefined
    const language =
      languageParam === 'en' || languageParam === 'zh' || languageParam === 'ja'
        ? languageParam
        : undefined

    const rows = listCases({ status, assignee, language })
    return NextResponse.json({ ok: true, cases: rows, total: rows.length })
  } catch (error) {
    logError('cases_list_error', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const queryText = String(body.queryText || '').trim()
    if (!queryText) {
      return NextResponse.json(
        { ok: false, error: 'queryText is required' },
        { status: 400 },
      )
    }

    const language = normalizeLang(body.language)
    const status: CaseStatus =
      body.status && (STATUSES as string[]).includes(String(body.status))
        ? (body.status as CaseStatus)
        : 'open'

    const row: Omit<
      CaseRow,
      'id' | 'createdAt' | 'updatedAt' | 'status' | 'resolvedAt'
    > & { status?: CaseStatus } = {
      queryText: queryText.slice(0, 1000),
      language,
      category: body.category ? String(body.category).slice(0, 80) : null,
      subtopic: body.subtopic ? String(body.subtopic).slice(0, 80) : null,
      riskLevel: String(body.riskLevel || 'unknown').slice(0, 20),
      assignee: body.assignee ? String(body.assignee).slice(0, 80) : null,
      dueDate: body.dueDate ? String(body.dueDate).slice(0, 40) : null,
      notes: body.notes ? String(body.notes).slice(0, 2000) : null,
      sourceUserQueryId: body.sourceUserQueryId
        ? String(body.sourceUserQueryId)
        : null,
      sourceHandoffId: body.sourceHandoffId
        ? String(body.sourceHandoffId)
        : null,
      resolutionSummary: null,
      status,
    }

    const created = insertCase(row)
    return NextResponse.json({ ok: true, case: created })
  } catch (error) {
    logError('cases_create_error', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 500 },
    )
  }
}
