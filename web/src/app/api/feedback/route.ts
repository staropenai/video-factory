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

import { NextRequest } from 'next/server'
import { insertUserFeedback, insertFaqCandidate } from '@/lib/db/tables'
import { logError } from '@/lib/audit/logger'
import { devLog } from '@/lib/utils/dev-log'
import { sanitizeInput, stripControlChars } from '@/lib/utils/sanitize'
import {
  checkRateLimit,
  extractClientIp,
  RATE_LIMIT_PRESETS,
} from '@/lib/security/rate-limit'
import { ok, fail, rateLimited } from '@/lib/utils/api-response'

type Lang = 'en' | 'zh' | 'ja'

function normalizeLang(value: unknown): Lang {
  return value === 'zh' || value === 'ja' ? value : 'en'
}

export async function POST(req: NextRequest) {
  // Per-IP rate limit — feedback submission, use "auth" preset (10 req/min).
  const rl = checkRateLimit(
    `feedback:${extractClientIp(req.headers)}`,
    RATE_LIMIT_PRESETS.auth,
  );
  if (!rl.allowed) {
    return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));
  }

  try {
    const body = await req.json()
    const queryText = sanitizeInput(String(body.queryText || ''), 1000)
    const systemAnswer = sanitizeInput(String(body.systemAnswer || ''), 4000)
    const answerMode = String(body.answerMode || '').trim() || 'unknown'
    const isSatisfied = Boolean(body.isSatisfied)
    const humanReply = sanitizeInput(String(body.humanReply || ''), 4000)
    const language = normalizeLang(body.language)

    if (!queryText) {
      return fail('queryText is required')
    }
    if (typeof body.isSatisfied !== 'boolean') {
      return fail('isSatisfied is required')
    }

    // §7.2 extended writeback fields — all optional, all clamped.
    const resolutionSummary = body.resolutionSummary
      ? stripControlChars(sanitizeInput(String(body.resolutionSummary), 4000))
      : null
    const shouldCreateFaq = Boolean(body.shouldCreateFaq)
    const shouldUpdateFaq = Boolean(body.shouldUpdateFaq)
    const shouldAddRule = Boolean(body.shouldAddRule)
    const shouldAddSource = Boolean(body.shouldAddSource)
    const notes = body.notes ? stripControlChars(sanitizeInput(String(body.notes), 2000)) : null
    const category = body.category ? stripControlChars(sanitizeInput(String(body.category), 80)) : null
    const subtopic = body.subtopic ? stripControlChars(sanitizeInput(String(body.subtopic), 80)) : null

    const feedback = insertUserFeedback({
      queryText: stripControlChars(queryText),
      systemAnswer: stripControlChars(systemAnswer),
      answerMode,
      isSatisfied,
      humanReply: humanReply ? stripControlChars(humanReply) : null,
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

    devLog('FEEDBACK_CAPTURED', {
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

    return ok({ id: feedback.id, faqCandidateId })
  } catch (error) {
    logError('feedback_capture_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}
