/**
 * Patent technical effect extractor.
 *
 * Reads evidence chain records (patent metric records) and computes
 * technical effect deltas for patent prosecution. These deltas quantify
 * the measurable improvements the JTG system provides over baselines.
 *
 * All functions are PURE -- no I/O. Records are passed as input.
 *
 * Used during patent filing to populate the 技術的効果 (technical effects)
 * section with concrete, measured improvements.
 */

import type {
  PatentMetricRecord,
  RoutingDecisionRecord,
  BridgeSessionRecord,
  EvidenceInjectionRecord,
} from './metrics-collector'

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

/**
 * EvidenceChainRecord is an alias for PatentMetricRecord.
 * When evidence-chain-logger.ts is created, this can be replaced with:
 *   import type { EvidenceChainRecord } from './evidence-chain-logger'
 */
export type EvidenceChainRecord = PatentMetricRecord

export interface TechnicalEffect {
  effectId: string
  claim: string
  metric: string
  baselineValue: number | null
  jtgValue: number | null
  delta: number | null
  unit: string
  sampleSize: number
  status: 'measurable' | 'unavailable' | 'insufficient_data'
  notes: string
}

export interface TechnicalEffectReport {
  generatedAt: string
  totalRecords: number
  effects: TechnicalEffect[]
  filingReadiness: { ready: boolean; reasons: string[] }
  unavailableEffects: string[]
}

// ---------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function buildEffect(
  effectId: string,
  claim: string,
  metric: string,
  opts: {
    baselineValue?: number | null
    jtgValue?: number | null
    unit: string
    sampleSize: number
    notes?: string
    minSampleSize?: number
  },
): TechnicalEffect {
  const baselineValue = opts.baselineValue ?? null
  const jtgValue = opts.jtgValue ?? null
  const delta =
    baselineValue !== null && jtgValue !== null
      ? round4(jtgValue - baselineValue)
      : null
  const minN = opts.minSampleSize ?? 1

  let status: TechnicalEffect['status']
  if (opts.sampleSize < minN) {
    status = 'insufficient_data'
  } else if (jtgValue !== null) {
    status = 'measurable'
  } else {
    status = 'unavailable'
  }

  return {
    effectId,
    claim,
    metric,
    baselineValue,
    jtgValue,
    delta,
    unit: opts.unit,
    sampleSize: opts.sampleSize,
    status,
    notes: opts.notes ?? '',
  }
}

// ---------------------------------------------------------------------
// Claim A: Routing effects.
// ---------------------------------------------------------------------

/** Baseline: all queries handled by human at $5 per query. */
const ALL_HUMAN_COST_PER_QUERY = 5.0

/**
 * Extract routing-related technical effects from evidence records.
 * Computes: L6 trigger rate, average trigger score, route distribution,
 * and cost saving estimate vs all-human baseline.
 */
export function extractRoutingEffects(
  records: EvidenceChainRecord[],
): TechnicalEffect[] {
  const routing = records.filter(
    (r): r is RoutingDecisionRecord => r.metricType === 'ROUTING_DECISION',
  )
  const n = routing.length

  // L6 trigger rate
  const l6Count = routing.filter((r) => r.layer6Triggered).length
  const l6Rate = n > 0 ? round4(l6Count / n) : null

  const l6Effect = buildEffect('A-L6-RATE', 'ClaimA', 'L6 (human escalation) trigger rate', {
    baselineValue: 1.0, // all-human baseline = 100%
    jtgValue: l6Rate,
    unit: 'ratio',
    sampleSize: n,
    minSampleSize: 200,
    notes:
      n >= 200
        ? `${l6Count} of ${n} queries escalated to human`
        : `Need >= 200 routing records (have ${n})`,
  })

  // Average confidence score (trigger score proxy)
  const avgConfidence =
    n > 0 ? round4(mean(routing.map((r) => r.confidenceScore))) : null

  const confidenceEffect = buildEffect(
    'A-AVG-CONFIDENCE',
    'ClaimA',
    'Average routing confidence score',
    {
      baselineValue: null, // no baseline for confidence
      jtgValue: avgConfidence,
      unit: 'score [0,1]',
      sampleSize: n,
      minSampleSize: 200,
      notes: 'Higher confidence indicates more certain routing decisions',
    },
  )

  // Route distribution
  const routeCounts: Record<string, number> = {}
  for (const r of routing) {
    routeCounts[r.routeTaken] = (routeCounts[r.routeTaken] ?? 0) + 1
  }
  const routeDistStr =
    n > 0
      ? Object.entries(routeCounts)
          .map(([route, count]) => `${route}: ${round4(count / n)}`)
          .join(', ')
      : 'no data'

  const routeDistEffect = buildEffect(
    'A-ROUTE-DIST',
    'ClaimA',
    'Route distribution (L1/L3/L5/L6 percentages)',
    {
      baselineValue: null,
      jtgValue: n > 0 ? round4(1 - (l6Count / n)) : null, // non-human rate
      unit: 'ratio (automated)',
      sampleSize: n,
      minSampleSize: 200,
      notes: n > 0 ? `Distribution: ${routeDistStr}` : 'No routing data',
    },
  )

  // Cost saving estimate
  const avgCost =
    n > 0 ? round4(mean(routing.map((r) => r.costEstimate))) : null
  const costSaving =
    avgCost !== null ? round4(ALL_HUMAN_COST_PER_QUERY - avgCost) : null

  const costEffect = buildEffect('A-COST-SAVING', 'ClaimA', 'Cost saving per query vs all-human baseline', {
    baselineValue: ALL_HUMAN_COST_PER_QUERY,
    jtgValue: avgCost,
    unit: 'USD per query',
    sampleSize: n,
    minSampleSize: 200,
    notes:
      costSaving !== null
        ? `Estimated saving: $${costSaving} per query`
        : 'Insufficient data for cost comparison',
  })

  return [l6Effect, confidenceEffect, routeDistEffect, costEffect]
}

// ---------------------------------------------------------------------
// Claim C: Bridge effects.
// ---------------------------------------------------------------------

/**
 * Extract bridge-related technical effects from evidence records.
 * Computes: state machine completion rate, average state transitions,
 * and bridge activation rate.
 */
export function extractBridgeEffects(
  records: EvidenceChainRecord[],
): TechnicalEffect[] {
  const bridge = records.filter(
    (r): r is BridgeSessionRecord => r.metricType === 'BRIDGE_SESSION',
  )
  const n = bridge.length

  // State machine completion rate
  const completedCount = bridge.filter((r) =>
    r.statesTraversed.includes('completed'),
  ).length
  const completionRate = n > 0 ? round4(completedCount / n) : null

  const completionEffect = buildEffect(
    'C-COMPLETION-RATE',
    'ClaimC',
    'State machine completion rate',
    {
      baselineValue: null, // no baseline for completion
      jtgValue: completionRate,
      unit: 'ratio',
      sampleSize: n,
      minSampleSize: 30,
      notes:
        n >= 30
          ? `${completedCount} of ${n} sessions reached completed state`
          : `Need >= 30 bridge records (have ${n})`,
    },
  )

  // Average state transitions per session
  const avgTransitions =
    n > 0
      ? round4(mean(bridge.map((r) => r.statesTraversed.length)))
      : null

  const transitionEffect = buildEffect(
    'C-AVG-TRANSITIONS',
    'ClaimC',
    'Average state transitions per session',
    {
      baselineValue: null,
      jtgValue: avgTransitions,
      unit: 'transitions',
      sampleSize: n,
      minSampleSize: 30,
      notes: 'More transitions may indicate richer interaction or uncertainty',
    },
  )

  // Bridge activation rate (sessions with non-null sceneTag)
  const activatedCount = bridge.filter((r) => r.sceneTag !== null).length
  const activationRate = n > 0 ? round4(activatedCount / n) : null

  const activationEffect = buildEffect(
    'C-ACTIVATION-RATE',
    'ClaimC',
    'Bridge activation rate (scene-tagged sessions)',
    {
      baselineValue: null,
      jtgValue: activationRate,
      unit: 'ratio',
      sampleSize: n,
      minSampleSize: 30,
      notes:
        n >= 30
          ? `${activatedCount} of ${n} sessions had a scene tag`
          : `Need >= 30 bridge records (have ${n})`,
    },
  )

  return [completionEffect, transitionEffect, activationEffect]
}

// ---------------------------------------------------------------------
// Claim B: Evidence effects.
// ---------------------------------------------------------------------

/**
 * Extract evidence-related technical effects from evidence records.
 * Computes: evidence injection rate and post-injection L6 reduction.
 */
export function extractEvidenceEffects(
  records: EvidenceChainRecord[],
): TechnicalEffect[] {
  const evidence = records.filter(
    (r): r is EvidenceInjectionRecord => r.metricType === 'EVIDENCE_INJECTION',
  )
  const n = evidence.length

  // Evidence injection rate
  const injectedCount = evidence.filter((r) => r.evidenceInjected).length
  const injectionRate = n > 0 ? round4(injectedCount / n) : null

  const injectionEffect = buildEffect(
    'B-INJECTION-RATE',
    'ClaimB',
    'Evidence injection rate',
    {
      baselineValue: 0, // baseline: no evidence injection
      jtgValue: injectionRate,
      unit: 'ratio',
      sampleSize: n,
      minSampleSize: 100,
      notes:
        n >= 100
          ? `${injectedCount} of ${n} queries received evidence injection`
          : `Need >= 100 evidence records (have ${n})`,
    },
  )

  // Post-injection L6 reduction
  const injected = evidence.filter((r) => r.evidenceInjected)
  const notInjected = evidence.filter((r) => !r.evidenceInjected)

  const postInjectionL6 =
    injected.length > 0
      ? round4(
          injected.filter((r) => r.subsequentLayer6Trigger).length /
            injected.length,
        )
      : null

  const noInjectionL6 =
    notInjected.length > 0
      ? round4(
          notInjected.filter((r) => r.subsequentLayer6Trigger).length /
            notInjected.length,
        )
      : null

  const l6ReductionEffect = buildEffect(
    'B-POST-INJECTION-L6',
    'ClaimB',
    'Post-injection L6 trigger rate reduction',
    {
      baselineValue: noInjectionL6, // L6 rate without injection as baseline
      jtgValue: postInjectionL6,
      unit: 'ratio',
      sampleSize: injected.length,
      minSampleSize: 30,
      notes:
        postInjectionL6 !== null && noInjectionL6 !== null
          ? `L6 rate: ${postInjectionL6} with injection vs ${noInjectionL6} without (delta should be negative)`
          : 'Insufficient injection data for L6 comparison',
    },
  )

  return [injectionEffect, l6ReductionEffect]
}

// ---------------------------------------------------------------------
// Filing readiness assessment.
// ---------------------------------------------------------------------

/**
 * Assess whether collected technical effects are sufficient for patent filing.
 *
 * Criteria:
 *   - N >= 200 routing records
 *   - N >= 30 bridge records
 *   - N >= 100 evidence records
 *   - At least one effect has delta != null and status == 'measurable'
 */
export function assessFilingReadiness(
  effects: TechnicalEffect[],
): { ready: boolean; reasons: string[] } {
  const reasons: string[] = []

  // Check routing sample size
  const routingEffects = effects.filter((e) => e.claim === 'ClaimA')
  const routingSample = Math.max(0, ...routingEffects.map((e) => e.sampleSize))
  if (routingSample < 200) {
    reasons.push(
      `Routing data insufficient: ${routingSample} records (need >= 200)`,
    )
  }

  // Check bridge sample size
  const bridgeEffects = effects.filter((e) => e.claim === 'ClaimC')
  const bridgeSample = Math.max(0, ...bridgeEffects.map((e) => e.sampleSize))
  if (bridgeSample < 30) {
    reasons.push(
      `Bridge data insufficient: ${bridgeSample} records (need >= 30)`,
    )
  }

  // Check evidence sample size
  const evidenceEffects = effects.filter((e) => e.claim === 'ClaimB')
  const evidenceSample = Math.max(0, ...evidenceEffects.map((e) => e.sampleSize))
  if (evidenceSample < 100) {
    reasons.push(
      `Evidence data insufficient: ${evidenceSample} records (need >= 100)`,
    )
  }

  // Check for at least one measurable delta
  const hasMeasurableDelta = effects.some(
    (e) => e.delta !== null && e.status === 'measurable',
  )
  if (!hasMeasurableDelta) {
    reasons.push('No measurable delta found in any technical effect')
  }

  const ready = reasons.length === 0
  if (ready) {
    reasons.push('All filing readiness criteria met')
  }

  return { ready, reasons }
}

// ---------------------------------------------------------------------
// Report generation.
// ---------------------------------------------------------------------

/**
 * Generate a complete technical effect report from evidence chain records.
 * Pure -- no I/O.
 */
export function generateTechnicalEffectReport(
  records: EvidenceChainRecord[],
): TechnicalEffectReport {
  const routingEffects = extractRoutingEffects(records)
  const bridgeEffects = extractBridgeEffects(records)
  const evidenceEffects = extractEvidenceEffects(records)

  const allEffects = [...routingEffects, ...bridgeEffects, ...evidenceEffects]
  const filingReadiness = assessFilingReadiness(allEffects)

  const unavailableEffects = allEffects
    .filter((e) => e.status === 'unavailable' || e.status === 'insufficient_data')
    .map((e) => `${e.effectId}: ${e.metric} (${e.status})`)

  return {
    generatedAt: new Date().toISOString(),
    totalRecords: records.length,
    effects: allEffects,
    filingReadiness,
    unavailableEffects,
  }
}
