/**
 * Error Attribution Reports (TASK 17)
 *
 * Analyzes correction records to produce reports showing:
 * - Which correction types occur most frequently
 * - Which tiers produce the most errors
 * - Which answer types are most often wrong
 * - Whether verified answers are being corrected (critical signal)
 */

import type { CorrectionRecord, CorrectionType } from './types'

export interface ErrorAttributionReport {
  /** Report generation timestamp */
  generatedAt: string
  /** Total corrections analyzed */
  totalCorrections: number
  /** Breakdown by correction type */
  byType: Record<string, number>
  /** Breakdown by tier (A, B, C, L6) */
  byTier: Record<string, number>
  /** Breakdown by original answer type */
  byAnswerType: Record<string, number>
  /** How many verified answers were corrected (critical metric) */
  verifiedButWrong: number
  /** Percentage of verified answers that needed correction */
  verifiedErrorRate: number
  /** Top rules that co-occur with errors */
  topErrorRules: Array<{ ruleKey: string; count: number }>
  /** Whether corrections have been applied to knowledge base */
  pendingKbUpdates: number
}

/**
 * Generate an error attribution report from correction records.
 */
export function generateErrorReport(corrections: CorrectionRecord[]): ErrorAttributionReport {
  const byType: Record<string, number> = {}
  const byTier: Record<string, number> = {}
  const byAnswerType: Record<string, number> = {}
  const ruleCounts: Record<string, number> = {}
  let verifiedButWrong = 0
  let totalVerified = 0
  let pendingKbUpdates = 0

  for (const c of corrections) {
    // By correction type
    byType[c.correctionType] = (byType[c.correctionType] ?? 0) + 1

    // By tier
    byTier[c.originalTier] = (byTier[c.originalTier] ?? 0) + 1

    // By answer type
    byAnswerType[c.originalAnswerType] = (byAnswerType[c.originalAnswerType] ?? 0) + 1

    // Verified but wrong
    if (c.originalWasVerified) {
      totalVerified++
      verifiedButWrong++
    }

    // Rule co-occurrence
    for (const ruleKey of c.originalRuleKeys) {
      ruleCounts[ruleKey] = (ruleCounts[ruleKey] ?? 0) + 1
    }

    // Pending KB updates
    if (!c.appliedToKnowledgeBase) {
      pendingKbUpdates++
    }
  }

  // Sort rules by count
  const topErrorRules = Object.entries(ruleCounts)
    .map(([ruleKey, count]) => ({ ruleKey, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    generatedAt: new Date().toISOString(),
    totalCorrections: corrections.length,
    byType,
    byTier,
    byAnswerType,
    verifiedButWrong,
    verifiedErrorRate: totalVerified > 0 ? verifiedButWrong / totalVerified : 0,
    topErrorRules,
    pendingKbUpdates,
  }
}
