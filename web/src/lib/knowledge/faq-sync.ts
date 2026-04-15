/**
 * FAQ Sync Bridge — v9 module.
 *
 * Converts staropenai_v2 FAQ format (5-language flat JSON) into the main
 * system's FaqEntry format (3-language structured cards with tiers).
 *
 * This enables the lightweight staropenai FAQ content to be:
 *   1. Directly retrievable by the main router's keyword scorer
 *   2. Ranked alongside existing seed FAQs
 *   3. Tier-classified for shortcut decisions
 *
 * All exports are PURE — no I/O, no file reads. Takes the raw FAQ data
 * object as input (caller loads the JSON however they want).
 *
 * Patent relevance: improves FAQ coverage → reduces clarify/handoff rate
 * → directly measurable in Patent A (routing efficiency).
 */

import type { FaqEntry, Category, RiskLevel, FaqTier, LocalizedText } from '@/lib/knowledge/seed'

// ---------------------------------------------------------------------
// Types for staropenai FAQ format.
// ---------------------------------------------------------------------

export interface StarFaqTopic {
  keywords: Partial<Record<string, string[]>>
  answers: Partial<Record<string, string>>
  risk_level?: string
}

export type StarFaqData = Record<string, StarFaqTopic | { version?: string }>

// ---------------------------------------------------------------------
// Category mapping.
// ---------------------------------------------------------------------

const CATEGORY_MAP: Record<string, Category> = {
  garbage: 'daily_life',
  payslip: 'daily_life',
  address_change: 'daily_life',
  part_time_work: 'daily_life',
  move_out: 'renting',
  noise_complaint: 'renting',
  fraud_warning: 'renting',
  prompt_guide: 'daily_life',
  health_insurance: 'daily_life',
  tax: 'daily_life',
  visa: 'visa',
  contract: 'renting',
  deposit: 'renting',
}

const TIER_MAP: Record<string, FaqTier> = {
  garbage: 'B',           // Procedural steps
  payslip: 'B',           // Explanation with structure
  address_change: 'B',    // Step-by-step procedure
  part_time_work: 'B',    // Rules by visa type
  move_out: 'B',          // Timeline with steps
  noise_complaint: 'B',   // Step-by-step procedure
  fraud_warning: 'A',     // Immediate action — short directive
  prompt_guide: 'B',      // Educational content
  health_insurance: 'B',  // Procedural with window info
  tax: 'B',               // Rules with conditions
  visa: 'B',              // Procedural with address
  contract: 'B',          // Advisory with contacts
  deposit: 'B',           // Rights + procedure
}

// ---------------------------------------------------------------------
// Conversion functions.
// ---------------------------------------------------------------------

/**
 * Convert a single staropenai FAQ topic into a FaqEntry.
 * Returns null if the topic has no usable content.
 */
export function convertTopic(key: string, topic: StarFaqTopic): FaqEntry | null {
  if (!topic.keywords || !topic.answers) return null

  const zh = topic.answers.zh ?? topic.answers.en ?? ''
  const ja = topic.answers.ja ?? topic.answers.en ?? ''
  const en = topic.answers.en ?? topic.answers.zh ?? ''

  if (!zh && !ja && !en) return null

  const category = CATEGORY_MAP[key] ?? 'daily_life'
  const tier = TIER_MAP[key] ?? 'C'

  // Extract "next step" from answers (they all end with **下一步/次のステップ/Next step**)
  const nextStepZh = extractNextStep(zh)
  const nextStepJa = extractNextStep(ja)
  const nextStepEn = extractNextStep(en)

  // Extract keywords for the 3 main languages
  const kw = topic.keywords
  const keywords = {
    en: (kw.en ?? []).map((w) => w.toLowerCase()),
    zh: kw.zh ?? [],
    ja: kw.ja ?? [],
  }

  // Merge vi/tl keywords into en keywords for broader matching
  const viKw = kw.vi ?? []
  const tlKw = kw.tl ?? []
  keywords.en = [...keywords.en, ...viKw.map((w) => w.toLowerCase()), ...tlKw.map((w) => w.toLowerCase())]

  const riskLevel: RiskLevel = topic.risk_level === 'HIGH' ? 'high' : 'low'

  const makeLocalized = (e: string, z: string, j: string): LocalizedText => ({
    en: e || z || j,
    zh: z || e || j,
    ja: j || e || z,
  })

  return {
    id: `star-${key}`,
    category,
    subtopic: key.replace(/_/g, ' '),
    representative_title: makeLocalized(
      humanizeKey(key),
      humanizeKey(key),
      humanizeKey(key),
    ),
    user_question_pattern: makeLocalized(
      `Questions about ${key.replace(/_/g, ' ')}`,
      `${key.replace(/_/g, ' ')}に関する質問`,
      `关于${key.replace(/_/g, ' ')}的问题`,
    ),
    pain_point: makeLocalized(en, zh, ja),
    standard_answer: makeLocalized(
      stripNextStep(en),
      stripNextStep(zh),
      stripNextStep(ja),
    ),
    next_step_confirm: makeLocalized('', '', ''),
    next_step_prepare: makeLocalized('', '', ''),
    next_step_contact: makeLocalized(
      nextStepEn,
      nextStepZh,
      nextStepJa,
    ),
    target_user: ['foreigner_in_japan'],
    risk_level: riskLevel,
    official_confirmation_required: riskLevel === 'high',
    source_type: 'seed',
    language: 'multi',
    keywords,
    status: 'live',
    tier,
  }
}

/**
 * Convert an entire staropenai FAQ data object into FaqEntry[].
 * Skips _meta and any topic that fails conversion.
 */
export function convertAll(data: StarFaqData): FaqEntry[] {
  const entries: FaqEntry[] = []

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('_')) continue
    const topic = value as StarFaqTopic
    if (!topic.keywords) continue

    const entry = convertTopic(key, topic)
    if (entry) entries.push(entry)
  }

  return entries
}

/**
 * Compute sync diff between existing FaqEntries and staropenai topics.
 * Returns which topics are new, updated (keyword changes), or unchanged.
 */
export interface SyncDiff {
  added: string[]
  updated: string[]
  unchanged: string[]
  totalStarTopics: number
  totalExistingSeeds: number
}

export function computeSyncDiff(
  existing: Array<{ id: string; keywords: { en: string[]; zh: string[]; ja: string[] } }>,
  starData: StarFaqData,
): SyncDiff {
  const existingIds = new Set(existing.map((e) => e.id))
  const starKeys = Object.keys(starData).filter((k) => !k.startsWith('_'))

  const added: string[] = []
  const updated: string[] = []
  const unchanged: string[] = []

  for (const key of starKeys) {
    const starId = `star-${key}`
    if (!existingIds.has(starId)) {
      added.push(key)
    } else {
      // Check if keywords changed
      const ex = existing.find((e) => e.id === starId)
      const topic = starData[key] as StarFaqTopic
      if (ex && topic.keywords) {
        const newKwCount = Object.values(topic.keywords).flat().length
        const oldKwCount = ex.keywords.en.length + ex.keywords.zh.length + ex.keywords.ja.length
        if (newKwCount !== oldKwCount) {
          updated.push(key)
        } else {
          unchanged.push(key)
        }
      } else {
        unchanged.push(key)
      }
    }
  }

  return {
    added,
    updated,
    unchanged,
    totalStarTopics: starKeys.length,
    totalExistingSeeds: existing.length,
  }
}

// ---------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function extractNextStep(text: string): string {
  // ES2017 compatible — no /s flag, use [\s\S] instead
  const patterns = [
    /\*\*下一步[：:](.+?)(?:\*\*|$)/,
    /\*\*次のステップ[：:](.+?)(?:\*\*|$)/,
    /\*\*Next step[：:](.+?)(?:\*\*|$)/i,
    /\*\*Bước tiếp theo[：:](.+?)(?:\*\*|$)/i,
    /\*\*Susunod[：:](.+?)(?:\*\*|$)/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return m[1].trim()
  }
  return ''
}

function stripNextStep(text: string): string {
  // ES2017 compatible — no /s flag
  return text
    .replace(/\*\*下一步[：:][\s\S]*$/, '')
    .replace(/\*\*次のステップ[：:][\s\S]*$/, '')
    .replace(/\*\*Next step[：:][\s\S]*$/i, '')
    .replace(/\*\*Bước tiếp theo[：:][\s\S]*$/i, '')
    .replace(/\*\*Susunod[：:][\s\S]*$/i, '')
    .trim()
}
