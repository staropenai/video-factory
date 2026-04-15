/**
 * GET /api/corrections/report — Error attribution report (TASK 17)
 *
 * Returns aggregated statistics about corrections for monitoring
 * and improving AI answer quality.
 */

import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/utils/api-response'
import { listCorrections } from '@/lib/correction/store'
import { generateErrorReport } from '@/lib/correction/error-report'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`report:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api)
  if (!rl.allowed) return fail('Rate limited', 429)

  const corrections = listCorrections()
  const report = generateErrorReport(corrections)

  return ok(report)
}
