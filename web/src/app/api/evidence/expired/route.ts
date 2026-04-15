/**
 * GET /api/evidence/expired — List expired evidence records (V6 P1-2).
 *
 * V6 执行文件 §P1-2:
 *   "过期证据扫描端点"
 *
 * Returns all active evidence records whose expiryDate has passed.
 * Staff use this to know which evidence needs re-verification.
 */

import { NextRequest } from 'next/server'
import { findExpiredEvidence } from '@/lib/evidence/registry'
import { logError } from '@/lib/audit/logger'
import { ok, fail, rateLimited } from '@/lib/utils/api-response'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`evidence-expired:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.ai);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  try {
    const expired = findExpiredEvidence()
    return ok({
      count: expired.length,
      records: expired,
    })
  } catch (error) {
    logError('evidence_expired_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500, 'INTERNAL')
  }
}
