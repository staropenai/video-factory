/**
 * Live-FAQ overlay — Phase 3 sensing loop closure.
 *
 * Reads the `live_faqs` JSONL table on every call (no module-level cache,
 * because the file changes at runtime when staff publish new FAQs), adapts
 * each row into the same `FaqEntry` shape the retriever already understands,
 * and scores it against the query using the SAME expansion + saturation math
 * as `scoreQueryAgainstSeeds`. The two result sets merge in retrieve.ts.
 *
 * Why not re-import SEED_FAQS: live FAQs don't need to live in the hard-coded
 * seed. They live in the data dir, survive between requests on the same
 * Fluid Compute instance, and are immediately queryable the moment staff
 * press "Publish". No redeploy, no rebuild.
 */

import { listLiveFaqs, type LiveFaqRow } from '@/lib/db/tables'
import { expandQuery, type FaqEntry, type Category } from '@/lib/knowledge/seed'

/** Adapt a LiveFaqRow into the FaqEntry shape the retriever already uses. */
export function liveRowToFaqEntry(row: LiveFaqRow): FaqEntry {
  // LiveFaqRow.category has 'other' as an extra option that FaqEntry doesn't
  // model. Fold 'other' into 'daily_life' for retrieval purposes — it's the
  // most permissive bucket and the rule engine never branches on it.
  const category: Category =
    row.category === 'other' ? 'daily_life' : row.category
  return {
    id: row.id,
    category,
    subtopic: row.subtopic,
    representative_title: row.representative_title,
    user_question_pattern: row.representative_title, // no separate field; reuse
    pain_point: row.representative_title,
    standard_answer: row.standard_answer,
    next_step_confirm: row.next_step_confirm,
    next_step_prepare: row.next_step_prepare,
    next_step_contact: row.next_step_contact,
    next_step_warning: row.next_step_warning ?? undefined,
    target_user: [],
    risk_level: row.riskLevel,
    official_confirmation_required: row.riskLevel === 'high',
    source_type: 'community',
    language: 'multi',
    keywords: row.keywords,
    status: 'live',
    // Carry the published tier into the retrieval layer so retrieve.ts can
    // set up the Tier A/B LLM-shortcut path (v4 改进 #1).
    tier: row.tier ?? 'C',
  }
}

/** Count how many of a FAQ's keywords appear in the expanded query bag. */
function keywordHits(faq: FaqEntry, expanded: Set<string>): number {
  const all = [...faq.keywords.en, ...faq.keywords.zh, ...faq.keywords.ja]
  let hits = 0
  for (const kw of all) {
    if (!kw) continue
    const k = kw.toLowerCase()
    for (const e of expanded) {
      if (e.includes(k)) {
        hits++
        break
      }
    }
  }
  return hits
}

/**
 * Score every ACTIVE live FAQ against the expanded query using the same
 * saturation curve as `scoreQueryAgainstSeeds` so merged sorting is fair.
 */
export function scoreQueryAgainstOverlay(
  rawQuery: string,
): Array<{ faq: FaqEntry; score: number; hits: number }> {
  const rows = listLiveFaqs({ status: 'active' })
  if (rows.length === 0) return []

  const expanded = expandQuery(rawQuery)
  const scored = rows.map((row) => {
    const faq = liveRowToFaqEntry(row)
    const hits = keywordHits(faq, expanded)
    if (hits === 0) return { faq, score: 0, hits }
    const score = Math.min(1, 0.47 + hits * 0.15)
    return { faq, score, hits }
  })
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.hits - a.hits
    })
}
