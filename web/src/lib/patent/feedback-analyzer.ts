/**
 * Feedback Analyzer — v9 module.
 *
 * Analyzes user feedback patterns to identify:
 *   1. FAQ gaps — queries that consistently get "not satisfied" with no FAQ match
 *   2. Answer quality issues — queries that match FAQs but users still unsatisfied
 *   3. Escalation patterns — what triggers L6 human handoffs
 *   4. Language coverage gaps — which languages get worse satisfaction
 *
 * All exports are PURE — no I/O. Operates on arrays of feedback records.
 *
 * Patent relevance:
 *   - Patent A: routing efficiency improvement via feedback signal
 *   - Patent B: evidence quality measurement (post-injection satisfaction)
 */

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export interface FeedbackRecord {
  id: string
  queryText: string
  systemAnswer: string
  answerMode: string
  isSatisfied: boolean
  humanReply: string | null
  language: string
  category?: string | null
  subtopic?: string | null
  faqKey?: string | null
  shouldCreateFaq?: boolean
  shouldUpdateFaq?: boolean
  timestamp?: string
}

export interface FaqGap {
  /** Representative query text */
  query: string
  /** Number of unsatisfied queries in this cluster */
  count: number
  /** Languages affected */
  languages: string[]
  /** Human-provided answers (if any) */
  humanReplies: string[]
  /** Suggested category based on query content */
  suggestedCategory: string | null
  /** Priority: HIGH if count >= 3 or explicitly flagged */
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface AnswerQualityIssue {
  faqKey: string
  totalFeedback: number
  satisfiedCount: number
  unsatisfiedCount: number
  satisfactionRate: number
  /** Most common complaints (humanReply texts) */
  complaints: string[]
  /** Languages with lowest satisfaction */
  worstLanguages: string[]
}

export interface EscalationPattern {
  answerMode: string
  count: number
  satisfactionRate: number
  topCategories: string[]
}

export interface LanguageCoverage {
  language: string
  totalQueries: number
  satisfactionRate: number
  topGaps: string[]
}

export interface FeedbackAnalysis {
  totalFeedback: number
  overallSatisfactionRate: number
  faqGaps: FaqGap[]
  answerQualityIssues: AnswerQualityIssue[]
  escalationPatterns: EscalationPattern[]
  languageCoverage: LanguageCoverage[]
  /** Actionable next steps sorted by priority */
  actionItems: string[]
}

// ---------------------------------------------------------------------
// Pure analysis functions.
// ---------------------------------------------------------------------

/**
 * Identify FAQ gaps — unsatisfied queries with no FAQ match.
 * Groups similar queries by simple keyword overlap.
 */
export function identifyFaqGaps(records: FeedbackRecord[]): FaqGap[] {
  const unsatisfied = records.filter((r) => !r.isSatisfied && !r.faqKey)
  if (unsatisfied.length === 0) return []

  // Simple clustering by shared significant words (>= 2 chars)
  const clusters: Map<string, FeedbackRecord[]> = new Map()

  for (const r of unsatisfied) {
    const words = extractSignificantWords(r.queryText)
    let matched = false

    for (const [key, group] of clusters) {
      const keyWords = new Set(key.split('|'))
      const overlap = words.filter((w) => keyWords.has(w)).length
      if (overlap >= 1) {
        group.push(r)
        matched = true
        break
      }
    }

    if (!matched) {
      clusters.set(words.join('|'), [r])
    }
  }

  return Array.from(clusters.entries())
    .map(([_key, group]) => {
      const langs = [...new Set(group.map((r) => r.language))]
      const replies = group
        .map((r) => r.humanReply)
        .filter((r): r is string => r !== null && r.length > 0)
      const flagged = group.some((r) => r.shouldCreateFaq)

      return {
        query: group[0].queryText,
        count: group.length,
        languages: langs,
        humanReplies: replies.slice(0, 3),
        suggestedCategory: group[0].category ?? null,
        priority: (group.length >= 3 || flagged ? 'HIGH' : group.length >= 2 ? 'MEDIUM' : 'LOW') as FaqGap['priority'],
      }
    })
    .sort((a, b) => {
      const prio = { HIGH: 0, MEDIUM: 1, LOW: 2 }
      return prio[a.priority] - prio[b.priority] || b.count - a.count
    })
}

/**
 * Identify FAQ answer quality issues — FAQs with low satisfaction.
 */
export function identifyAnswerQualityIssues(
  records: FeedbackRecord[],
  minFeedback: number = 2,
): AnswerQualityIssue[] {
  const byFaq = new Map<string, FeedbackRecord[]>()

  for (const r of records) {
    if (!r.faqKey) continue
    const group = byFaq.get(r.faqKey) ?? []
    group.push(r)
    byFaq.set(r.faqKey, group)
  }

  return Array.from(byFaq.entries())
    .filter(([_, group]) => group.length >= minFeedback)
    .map(([faqKey, group]) => {
      const satisfied = group.filter((r) => r.isSatisfied).length
      const unsatisfied = group.length - satisfied
      const rate = satisfied / group.length

      const complaints = group
        .filter((r) => !r.isSatisfied && r.humanReply)
        .map((r) => r.humanReply!)
        .slice(0, 5)

      // Find worst languages
      const byLang = new Map<string, { total: number; satisfied: number }>()
      for (const r of group) {
        const l = byLang.get(r.language) ?? { total: 0, satisfied: 0 }
        l.total++
        if (r.isSatisfied) l.satisfied++
        byLang.set(r.language, l)
      }
      const worstLanguages = Array.from(byLang.entries())
        .filter(([_, v]) => v.total >= 1 && v.satisfied / v.total < rate)
        .map(([lang]) => lang)

      return {
        faqKey,
        totalFeedback: group.length,
        satisfiedCount: satisfied,
        unsatisfiedCount: unsatisfied,
        satisfactionRate: Math.round(rate * 1000) / 1000,
        complaints,
        worstLanguages,
      }
    })
    .filter((issue) => issue.satisfactionRate < 0.8) // Only report if <80%
    .sort((a, b) => a.satisfactionRate - b.satisfactionRate)
}

/**
 * Analyze escalation patterns by answer mode.
 */
export function analyzeEscalationPatterns(records: FeedbackRecord[]): EscalationPattern[] {
  const byMode = new Map<string, FeedbackRecord[]>()

  for (const r of records) {
    const group = byMode.get(r.answerMode) ?? []
    group.push(r)
    byMode.set(r.answerMode, group)
  }

  return Array.from(byMode.entries())
    .map(([mode, group]) => {
      const satisfied = group.filter((r) => r.isSatisfied).length
      const categories = [...new Set(group.map((r) => r.category).filter(Boolean))] as string[]

      return {
        answerMode: mode,
        count: group.length,
        satisfactionRate: Math.round((satisfied / group.length) * 1000) / 1000,
        topCategories: categories.slice(0, 5),
      }
    })
    .sort((a, b) => b.count - a.count)
}

/**
 * Analyze language coverage.
 */
export function analyzeLanguageCoverage(records: FeedbackRecord[]): LanguageCoverage[] {
  const byLang = new Map<string, FeedbackRecord[]>()

  for (const r of records) {
    const group = byLang.get(r.language) ?? []
    group.push(r)
    byLang.set(r.language, group)
  }

  return Array.from(byLang.entries())
    .map(([lang, group]) => {
      const satisfied = group.filter((r) => r.isSatisfied).length
      const unsatisfiedNoFaq = group.filter((r) => !r.isSatisfied && !r.faqKey)
      const topGaps = unsatisfiedNoFaq.slice(0, 3).map((r) => r.queryText)

      return {
        language: lang,
        totalQueries: group.length,
        satisfactionRate: Math.round((satisfied / group.length) * 1000) / 1000,
        topGaps,
      }
    })
    .sort((a, b) => a.satisfactionRate - b.satisfactionRate)
}

/**
 * Run full feedback analysis and generate action items.
 */
export function analyzeFeedback(records: FeedbackRecord[]): FeedbackAnalysis {
  if (records.length === 0) {
    return {
      totalFeedback: 0,
      overallSatisfactionRate: 0,
      faqGaps: [],
      answerQualityIssues: [],
      escalationPatterns: [],
      languageCoverage: [],
      actionItems: ['No feedback data yet. Deploy and collect user feedback.'],
    }
  }

  const satisfied = records.filter((r) => r.isSatisfied).length
  const overallRate = Math.round((satisfied / records.length) * 1000) / 1000

  const faqGaps = identifyFaqGaps(records)
  const qualityIssues = identifyAnswerQualityIssues(records)
  const escalation = analyzeEscalationPatterns(records)
  const langCoverage = analyzeLanguageCoverage(records)

  // Generate prioritized action items
  const actionItems: string[] = []

  const highGaps = faqGaps.filter((g) => g.priority === 'HIGH')
  if (highGaps.length > 0) {
    actionItems.push(
      `CREATE FAQ: ${highGaps.length} high-priority topic(s) missing — "${highGaps[0].query}"${highGaps.length > 1 ? ` (+${highGaps.length - 1} more)` : ''}`,
    )
  }

  for (const issue of qualityIssues.slice(0, 3)) {
    actionItems.push(
      `IMPROVE FAQ "${issue.faqKey}": ${Math.round(issue.satisfactionRate * 100)}% satisfaction (${issue.unsatisfiedCount} complaints)`,
    )
  }

  const lowLangs = langCoverage.filter((l) => l.satisfactionRate < 0.5)
  if (lowLangs.length > 0) {
    actionItems.push(
      `LANGUAGE GAP: ${lowLangs.map((l) => `${l.language} (${Math.round(l.satisfactionRate * 100)}%)`).join(', ')} need better coverage`,
    )
  }

  if (overallRate < 0.6) {
    actionItems.push(
      `OVERALL: Satisfaction at ${Math.round(overallRate * 100)}% — below 60% target. Review top complaints.`,
    )
  }

  if (actionItems.length === 0) {
    actionItems.push(`All metrics healthy. Overall satisfaction: ${Math.round(overallRate * 100)}%`)
  }

  return {
    totalFeedback: records.length,
    overallSatisfactionRate: overallRate,
    faqGaps,
    answerQualityIssues: qualityIssues,
    escalationPatterns: escalation,
    languageCoverage: langCoverage,
    actionItems,
  }
}

// ---------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------

function extractSignificantWords(text: string): string[] {
  // Split on non-word boundaries, keep words >= 2 chars
  const words = text.toLowerCase().split(/[\s,.\-!?;：，。！？、]+/)
  return words.filter((w) => w.length >= 2).slice(0, 10)
}
