/**
 * GET /api/analytics — v9 feedback analysis + quality statistics.
 *
 * Returns:
 *   - Feedback analysis (FAQ gaps, quality issues, escalation patterns)
 *   - Question quality statistics (from recent queries)
 *   - FAQ sync status (star topics vs seed topics)
 *
 * This powers the review dashboard and feeds into patent evidence.
 */

import { NextRequest } from 'next/server'
import { listUserFeedback, listUserQueries } from '@/lib/db/tables'
import { analyzeFeedback, type FeedbackRecord } from '@/lib/patent/feedback-analyzer'
import { scoreQuestionQuality, computeQualityStats } from '@/lib/ai/question-quality'
import { logError } from '@/lib/audit/logger'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { ok, fail, rateLimited } from '@/lib/utils/api-response'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`analytics:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const authCheck = requireAdmin(req);
  if (!authCheck.ok) return authCheck.response;

  try {
    // ── 1. Feedback analysis ────────────────────────────────────
    const rawFeedback = listUserFeedback(500)
    const feedbackRecords: FeedbackRecord[] = rawFeedback.map((f) => ({
      id: f.id,
      queryText: f.queryText,
      systemAnswer: f.systemAnswer,
      answerMode: f.answerMode,
      isSatisfied: f.isSatisfied,
      humanReply: f.humanReply ?? null,
      language: f.language,
      category: f.category ?? null,
      subtopic: f.subtopic ?? null,
      faqKey: null, // Not stored in current feedback rows
      shouldCreateFaq: f.shouldCreateFaq ?? false,
      shouldUpdateFaq: f.shouldUpdateFaq ?? false,
      timestamp: f.createdAt,
    }))

    const feedbackAnalysis = analyzeFeedback(feedbackRecords)

    // ── 2. Question quality stats from recent queries ───────────
    const recentQueries = listUserQueries(200)
    const qualityScores = recentQueries
      .slice(-200) // last 200 queries
      .map((q) => scoreQuestionQuality(q.queryText))

    const qualityStats = computeQualityStats(qualityScores)

    // ── 3. Summary ──────────────────────────────────────────────
    return ok({
      generated_at: new Date().toISOString(),
      feedback: feedbackAnalysis,
      questionQuality: qualityStats,
      patent_note:
        'This data feeds Patent A (routing efficiency via query quality) ' +
        'and Patent B (evidence quality via feedback loops).',
    })
  } catch (error) {
    logError('analytics_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}
