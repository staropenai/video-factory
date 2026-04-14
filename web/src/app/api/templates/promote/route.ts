/**
 * POST /api/templates/promote — promote a successful staff writeback into
 * a reusable answer template.
 *
 * Phase 3 template promotion flow. Two entry shapes:
 *
 *   A) Promote from a resolved handoff:
 *      { sourceHandoffId, title?, body?, language?, category?, tags?, status? }
 *      - body defaults to handoff.humanReply
 *      - title defaults to the first 120 chars of the query
 *      - language defaults to handoff.detectedLanguage
 *
 *   B) Promote from a feedback row:
 *      { sourceFeedbackId, title?, body?, language?, category?, tags?, status? }
 *      - body defaults to feedback.humanReply
 *      - language defaults to feedback.language
 *
 *   C) Freeform (no source — equivalent to POST /api/templates with status='active'):
 *      { title, body, language, ... }
 *
 * Response: { ok: true, template: TemplateRow }.
 *
 * Default status for promoted templates is 'active' (ready to use), whereas
 * POST /api/templates defaults to 'draft'. That's the whole point of this
 * endpoint: vetted writebacks → active library.
 */

import { NextRequest } from 'next/server'
import { ok, fail, notFound, rateLimited } from '@/lib/utils/api-response'
import {
  getHandoff,
  listUserFeedback,
  insertTemplate,
  type TemplateRow,
  type TemplateStatus,
} from '@/lib/db/tables'
import { logError } from '@/lib/audit/logger'
import { devLog } from '@/lib/utils/dev-log'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'

type Lang = 'en' | 'zh' | 'ja'
const STATUSES: TemplateStatus[] = ['draft', 'active', 'archived']

function normalizeLang(v: unknown): Lang {
  return v === 'zh' || v === 'ja' ? v : 'en'
}

function normalizeTags(v: unknown): string[] {
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
  return []
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`template-promote:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const authCheck = requireAdmin(req);
  if (!authCheck.ok) return authCheck.response;

  try {
    const body = await req.json()
    const sourceHandoffId = body.sourceHandoffId
      ? String(body.sourceHandoffId)
      : null
    const sourceFeedbackId = body.sourceFeedbackId
      ? String(body.sourceFeedbackId)
      : null

    // Defaults pulled from source row.
    let defaultTitle = ''
    let defaultBody = ''
    let defaultLang: Lang = 'en'
    let defaultCategory: string | null = null

    if (sourceHandoffId) {
      const hf = getHandoff(sourceHandoffId)
      if (!hf) {
        return notFound(`Handoff ${sourceHandoffId}`)
      }
      if (hf.status !== 'resolved') {
        return fail('only resolved handoffs can be promoted to templates')
      }
      defaultTitle = hf.queryText.slice(0, 120)
      defaultBody = hf.humanReply || ''
      defaultLang = hf.detectedLanguage
    } else if (sourceFeedbackId) {
      // We don't have getUserFeedback; scan the small table.
      const all = listUserFeedback(500)
      const fb = all.find((f) => f.id === sourceFeedbackId)
      if (!fb) {
        return notFound(`Feedback ${sourceFeedbackId}`)
      }
      defaultTitle = fb.queryText.slice(0, 120)
      defaultBody = fb.humanReply || ''
      defaultLang = fb.language
      defaultCategory = fb.category ?? null
    }

    const title = String(body.title || defaultTitle || '').trim()
    const templateBody = String(body.body || defaultBody || '').trim()

    if (!title) {
      return fail('title is required (and source had none)')
    }
    if (!templateBody) {
      return fail(
        'body is required (source writeback was empty — cannot promote)',
      )
    }

    const status: TemplateStatus =
      body.status && (STATUSES as string[]).includes(String(body.status))
        ? (body.status as TemplateStatus)
        : 'active' // promoted templates default to active

    const language: Lang = body.language
      ? normalizeLang(body.language)
      : defaultLang

    const row: Omit<
      TemplateRow,
      'id' | 'createdAt' | 'updatedAt' | 'useCount'
    > = {
      title: title.slice(0, 200),
      body: templateBody.slice(0, 8000),
      language,
      category: body.category
        ? String(body.category).slice(0, 80)
        : defaultCategory,
      tags: normalizeTags(body.tags),
      status,
      createdBy: body.createdBy ? String(body.createdBy).slice(0, 80) : 'staff',
      sourceHandoffId,
      sourceFeedbackId,
    }

    const created = insertTemplate(row)
    devLog('TEMPLATE_PROMOTED', {
      id: created.id,
      sourceHandoffId,
      sourceFeedbackId,
      language: created.language,
      status: created.status,
    })
    return ok({ template: created }, 201)
  } catch (error) {
    logError('templates_promote_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}
