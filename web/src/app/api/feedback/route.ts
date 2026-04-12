/**
 * POST /api/feedback — capture human tester satisfaction signal + staff
 * writeback. Implements §7.2 of the CEO iteration plan.
 *
 * Body:
 *   {
 *     queryText: string,
 *     systemAnswer: string,
 *     answerMode: string,
 *     isSatisfied: boolean,
 *     humanReply?: string,       // required when isSatisfied === false
 *     language: 'en'|'zh'|'ja',
 *
 *     // ---- §7.2 extended writeback fields (all optional) ----
 *     resolutionSummary?: string,
 *     shouldCreateFaq?: boolean,
 *     shouldUpdateFaq?: boolean,
 *     shouldAddRule?: boolean,
 *     shouldAddSource?: boolean,
 *     notes?: string,
 *     category?: string,
 *     subtopic?: string,
 *   }
 *
 * On success:
 *   - inserts a `user_feedback` row with all writeback fields
 *   - if (isSatisfied === false AND humanReply non-empty) OR shouldCreateFaq,
 *     also inserts a faq_candidates row with source='user_feedback',
 *     status='pending_review'
 *
 * Persistence: file-backed JSONL tables (see lib/db/tables.ts).
 */

import { NextRequest, NextResponse } from 'next/server'
import { insertUserFeedback, insertFaqCandidate } from '@/lib/db/tables'
import { logError } from '@/lib/audit/logger'

type Lang = 'en' | 'zh' | 'ja'

function normalizeLang(value: unknown): Lang {
  return value === 'zh' || value === 'ja' ? value : 'en'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const queryText = String(body.queryText || '').trim()
    const systemAnswer = String(body.systemAnswer || '').trim()
    const answerMode = String(body.answerMode || '').trim() || 'unknown'
    const isSatisfied = Boolean(body.isSatisfied)
    const humanReply = String(body.humanReply || '').trim()
    const language = normalizeLang(body.language)

    if (!queryText) {
      return NextResponse.json({ error: 'queryText is required' }, { status: 400 })
    }
    if (typeof body.isSatisfied !== 'boolean') {
      return NextResponse.json({ error: 'isSatisfied is required' }, { status: 400 })
    }

    // §7.2 extended writeback fields — all optional, all clamped.
    const resolutionSummary = body.resolutionSummary
      ? String(body.resolutionSummary).slice(0, 4000)
      : null
    const shouldCreateFaq = Boolean(body.shouldCreateFaq)
    const shouldUpdateFaq = Boolean(body.shouldUpdateFaq)
    const shouldAddRule = Boolean(body.shouldAddRule)
    const shouldAddSource = Boolean(body.shouldAddSource)
    const notes = body.notes ? String(body.notes).slice(0, 2000) : null
    const category = body.category ? String(body.category).slice(0, 80) : null
    const subtopic = body.subtopic ? String(body.subtopic).slice(0, 80) : null

    const feedback = insertUserFeedback({
      queryText: queryText.slice(0, 1000),
      systemAnswer: systemAnswer.slice(0, 4000),
      answerMode,
      isSatisfied,
      humanReply: humanReply ? humanReply.slice(0, 4000) : null,
      language,
      resolutionSummary,
      shouldCreateFaq,
      shouldUpdateFaq,
      shouldAddRule,
      shouldAddSource,
      notes,
      category,
      subtopic,
    })

    let faqCandidateId: string | undefined
    // Either an explicit "create FAQ" flag OR an old-school dissatisfaction
    // with a written reply triggers the candidate row.
    if ((shouldCreateFaq && humanReply) || (!isSatisfied && humanReply)) {
      const candidate = insertFaqCandidate({
        source: 'user_feedback',
        sourceFeedbackId: feedback.id,
        sourceQueryText: queryText,
        detectedLanguage: language,
        candidateTitle: queryText.slice(0, 120),
        candidateAnswer: humanReply,
        riskLevel: 'unknown',
        createdBy: 'tester',
      })
      faqCandidateId = candidate.id
    }

    console.log('FEEDBACK_CAPTURED', {
      id: feedback.id,
      isSatisfied,
      language,
      answerMode,
      hasHumanReply: Boolean(humanReply),
      shouldCreateFaq,
      shouldUpdateFaq,
      shouldAddRule,
      shouldAddSource,
      faqCandidateId,
    })

    return NextResponse.json({ success: true, id: feedback.id, faqCandidateId })
  } catch (error) {
    logError('feedback_capture_error', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    )
  }
}
