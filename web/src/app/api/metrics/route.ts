/**
 * GET /api/metrics — Routing metrics + alerts + gap summary (V6 P1-5).
 *
 * V6 执行文件 §P1-5:
 *   "监控端点 /api/metrics（layer stats + alerts + gap summary）"
 *
 * Returns:
 *   - Layer hit rates (L1..L6) with target comparison
 *   - Firing alerts (thresholds from V6 §P0-2)
 *   - System status (healthy / warning / critical)
 *   - Top knowledge gaps (from gap detector)
 *
 * Query params:
 *   since   — ISO-8601 timestamp to filter events from
 *   gaps    — "true" to include knowledge gap summary (default: true)
 *   limit   — max gaps to return (default: 10)
 */

import { NextRequest, NextResponse } from 'next/server'
import { captureSnapshot, type MetricSnapshot } from '@/lib/routing/metrics'
import { detectKnowledgeGaps, type GapDetectorResult } from '@/lib/pipeline/gap-detector'
import { logError } from '@/lib/audit/logger'

export interface MetricsResponse {
  ok: true
  snapshot: MetricSnapshot
  gaps?: GapDetectorResult
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const since = url.searchParams.get('since') ?? undefined
    const includeGaps = url.searchParams.get('gaps') !== 'false'
    const gapLimit = Math.min(
      Math.max(1, Number(url.searchParams.get('limit')) || 10),
      50,
    )

    // Layer hit rates + alerts.
    const snapshot = captureSnapshot(since)

    // Knowledge gaps (optional but on by default).
    let gaps: GapDetectorResult | undefined
    if (includeGaps) {
      try {
        gaps = detectKnowledgeGaps({ limit: gapLimit })
      } catch {
        // Gap detection is non-critical — don't fail the whole endpoint.
        gaps = undefined
      }
    }

    const response: MetricsResponse = { ok: true, snapshot }
    if (gaps) response.gaps = gaps

    return NextResponse.json(response)
  } catch (error) {
    logError('metrics_route_error', error)
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
