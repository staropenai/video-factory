/**
 * /api/cases — Phase 3 lightweight case tracking.
 *
 * GET    /api/cases?status=&assignee=&language=   list cases
 * POST   /api/cases                                manually create a case
 *
 * See lib/db/tables.ts (CaseRow) for the schema. Auto-creation from
 * handoff happens in /api/router; this endpoint is for the /cases UI.
 */

import { NextRequest } from 'next/server'
import {
  insertCase,
  listCases,
  type CaseStatus,
  type CaseRow,
} from '@/lib/db/tables'
import { logError } from '@/lib/audit/logger'
import { ok, fail, rateLimited } from '@/lib/utils/api-response'
import { sanitizeInput, stripControlChars } from '@/lib/utils/sanitize'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'

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
  const rl = checkRateLimit(`cases:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

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
    return ok({ cases: rows, total: rows.length })
  } catch (error) {
    logError('cases_list_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`cases:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  try {
    const body = await req.json()
    const queryText = sanitizeInput(String(body.queryText || ''), 1000)
    if (!queryText) {
      return fail('queryText is required')
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
      queryText: stripControlChars(queryText),
      language,
      category: body.category ? stripControlChars(sanitizeInput(String(body.category), 80)) : null,
      subtopic: body.subtopic ? stripControlChars(sanitizeInput(String(body.subtopic), 80)) : null,
      riskLevel: String(body.riskLevel || 'unknown').slice(0, 20),
      assignee: body.assignee ? String(body.assignee).slice(0, 80) : null,
      dueDate: body.dueDate ? String(body.dueDate).slice(0, 40) : null,
      notes: body.notes ? stripControlChars(sanitizeInput(String(body.notes), 2000)) : null,
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
    return ok({ case: created })
  } catch (error) {
    logError('cases_create_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}
