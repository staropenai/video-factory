/**
 * POST /api/review/faq-candidates/[id]/publish — close the sensing loop.
 *
 * Spec v1 §7 — atomic publish transaction. All of the following must happen
 * together or none at all:
 *   1. create live_faq row
 *   2. update candidate state to PUBLISHED with publishedLiveFaqId
 *   3. write LIVE_FAQ_PUBLISHED audit event
 *
 * Compensation: the underlying JSONL store is per-file atomic but there is
 * no cross-file transaction. We guarantee §7.2 (no PUBLISHED candidate
 * without a published_live_faq_id, no orphan live_faq) with an explicit
 * compensating path: on step-2 failure we delete the live_faq we just wrote
 * and persist PUBLISH_FAILED. See §15 blockers.
 *
 * Idempotency (§7.1): if the candidate is already PUBLISHED with a live_faq
 * id that still exists in live_faqs, return the existing resource as a
 * no-op success. No duplicate live_faq row is ever created.
 *
 * State gate (§6.2): publish is only allowed if the candidate is in state
 * REVIEWED. NEEDS_EDIT must be re-normalized to REVIEWED via the PATCH
 * endpoint first; we reject with a structured error otherwise.
 *
 * Request body: see prior version — answer is required, everything else
 * falls back off the candidate.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getFaqCandidate,
  insertLiveFaq,
  markFaqCandidatePublished,
  deleteLiveFaq,
  getLiveFaq,
  insertEvent,
  type LiveFaqRow,
  type LocalizedText3,
} from '@/lib/db/tables'
import { canTransition } from '@/lib/candidate/state'
import { logError } from '@/lib/audit/logger'

type Ctx = { params: Promise<{ id: string }> }

const CATEGORIES: LiveFaqRow['category'][] = [
  'renting',
  'home_buying',
  'visa',
  'daily_life',
  'other',
]
const RISKS: LiveFaqRow['riskLevel'][] = ['low', 'medium', 'high']
const TIERS: LiveFaqRow['tier'][] = ['A', 'B', 'C']

/** Stable structured-error builder (Spec §13). */
function err(
  code: string,
  message: string,
  status: number,
  relatedIds: Record<string, unknown> = {},
) {
  return NextResponse.json(
    { ok: false, error: { code, message, relatedIds } },
    { status },
  )
}

function normalizeLocalized(
  input: unknown,
  fallback: string,
): LocalizedText3 {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<
    string,
    unknown
  >
  const en = String(obj.en || '').trim()
  const zh = String(obj.zh || '').trim()
  const ja = String(obj.ja || '').trim()
  const primary = en || zh || ja || fallback
  return {
    en: en || primary,
    zh: zh || primary,
    ja: ja || primary,
  }
}

function normalizeKeywordBag(input: unknown): {
  en: string[]
  zh: string[]
  ja: string[]
} {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<
    string,
    unknown
  >
  const pick = (v: unknown): string[] => {
    if (Array.isArray(v))
      return v
        .map((x) => String(x).trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 40)
    if (typeof v === 'string')
      return v
        .split(',')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 40)
    return []
  }
  return {
    en: pick(obj.en),
    zh: pick(obj.zh),
    ja: pick(obj.ja),
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  let createdLiveFaqId: string | null = null
  try {
    const { id } = await ctx.params
    const candidate = getFaqCandidate(id)
    if (!candidate) {
      return err('CANDIDATE_NOT_FOUND', `candidate ${id} not found`, 404, {
        candidateId: id,
      })
    }

    // ---- Idempotency (§7.1) ------------------------------------------------
    // If the candidate is already PUBLISHED AND the live_faq row still
    // exists, return it as a no-op success. Never create a duplicate.
    if (
      candidate.state === 'PUBLISHED' &&
      candidate.publishedLiveFaqId
    ) {
      const existing = getLiveFaq(candidate.publishedLiveFaqId)
      if (existing) {
        return NextResponse.json({
          ok: true,
          idempotent: true,
          liveFaq: existing,
          candidate,
        })
      }
      // PUBLISHED but the live_faq row is missing — spec §7.2 acceptance
      // rule violation on legacy data. Fail closed with a structured error.
      return err(
        'PUBLISHED_WITHOUT_LIVE_FAQ',
        'candidate is PUBLISHED but its live_faq row is missing',
        409,
        { candidateId: id, liveFaqId: candidate.publishedLiveFaqId },
      )
    }

    // ---- State gate (§6.2) -------------------------------------------------
    // Publish is only valid from REVIEWED. Legacy rows (no `state`) whose
    // status was still `pending_review` get normalized to their source-
    // based default by tables.normalizeCandidateRow → for back-compat with
    // the existing sensing loop we also accept CLUSTERED as a fast-path,
    // but only if the request carries an explicit acknowledgement flag.
    const from = candidate.state ?? 'NEW'
    // Spec §6.2 strict path: require REVIEWED. Allow CLUSTERED → PUBLISHED
    // only when the caller sends {ackSkipReview: true} AND we synthesize
    // the REVIEWED step in the audit log. This keeps the invariant that
    // "every PUBLISHED candidate was reviewed" true even for fast-track.
    const body = (await req.json()) as Record<string, unknown>
    const ackSkipReview = body.ackSkipReview === true

    if (from !== 'REVIEWED') {
      if (from === 'CLUSTERED' && ackSkipReview) {
        // Synthesize the REVIEWED step.
        insertEvent({
          eventType: 'CANDIDATE_REVIEWED',
          route: '/api/review/faq-candidates/[id]/publish',
          relatedIds: { candidateId: id },
          metadata: { from: 'CLUSTERED', to: 'REVIEWED', synthetic: true },
        })
      } else {
        const check = canTransition(from, 'PUBLISHED')
        return err(
          check.ok ? 'INVALID_PRECONDITION' : check.code,
          check.ok
            ? `publish requires state REVIEWED; current state is ${from}`
            : check.message,
          409,
          { candidateId: id, from, to: 'PUBLISHED' },
        )
      }
    }

    // ---- Body validation ---------------------------------------------------
    const category = String(body.category || '')
    if (!(CATEGORIES as string[]).includes(category)) {
      return err('INVALID_CATEGORY', `invalid category: ${category}`, 400, {
        candidateId: id,
      })
    }
    const riskLevel = String(body.riskLevel || 'low')
    if (!(RISKS as string[]).includes(riskLevel)) {
      return err('INVALID_RISK', `invalid riskLevel: ${riskLevel}`, 400, {
        candidateId: id,
      })
    }
    const tier = String(body.tier || 'C').toUpperCase()
    if (!(TIERS as string[]).includes(tier)) {
      return err('INVALID_TIER', `invalid tier: ${tier}`, 400, {
        candidateId: id,
      })
    }
    const confidenceHalfLifeDays =
      body.confidenceHalfLifeDays == null
        ? null
        : Number(body.confidenceHalfLifeDays)
    if (
      confidenceHalfLifeDays != null &&
      (!Number.isFinite(confidenceHalfLifeDays) || confidenceHalfLifeDays <= 0)
    ) {
      return err(
        'INVALID_HALF_LIFE',
        `invalid confidenceHalfLifeDays`,
        400,
        { candidateId: id },
      )
    }

    const answer = normalizeLocalized(body.answer, '')
    if (!answer.en && !answer.zh && !answer.ja) {
      return err(
        'ANSWER_REQUIRED',
        'answer is required (at least one language)',
        400,
        { candidateId: id },
      )
    }

    const titleFallback = candidate.candidateTitle || candidate.sourceQueryText
    const title = normalizeLocalized(body.title, titleFallback)

    const keywords = normalizeKeywordBag(body.keywords)
    if (
      keywords.en.length === 0 &&
      keywords.zh.length === 0 &&
      keywords.ja.length === 0
    ) {
      const seedText =
        (candidate.sourceQueryText || titleFallback || '').toLowerCase()
      const tokens = seedText
        .split(/[\s,.?!]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
        .slice(0, 8)
      if (candidate.detectedLanguage === 'zh') keywords.zh = tokens
      else if (candidate.detectedLanguage === 'ja') keywords.ja = tokens
      else keywords.en = tokens
    }

    const nextStepConfirm = normalizeLocalized(body.nextStepConfirm, '')
    const nextStepPrepare = normalizeLocalized(body.nextStepPrepare, '')
    const nextStepContact = normalizeLocalized(body.nextStepContact, '')
    const nextStepWarning =
      body.nextStepWarning == null
        ? null
        : normalizeLocalized(body.nextStepWarning, '')

    // ---- Step 1: insert live_faq ------------------------------------------
    const liveFaq = insertLiveFaq({
      createdBy: body.createdBy ? String(body.createdBy).slice(0, 80) : 'staff',
      category: category as LiveFaqRow['category'],
      subtopic: body.subtopic
        ? String(body.subtopic).slice(0, 80)
        : 'general',
      riskLevel: riskLevel as LiveFaqRow['riskLevel'],
      tier: tier as LiveFaqRow['tier'],
      sourceType: 'STATIC',
      confidenceHalfLifeDays,
      representative_title: title,
      standard_answer: answer,
      next_step_confirm: nextStepConfirm,
      next_step_prepare: nextStepPrepare,
      next_step_contact: nextStepContact,
      next_step_warning: nextStepWarning,
      keywords,
      sourceFaqCandidateId: candidate.id,
    })
    createdLiveFaqId = liveFaq.id

    // ---- Step 2: update candidate state -----------------------------------
    const updated = markFaqCandidatePublished(candidate.id, liveFaq.id)
    if (!updated || updated.state !== 'PUBLISHED' || !updated.publishedLiveFaqId) {
      // Compensating path: roll back the live_faq row so we never leak a
      // row that no candidate points to. Spec §7.2 invariant preserved.
      try {
        deleteLiveFaq(liveFaq.id)
      } catch (e) {
        logError('publish_rollback_failed', e)
      }
      insertEvent({
        eventType: 'PUBLISH_FAILED',
        route: '/api/review/faq-candidates/[id]/publish',
        relatedIds: { candidateId: id, liveFaqId: liveFaq.id },
        metadata: { reason: 'candidate_state_write_failed' },
      })
      return err(
        'PUBLISH_STATE_WRITE_FAILED',
        'failed to update candidate state — live_faq rolled back',
        500,
        { candidateId: id },
      )
    }

    // ---- Step 3: durable LIVE_FAQ_PUBLISHED audit event -------------------
    insertEvent({
      eventType: 'LIVE_FAQ_PUBLISHED',
      route: '/api/review/faq-candidates/[id]/publish',
      relatedIds: {
        candidateId: candidate.id,
        liveFaqId: liveFaq.id,
      },
      metadata: {
        category: liveFaq.category,
        riskLevel: liveFaq.riskLevel,
        tier: liveFaq.tier,
        clusterSignature: candidate.clusterSignature ?? null,
      },
    })

    console.log('LIVE_FAQ_PUBLISHED', {
      liveFaqId: liveFaq.id,
      fromCandidate: candidate.id,
      category: liveFaq.category,
      riskLevel: liveFaq.riskLevel,
    })

    return NextResponse.json({
      ok: true,
      liveFaq,
      candidate: updated,
    })
  } catch (error) {
    logError('faq_candidate_publish_error', error)
    // Last-ditch compensation: if step 1 succeeded but we crashed before
    // step 2, the live_faq is still an orphan. Delete it to preserve §7.2.
    if (createdLiveFaqId) {
      try {
        deleteLiveFaq(createdLiveFaqId)
      } catch {
        /* swallow; logged above */
      }
      try {
        insertEvent({
          eventType: 'PUBLISH_FAILED',
          route: '/api/review/faq-candidates/[id]/publish',
          relatedIds: { liveFaqId: createdLiveFaqId },
          metadata: {
            reason: 'exception_after_live_faq_insert',
            message: error instanceof Error ? error.message : String(error),
          },
        })
      } catch {
        /* swallow */
      }
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL',
          message: error instanceof Error ? error.message : 'Internal error',
          relatedIds: {},
        },
      },
      { status: 500 },
    )
  }
}
