/**
 * GET /api/evidence/expired — List expired evidence records (V6 P1-2).
 *
 * V6 执行文件 §P1-2:
 *   "过期证据扫描端点"
 *
 * Returns all active evidence records whose expiryDate has passed.
 * Staff use this to know which evidence needs re-verification.
 */

import { NextResponse } from 'next/server'
import { findExpiredEvidence } from '@/lib/evidence/registry'
import { logError } from '@/lib/audit/logger'

export async function GET() {
  try {
    const expired = findExpiredEvidence()
    return NextResponse.json({
      ok: true,
      count: expired.length,
      records: expired,
    })
  } catch (error) {
    logError('evidence_expired_error', error)
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
