/**
 * GET|POST /api/evidence — Evidence Registry API (V6 P1-2).
 *
 * V6 执行文件 §P1-2:
 *   "证据库API（/api/evidence GET + POST）"
 *
 * GET  /api/evidence          — list/search evidence records
 *   Query params: topicTag, location, minConfidence, excludeExpired, status, type
 *
 * POST /api/evidence          — create a new evidence record
 *   Body: { type, topicTags, location, dateCollected, contentSummary,
 *           sourceUrl, filePath, confidenceLevel, expiryDate, linkedCardIds }
 *
 * Both paths validate input and return structured errors (Spec §13).
 */

import { NextRequest } from 'next/server'
import {
  insertEvidence,
  listEvidence,
  type EvidenceType,
  type EvidenceConfidence,
  type EvidenceStatus,
} from '@/lib/db/tables'
import {
  searchEvidence,
  type EvidenceSearchQuery,
} from '@/lib/evidence/registry'
import { logError } from '@/lib/audit/logger'
import { ok, fail, rateLimited } from '@/lib/utils/api-response'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'
import { sanitizeInput, stripControlChars } from '@/lib/utils/sanitize'

// Valid values for validation.
const VALID_TYPES: EvidenceType[] = [
  'official_brochure',
  'government_website',
  'on_site_photo',
  'window_inquiry',
  'other',
]
const VALID_CONFIDENCE: EvidenceConfidence[] = ['official', 'verified', 'unverified']

/** Stable structured-error builder (Spec §13). */
function err(
  code: string,
  message: string,
  status: number,
) {
  return fail(message, status, code)
}

// ---------------------------------------------------------------------
// GET — list / search evidence.
// ---------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`evidence:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.ai);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  try {
    const url = new URL(req.url)
    const topicTag = url.searchParams.get('topicTag')
    const location = url.searchParams.get('location')
    const minConfidence = url.searchParams.get('minConfidence')
    const excludeExpired = url.searchParams.get('excludeExpired')
    const status = url.searchParams.get('status')
    const type = url.searchParams.get('type')

    // If any of the search-specific params are set, use the registry
    // search which adds confidence ranking and sorting.
    const useSearch = topicTag || location || minConfidence || excludeExpired

    if (useSearch) {
      const query: EvidenceSearchQuery = {}
      if (topicTag) query.topicTags = topicTag.split(',').map((t) => t.trim())
      if (location) query.location = location
      if (minConfidence) {
        if (!VALID_CONFIDENCE.includes(minConfidence as EvidenceConfidence)) {
          return err('INVALID_CONFIDENCE', `minConfidence must be one of: ${VALID_CONFIDENCE.join(', ')}`, 400)
        }
        query.minConfidence = minConfidence as EvidenceConfidence
      }
      if (excludeExpired === 'true') query.excludeExpired = true

      const results = searchEvidence(query)
      return ok({ count: results.length, records: results })
    }

    // Simple list with optional filters.
    const filter: Parameters<typeof listEvidence>[0] = {}
    if (status) {
      if (!['active', 'expired', 'archived'].includes(status)) {
        return err('INVALID_STATUS', `status must be one of: active, expired, archived`, 400)
      }
      filter.status = status as EvidenceStatus
    }
    if (type) {
      if (!VALID_TYPES.includes(type as EvidenceType)) {
        return err('INVALID_TYPE', `type must be one of: ${VALID_TYPES.join(', ')}`, 400)
      }
      filter.type = type as EvidenceType
    }
    if (topicTag) filter.topicTag = topicTag

    const records = listEvidence(Object.keys(filter).length > 0 ? filter : undefined)
    return ok({ count: records.length, records })
  } catch (error) {
    logError('evidence_list_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500, 'INTERNAL')
  }
}

// ---------------------------------------------------------------------
// POST — create evidence record.
// ---------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`evidence:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.ai);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  try {
    const body = (await req.json()) as Record<string, unknown>

    // Required fields.
    if (!body.type || typeof body.type !== 'string') {
      return err('MISSING_FIELD', 'type is required', 400)
    }
    if (!VALID_TYPES.includes(body.type as EvidenceType)) {
      return err('INVALID_TYPE', `type must be one of: ${VALID_TYPES.join(', ')}`, 400)
    }
    if (!Array.isArray(body.topicTags) || body.topicTags.length === 0) {
      return err('MISSING_FIELD', 'topicTags must be a non-empty array of strings', 400)
    }
    if (!body.dateCollected || typeof body.dateCollected !== 'string') {
      return err('MISSING_FIELD', 'dateCollected is required (ISO-8601)', 400)
    }
    if (!body.contentSummary || typeof body.contentSummary !== 'string') {
      return err('MISSING_FIELD', 'contentSummary is required', 400)
    }
    if (!body.confidenceLevel || typeof body.confidenceLevel !== 'string') {
      return err('MISSING_FIELD', 'confidenceLevel is required', 400)
    }
    if (!VALID_CONFIDENCE.includes(body.confidenceLevel as EvidenceConfidence)) {
      return err('INVALID_VALUE', `confidenceLevel must be one of: ${VALID_CONFIDENCE.join(', ')}`, 400)
    }

    const record = insertEvidence({
      type: body.type as EvidenceType,
      topicTags: (body.topicTags as string[]).map((t: string) => stripControlChars(sanitizeInput(String(t), 120))),
      location: typeof body.location === 'string' ? stripControlChars(sanitizeInput(body.location, 200)) : null,
      dateCollected: body.dateCollected as string,
      contentSummary: stripControlChars(sanitizeInput(body.contentSummary as string, 4000)),
      sourceUrl: typeof body.sourceUrl === 'string' ? sanitizeInput(body.sourceUrl, 2000) : null,
      filePath: typeof body.filePath === 'string' ? sanitizeInput(body.filePath, 500) : null,
      confidenceLevel: body.confidenceLevel as EvidenceConfidence,
      expiryDate: typeof body.expiryDate === 'string' ? body.expiryDate : null,
      linkedCardIds: Array.isArray(body.linkedCardIds) ? body.linkedCardIds as string[] : [],
    })

    return ok({ record }, 201)
  } catch (error) {
    logError('evidence_create_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500, 'INTERNAL')
  }
}
