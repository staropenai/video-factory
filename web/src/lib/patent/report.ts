/**
 * Patent PoC — Evidence report generator.
 *
 * 专利策略 Part2 §5:
 *   "generate_patent_evidence_report() — 生成专利申请所需的技术效果证明报告"
 *
 * Aggregates patent_metrics records into a structured report suitable
 * for inclusion in a patent application's 実施例 (embodiment examples)
 * and 技術的効果 (technical effects) sections.
 *
 * All functions are PURE — they take metric records as input.
 * The I/O wrapper at the bottom reads from the JSONL file.
 */

import type {
  PatentMetricRecord,
  RoutingDecisionRecord,
  BridgeSessionRecord,
  EvidenceInjectionRecord,
} from './metrics-collector'
import { listPatentMetrics } from './metrics-collector'

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export interface RoutingEfficiencyStats {
  /** Total routing decisions recorded. */
  totalDecisions: number
  /** Breakdown by route layer. */
  byRoute: Record<string, number>
  /** Layer6 trigger rate (the key patent metric). */
  layer6TriggerRate: number
  /** Average confidence score. */
  avgConfidence: number
  /** Satisfaction rate (satisfied / (satisfied + clicked_human + exited)). */
  satisfactionRate: number
  /** Average estimated cost per query ($). */
  avgCostPerQuery: number
  /** Whether sample is statistically meaningful (N ≥ 200). */
  sufficientSampleSize: boolean
}

export interface BridgeEffectivenessStats {
  /** Total bridge sessions. */
  totalSessions: number
  /** Median time-to-first-script (seconds). */
  medianTimeToFirstScript: number
  /** Mean time-to-first-script (seconds). */
  meanTimeToFirstScript: number
  /** Script copy rate (proxy for task acceptance). */
  scriptCopyRate: number
  /** Average follow-up questions (lower = better). */
  avgFollowupQuestions: number
  /** By scenario tag. */
  bySceneTag: Record<string, number>
  /** Whether sample is statistically meaningful (N ≥ 30). */
  sufficientSampleSize: boolean
}

export interface EvidenceInjectionStats {
  /** Total injection events. */
  totalEvents: number
  /** Injection rate (events where evidence was injected / total). */
  injectionRate: number
  /** Average trigger score. */
  avgTriggerScore: number
  /** Average evidence count when injected. */
  avgEvidenceCount: number
  /** Layer6 rate AFTER injection (key: should be lower than baseline). */
  postInjectionLayer6Rate: number
  /** Layer6 rate when NOT injected (baseline comparison). */
  noInjectionLayer6Rate: number
  /** Whether sample is statistically meaningful (N ≥ 100). */
  sufficientSampleSize: boolean
}

export interface PatentEvidenceReport {
  generatedAt: string
  /** Analysis window. */
  period: { from: string; to: string }
  /** 方案A metrics. */
  routingEfficiency: RoutingEfficiencyStats
  /** 方案C metrics. */
  bridgeEffectiveness: BridgeEffectivenessStats
  /** 方案B metrics. */
  evidenceInjection: EvidenceInjectionStats
  /** Overall readiness for patent filing. */
  filingReadiness: {
    routingDataSufficient: boolean
    bridgeDataSufficient: boolean
    evidenceDataSufficient: boolean
    overallReady: boolean
  }
}

// ---------------------------------------------------------------------
// Pure: statistical helpers.
// ---------------------------------------------------------------------

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

// ---------------------------------------------------------------------
// Pure: report generation.
// ---------------------------------------------------------------------

/**
 * Compute routing efficiency stats from routing decision records.
 * Pure — no I/O.
 */
export function computeRoutingStats(
  records: RoutingDecisionRecord[],
): RoutingEfficiencyStats {
  const total = records.length
  if (total === 0) {
    return {
      totalDecisions: 0, byRoute: {}, layer6TriggerRate: 0,
      avgConfidence: 0, satisfactionRate: 0, avgCostPerQuery: 0,
      sufficientSampleSize: false,
    }
  }

  const byRoute: Record<string, number> = {}
  let layer6Count = 0
  let satisfiedCount = 0
  let actionableCount = 0
  let totalConfidence = 0
  let totalCost = 0

  for (const r of records) {
    byRoute[r.routeTaken] = (byRoute[r.routeTaken] ?? 0) + 1
    if (r.layer6Triggered) layer6Count++
    totalConfidence += r.confidenceScore
    totalCost += r.costEstimate
    if (r.userActionAfter !== 'unknown') {
      actionableCount++
      if (r.userActionAfter === 'satisfied') satisfiedCount++
    }
  }

  return {
    totalDecisions: total,
    byRoute,
    layer6TriggerRate: Math.round((layer6Count / total) * 10000) / 10000,
    avgConfidence: Math.round((totalConfidence / total) * 1000) / 1000,
    satisfactionRate: actionableCount > 0
      ? Math.round((satisfiedCount / actionableCount) * 10000) / 10000
      : 0,
    avgCostPerQuery: Math.round((totalCost / total) * 10000) / 10000,
    sufficientSampleSize: total >= 200,
  }
}

/**
 * Compute bridge effectiveness stats from bridge session records.
 * Pure — no I/O.
 */
export function computeBridgeStats(
  records: BridgeSessionRecord[],
): BridgeEffectivenessStats {
  const total = records.length
  if (total === 0) {
    return {
      totalSessions: 0, medianTimeToFirstScript: 0, meanTimeToFirstScript: 0,
      scriptCopyRate: 0, avgFollowupQuestions: 0, bySceneTag: {},
      sufficientSampleSize: false,
    }
  }

  const times = records.map((r) => r.timeToFirstScript)
  const copyCount = records.filter((r) => r.userCopiedScript).length
  const followups = records.map((r) => r.followupQuestions)

  const bySceneTag: Record<string, number> = {}
  for (const r of records) {
    const tag = r.sceneTag ?? 'untagged'
    bySceneTag[tag] = (bySceneTag[tag] ?? 0) + 1
  }

  return {
    totalSessions: total,
    medianTimeToFirstScript: Math.round(median(times) * 10) / 10,
    meanTimeToFirstScript: Math.round(mean(times) * 10) / 10,
    scriptCopyRate: Math.round((copyCount / total) * 10000) / 10000,
    avgFollowupQuestions: Math.round(mean(followups) * 100) / 100,
    bySceneTag,
    sufficientSampleSize: total >= 30,
  }
}

/**
 * Compute evidence injection stats.
 * Pure — no I/O.
 */
export function computeEvidenceInjectionStats(
  records: EvidenceInjectionRecord[],
): EvidenceInjectionStats {
  const total = records.length
  if (total === 0) {
    return {
      totalEvents: 0, injectionRate: 0, avgTriggerScore: 0,
      avgEvidenceCount: 0, postInjectionLayer6Rate: 0,
      noInjectionLayer6Rate: 0, sufficientSampleSize: false,
    }
  }

  const injected = records.filter((r) => r.evidenceInjected)
  const notInjected = records.filter((r) => !r.evidenceInjected)

  const postL6 = injected.filter((r) => r.subsequentLayer6Trigger).length
  const noInjL6 = notInjected.filter((r) => r.subsequentLayer6Trigger).length

  return {
    totalEvents: total,
    injectionRate: Math.round((injected.length / total) * 10000) / 10000,
    avgTriggerScore: Math.round(mean(records.map((r) => r.triggerScore)) * 10000) / 10000,
    avgEvidenceCount: injected.length > 0
      ? Math.round(mean(injected.map((r) => r.evidenceCount)) * 100) / 100
      : 0,
    postInjectionLayer6Rate: injected.length > 0
      ? Math.round((postL6 / injected.length) * 10000) / 10000
      : 0,
    noInjectionLayer6Rate: notInjected.length > 0
      ? Math.round((noInjL6 / notInjected.length) * 10000) / 10000
      : 0,
    sufficientSampleSize: total >= 100,
  }
}

/**
 * Generate the full patent evidence report.
 * Pure — no I/O. Caller provides records.
 */
export function generatePatentReport(
  records: PatentMetricRecord[],
): PatentEvidenceReport {
  const routing = records.filter(
    (r): r is RoutingDecisionRecord => r.metricType === 'ROUTING_DECISION',
  )
  const bridge = records.filter(
    (r): r is BridgeSessionRecord => r.metricType === 'BRIDGE_SESSION',
  )
  const evidence = records.filter(
    (r): r is EvidenceInjectionRecord => r.metricType === 'EVIDENCE_INJECTION',
  )

  const timestamps = records.map((r) => r.timestamp).sort()
  const from = timestamps[0] ?? new Date().toISOString()
  const to = timestamps[timestamps.length - 1] ?? new Date().toISOString()

  const routingStats = computeRoutingStats(routing)
  const bridgeStats = computeBridgeStats(bridge)
  const evidenceStats = computeEvidenceInjectionStats(evidence)

  return {
    generatedAt: new Date().toISOString(),
    period: { from, to },
    routingEfficiency: routingStats,
    bridgeEffectiveness: bridgeStats,
    evidenceInjection: evidenceStats,
    filingReadiness: {
      routingDataSufficient: routingStats.sufficientSampleSize,
      bridgeDataSufficient: bridgeStats.sufficientSampleSize,
      evidenceDataSufficient: evidenceStats.sufficientSampleSize,
      overallReady:
        routingStats.sufficientSampleSize &&
        bridgeStats.sufficientSampleSize &&
        evidenceStats.sufficientSampleSize,
    },
  }
}

// ---------------------------------------------------------------------
// I/O wrapper.
// ---------------------------------------------------------------------

/**
 * Generate a patent evidence report from all collected metrics.
 * I/O — reads from patent_metrics.jsonl.
 */
export function generateLiveReport(): PatentEvidenceReport {
  const records = listPatentMetrics({ limit: 5000 })
  return generatePatentReport(records)
}
