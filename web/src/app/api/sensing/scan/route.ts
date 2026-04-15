/**
 * /api/sensing/scan — auto-sense high-frequency no-match clusters.
 *
 * GET    /api/sensing/scan                   list clusters (biggest first)
 * POST   /api/sensing/scan                   create a faq_candidate from a
 *                                             cluster  body: { signature, minCount? }
 *
 * Closes the first half of the sense → cluster → review → publish loop:
 * every /api/router invocation already writes to user_queries; this endpoint
 * groups the no-match queries, surfaces them to staff, and lets staff
 * convert a cluster into a reviewable faq_candidate with one click.
 *
 * The second half — publish a reviewed candidate into the live knowledge
 * base — lives at /api/review/faq-candidates/[id]/publish.
 */

import { NextRequest } from 'next/server'
import { ok, fail, notFound, rateLimited } from '@/lib/utils/api-response'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'
import {
  listUserQueries,
  insertFaqCandidate,
  insertEvent,
  type UserQueryRow,
} from '@/lib/db/tables'
import { clusterNoMatchQueries, type Cluster } from '@/lib/sensing/cluster'
import { logError } from '@/lib/audit/logger'
import { devLog } from '@/lib/utils/dev-log'
import { requireAdmin } from '@/lib/auth/admin-guard'

function parseNumber(v: string | null, fallback: number): number {
  if (!v) return fallback
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`sensing-scan:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.strict);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const authCheck = requireAdmin(req);
  if (!authCheck.ok) return authCheck.response;

  try {
    const url = new URL(req.url)
    const minCount = parseNumber(url.searchParams.get('minCount'), 2)
    const limit = parseNumber(url.searchParams.get('limit'), 50)
    const scanWindow = parseNumber(url.searchParams.get('window'), 500)

    const rows: UserQueryRow[] = listUserQueries(scanWindow)
    const clusters = clusterNoMatchQueries(rows, {
      noMatchOnly: true,
      minCount,
      limit,
    })
    const totalNoMatch = rows.filter((r) => !r.knowledgeFound).length

    return ok({
      clusters,
      totalNoMatch,
      totalScanned: rows.length,
      window: scanWindow,
      minCount,
    })
  } catch (error) {
    logError('sensing_scan_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`sensing-scan:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.strict);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const authCheck = requireAdmin(req);
  if (!authCheck.ok) return authCheck.response;

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('invalid_body')
  }

  try {
    const signature = String(body.signature || '').trim()
    if (!signature) {
      return fail('signature is required')
    }
    const minCount = Number(body.minCount || 2)
    const scanWindow = Number(body.window || 500)

    const rows = listUserQueries(scanWindow)
    const clusters = clusterNoMatchQueries(rows, {
      noMatchOnly: true,
      minCount,
      limit: 200,
    })
    const target = clusters.find((c) => c.signature === signature)
    if (!target) {
      return notFound(`Cluster "${signature}"`)
    }

    // Pick the most common language in the cluster as the candidate language.
    const dominantLang =
      (Object.entries(target.byLanguage).sort((a, b) => b[1] - a[1])[0]?.[0] as
        | 'en'
        | 'zh'
        | 'ja'
        | undefined) || 'en'

    const candidate = insertFaqCandidate({
      source: 'sensing',
      // Spec §6.1: sensing-sourced candidates are born CLUSTERED.
      state: 'CLUSTERED',
      sourceQueryText: target.sampleQuery,
      detectedLanguage: dominantLang,
      candidateTitle: target.sampleQuery.slice(0, 120),
      candidateAnswer: '', // staff fills in at publish time
      riskLevel: 'unknown',
      createdBy: 'sensing',
      clusterSignature: target.signature,
      clusterSize: target.count,
      clusterQueries: target.queries.slice(0, 20),
      notes: `Cluster of ${target.count} no-match queries between ${target.firstSeen.slice(
        0,
        10,
      )} and ${target.lastSeen.slice(0, 10)}`,
    })

    // Spec §8.3: persist CANDIDATE_CREATED (not console-only).
    insertEvent({
      eventType: 'CANDIDATE_CREATED',
      route: '/api/sensing/scan',
      relatedIds: { candidateId: candidate.id },
      metadata: {
        signature,
        clusterSize: target.count,
        dominantLang,
        sampleQuery: target.sampleQuery,
      },
    })
    devLog('SENSING_CANDIDATE_CREATED', {
      id: candidate.id,
      signature,
      clusterSize: target.count,
      dominantLang,
    })
    return ok({ candidate, cluster: target }, 201)
  } catch (error) {
    logError('sensing_scan_post_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}
