/**
 * POST /api/corrections — Human correction entry point (TASK 16)
 * GET  /api/corrections — List corrections
 *
 * Allows staff to submit corrections when AI answers are wrong.
 * Corrections are persisted and can be applied to the knowledge base.
 */

import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/utils/api-response'
import { insertCorrection, listCorrections } from '@/lib/correction/store'
import { CORRECTION_TYPES } from '@/lib/correction/types'
import type { CorrectionType } from '@/lib/correction/types'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`corrections:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api)
  if (!rl.allowed) return fail('Rate limited', 429)

  try {
    const body = await req.json()

    // Validate required fields
    const {
      requestId,
      originalQuery,
      originalAnswer,
      correctedAnswer,
      correctionType,
      explanation,
      correctedBy,
    } = body

    if (!requestId || !originalQuery || !correctedAnswer || !correctionType || !explanation) {
      return fail('Missing required fields: requestId, originalQuery, correctedAnswer, correctionType, explanation')
    }

    if (!CORRECTION_TYPES.includes(correctionType as CorrectionType)) {
      return fail(`Invalid correctionType. Must be one of: ${CORRECTION_TYPES.join(', ')}`)
    }

    const record = insertCorrection({
      requestId,
      caseId: body.caseId,
      originalQuery: String(originalQuery).slice(0, 1000),
      originalAnswer: String(originalAnswer ?? '').slice(0, 2000),
      correctedAnswer: String(correctedAnswer).slice(0, 2000),
      correctionType: correctionType as CorrectionType,
      explanation: String(explanation).slice(0, 500),
      correctedBy: String(correctedBy ?? 'anonymous').slice(0, 100),
      originalAnswerType: String(body.originalAnswerType ?? 'unknown'),
      originalWasVerified: Boolean(body.originalWasVerified),
      originalTier: String(body.originalTier ?? 'unknown'),
      originalRuleKeys: Array.isArray(body.originalRuleKeys) ? body.originalRuleKeys : [],
    })

    return ok(record)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`corrections:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api)
  if (!rl.allowed) return fail('Rate limited', 429)

  const url = new URL(req.url)
  const correctionType = url.searchParams.get('type') as CorrectionType | null
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200)

  const corrections = listCorrections({
    correctionType: correctionType ?? undefined,
    limit,
  })

  return ok({ corrections, total: corrections.length })
}
