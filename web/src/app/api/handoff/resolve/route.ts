/**
 * POST /api/handoff/resolve — staff writeback for a queued handoff.
 *
 * Body:
 *   {
 *     id: string,                  // handoff row id
 *     humanReply: string,          // what the staff actually told the user
 *     resolution: string,          // internal note: outcome / next action
 *     resolvedBy?: string,         // staff id / name (default "staff")
 *     createFaqCandidate?: boolean // if true, also insert into faq_candidates
 *     candidateTitle?: string,     // optional override; defaults to query text
 *     candidateAnswer?: string     // optional override; defaults to humanReply
 *   }
 *
 * On success:
 *   - handoff row → status="resolved", humanReply / resolution / resolvedAt set
 *   - if createFaqCandidate is true, a faq_candidates row is inserted with
 *     status="pending_review" and linked back to the handoff via id
 *
 * Persistence: file-backed JSONL tables (see lib/db/tables.ts).
 * [KNOWN LIMITATION] On Vercel `/tmp` is per-instance and ephemeral across
 * cold starts; this is the explicit Phase-1 trade-off.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  resolveHandoffRow,
  insertFaqCandidate,
  getHandoff,
} from '@/lib/db/tables'
import { logError, logEscalation } from '@/lib/audit/logger'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const id = String(body.id || '').trim()
    const humanReply = String(body.humanReply || '').trim()
    const resolution = String(body.resolution || '').trim()
    const resolvedBy = String(body.resolvedBy || 'staff').trim() || 'staff'
    const createFaqCandidate = Boolean(body.createFaqCandidate)
    const candidateTitleOverride = String(body.candidateTitle || '').trim()
    const candidateAnswerOverride = String(body.candidateAnswer || '').trim()

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    if (!humanReply) {
      return NextResponse.json({ error: 'humanReply is required' }, { status: 400 })
    }

    const existing = getHandoff(id)
    if (!existing) {
      return NextResponse.json({ error: 'handoff not found' }, { status: 404 })
    }

    // Optionally create the FAQ candidate first so we can link its id into
    // the handoff row in a single rewrite.
    let candidateId: string | undefined
    if (createFaqCandidate) {
      const candidate = insertFaqCandidate({
        source: 'handoff',
        sourceHandoffId: id,
        sourceQueryText: existing.queryText,
        detectedLanguage: existing.detectedLanguage,
        candidateTitle: candidateTitleOverride || existing.queryText.slice(0, 120),
        candidateAnswer: candidateAnswerOverride || humanReply,
        riskLevel: existing.riskLevel,
        createdBy: resolvedBy,
      })
      candidateId = candidate.id
    }

    const updated = resolveHandoffRow(id, {
      humanReply,
      resolution,
      resolvedBy,
      faqCandidateId: candidateId,
    })
    if (!updated) {
      return NextResponse.json({ error: 'handoff not found' }, { status: 404 })
    }

    logEscalation(id, 'handoff_resolved', resolvedBy, {
      humanReplyLength: humanReply.length,
      resolutionLength: resolution.length,
      createdFaqCandidate: Boolean(candidateId),
      faqCandidateId: candidateId,
    })

    return NextResponse.json({ ok: true, entry: updated, faqCandidateId: candidateId })
  } catch (error) {
    logError('handoff_resolve_error', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    )
  }
}
