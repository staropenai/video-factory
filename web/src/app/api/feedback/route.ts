/**
 * POST /api/feedback — capture human tester satisfaction signal.
 *
 * Body:
 *   {
 *     queryText: string,
 *     systemAnswer: string,
 *     answerMode: string,
 *     isSatisfied: boolean,
 *     humanReply?: string,    // required when isSatisfied === false
 *     language: 'en'|'zh'|'ja'
 *   }
 *
 * On success:
 *   - inserts a `user_feedback` row
 *   - if isSatisfied === false AND humanReply non-empty, also inserts a
 *     faq_candidates row with source='user_feedback', status='pending_review'
 *
 * Persistence: file-backed JSONL tables (see lib/db/tables.ts).
 * [KNOWN LIMITATION] On Vercel `/tmp` is per-instance and ephemeral across
 * cold starts; this is the explicit Phase-1 trade-off.
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

    const feedback = insertUserFeedback({
      queryText: queryText.slice(0, 1000),
      systemAnswer: systemAnswer.slice(0, 4000),
      answerMode,
      isSatisfied,
      humanReply: humanReply ? humanReply.slice(0, 4000) : null,
      language,
    })

    let faqCandidateId: string | undefined
    if (!isSatisfied && humanReply) {
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
