/**
 * /api/templates — Phase 3 reusable answer-template library.
 *
 * GET    /api/templates?status=&language=&category=&q=   list
 * POST   /api/templates                                  create a template
 *
 * See lib/db/tables.ts (TemplateRow) for the schema. Promotion from a
 * handoff writeback lives at /api/templates/promote.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  insertTemplate,
  listTemplates,
  type TemplateStatus,
  type TemplateRow,
} from '@/lib/db/tables'
import { logError } from '@/lib/audit/logger'

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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const statusParam = url.searchParams.get('status') || undefined
    const languageParam = url.searchParams.get('language') || undefined
    const category = url.searchParams.get('category') || undefined
    const q = url.searchParams.get('q') || undefined

    const status =
      statusParam && (STATUSES as string[]).includes(statusParam)
        ? (statusParam as TemplateStatus)
        : undefined
    const language =
      languageParam === 'en' || languageParam === 'zh' || languageParam === 'ja'
        ? languageParam
        : undefined

    const rows = listTemplates({ status, language, category, q })
    return NextResponse.json({ ok: true, templates: rows, total: rows.length })
  } catch (error) {
    logError('templates_list_error', error)
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
    const title = String(body.title || '').trim()
    const templateBody = String(body.body || '').trim()
    if (!title) {
      return NextResponse.json(
        { ok: false, error: 'title is required' },
        { status: 400 },
      )
    }
    if (!templateBody) {
      return NextResponse.json(
        { ok: false, error: 'body is required' },
        { status: 400 },
      )
    }

    const row: Omit<
      TemplateRow,
      'id' | 'createdAt' | 'updatedAt' | 'useCount'
    > = {
      title: title.slice(0, 200),
      body: templateBody.slice(0, 8000),
      language: normalizeLang(body.language),
      category: body.category ? String(body.category).slice(0, 80) : null,
      tags: normalizeTags(body.tags),
      status:
        body.status && (STATUSES as string[]).includes(String(body.status))
          ? (body.status as TemplateStatus)
          : 'draft',
      createdBy: body.createdBy ? String(body.createdBy).slice(0, 80) : 'staff',
      sourceHandoffId: body.sourceHandoffId
        ? String(body.sourceHandoffId)
        : null,
      sourceFeedbackId: body.sourceFeedbackId
        ? String(body.sourceFeedbackId)
        : null,
    }

    const created = insertTemplate(row)
    return NextResponse.json({ ok: true, template: created })
  } catch (error) {
    logError('templates_create_error', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 500 },
    )
  }
}
