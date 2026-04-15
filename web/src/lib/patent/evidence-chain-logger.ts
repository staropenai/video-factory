/**
 * JTG v8 — Evidence Chain Logger.
 *
 * JPO Gate 4: technical effects must be measurable, repeatable,
 * causally linked to technical means.
 *
 * Every query produces a permanent, auditable evidence record.
 * Append-only (no UPDATE, no DELETE) — JPO requires immutable audit logs.
 *
 * Design:
 *   - Pure/I/O separation
 *   - Append-only persistence
 *   - Best-effort: write failure NEVER interrupts the request path
 *   - JSONL persistence (same pattern as metrics-collector.ts)
 *
 * V5 T5 — Evidence write consistency strategy:
 *   Current implementation: ASYNC EVENTUAL CONSISTENCY.
 *   - Evidence is written via queueMicrotask() after the response is sent.
 *   - Target loss rate: < 0.1% (best-effort async).
 *   - Process crash before write completes → record is lost (known limitation).
 *   If strong consistency is needed:
 *   - Switch to synchronous write (await) before closing the SSE stream.
 *   - Cost: +50-200ms on response total latency.
 *   Current choice: async (prioritise response speed; revisit when data volume grows).
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export interface ProcessRecord {
  routeTaken: string                    // "L1_STATIC" | "L3_AI" | "L5_BRIDGE" | "L6_HUMAN"
  decisionReasonCode: string            // "L1_SEMANTIC_HIT", "L3_AI_INFERRED", "L5_BRIDGE_ACTIVATED", "L6_ESCALATION"
  decisionReasonDetails: Record<string, unknown>
  triggerScore: number | null           // patent scheme A core measurable
  evidenceUsed: string[]                // Evidence Registry IDs
  stateTransitionPath: string[]         // patent scheme C: bridge state sequence
  optimizerRoute: string | null         // v7 optimizer's recommended route
  judgmentRuleId: string | null         // v7 judgment registry match
}

export interface OutputRecord {
  answerType: string                    // "L1" | "L3" | "L5" | "L6"
  userAction: string | null             // null until user feedback connected
  timeToFirstActionMs: number | null    // system-side timing
}

export interface EvidenceChainRecord {
  recordId: string                      // "ecr_" + uuid
  timestamp: string                     // ISO 8601 UTC
  module: 'routing' | 'evidence' | 'bridge'
  queryId: string
  sessionId: string
  input: {
    queryText: string                   // truncated to 500 chars
    userLanguage: string
    scenarioTag: string | null
  }
  process: ProcessRecord
  output: OutputRecord
  patentClaimRelevant: string[]         // ["ClaimA_routing", "ClaimC_bridge", "ClaimB_evidence"]
  baselineComparisonFlag: boolean       // whether this record is selected for A/B comparison
  /** V5 T2: Time to first token/response in ms. Server-side measured. */
  ttft_ms?: number
  /** V5 T1: Whether this request was answered from the knowledge base. */
  kb_hit?: boolean
  /** V5 T1: Routing tier that handled this request. */
  tier?: 'A' | 'B' | 'C' | 'L6'
  /** V6: Whether an LLM API call was made. Tier A/B = false, Tier C = true.
   *  Patent evidence: proves "routing avoids LLM call when KB hit". */
  llm_called?: boolean
  /** V6: Keyword that triggered Tier A match (patent traceability). */
  matched_keyword?: string
  /** V6: Retrieval confidence score for Tier B (not the threshold itself). */
  confidence_score?: number
}

export interface EvidenceStats {
  totalRecords: number
  byModule: Record<string, number>
  byRoute: Record<string, number>
  byClaimRelevance: Record<string, number>
  avgTriggerScore: number | null        // null if no trigger scores
  baselineCount: number
  dateRange: { earliest: string; latest: string } | null
  unavailableMetrics: string[]          // explicitly list what we CAN'T measure yet
}

// ---------------------------------------------------------------------
// Constants.
// ---------------------------------------------------------------------

/**
 * Metrics that are explicitly NOT measurable yet.
 * Must never be estimated — JPO requires honest disclosure.
 */
const UNAVAILABLE_METRICS: string[] = [
  'cost_estimate_tokens',
  'escalation_rate',
  'action_success_proxy',
  'long_term_retention',
  'knowledge_gap_fill_rate',
]

// ---------------------------------------------------------------------
// Pure: record factory.
// ---------------------------------------------------------------------

/**
 * Create an EvidenceChainRecord from parameters.
 * Pure — no I/O. Generates recordId with `ecr_` prefix + crypto.randomUUID().
 */
export function createEvidenceRecord(params: {
  module: EvidenceChainRecord['module']
  queryId: string
  sessionId: string
  input: {
    queryText: string
    userLanguage: string
    scenarioTag?: string | null
  }
  routeTaken: string
  decisionReasonCode: string
  decisionReasonDetails: Record<string, unknown>
  evidenceUsed: string[]
  triggerScore?: number | null
  stateTransitionPath?: string[]
  optimizerRoute?: string | null
  judgmentRuleId?: string | null
  answerType: string
  timeToFirstActionMs?: number | null
  patentClaims?: string[]
  baselineComparisonFlag?: boolean
}): EvidenceChainRecord {
  const process: ProcessRecord = {
    routeTaken: params.routeTaken,
    decisionReasonCode: params.decisionReasonCode,
    decisionReasonDetails: params.decisionReasonDetails,
    triggerScore: params.triggerScore ?? null,
    evidenceUsed: params.evidenceUsed,
    stateTransitionPath: params.stateTransitionPath ?? [],
    optimizerRoute: params.optimizerRoute ?? null,
    judgmentRuleId: params.judgmentRuleId ?? null,
  }

  const output: OutputRecord = {
    answerType: params.answerType,
    userAction: null,
    timeToFirstActionMs: params.timeToFirstActionMs ?? null,
  }

  const patentClaimRelevant =
    params.patentClaims ?? inferPatentClaims(process)

  return {
    recordId: `ecr_${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    module: params.module,
    queryId: params.queryId,
    sessionId: params.sessionId,
    input: {
      queryText: params.input.queryText.slice(0, 500),
      userLanguage: params.input.userLanguage,
      scenarioTag: params.input.scenarioTag ?? null,
    },
    process,
    output,
    patentClaimRelevant,
    baselineComparisonFlag: params.baselineComparisonFlag ?? false,
  }
}

// ---------------------------------------------------------------------
// Pure: patent claim inference.
// ---------------------------------------------------------------------

/**
 * Automatically tag which patent claims are relevant based on the process record.
 * Pure — no I/O.
 */
export function inferPatentClaims(process: ProcessRecord): string[] {
  const claims: string[] = []

  // If system handled without human escalation → ClaimA_routing
  if (process.routeTaken !== 'L6_HUMAN') {
    claims.push('ClaimA_routing')
  }

  // If bridge state transitions occurred → ClaimC_bridge
  if (process.stateTransitionPath.length > 0) {
    claims.push('ClaimC_bridge')
  }

  // If evidence was used with a trigger score → ClaimB_evidence
  if (process.evidenceUsed.length > 0 && process.triggerScore != null) {
    claims.push('ClaimB_evidence')
  }

  // If a judgment rule matched → ClaimA_judgment
  if (process.judgmentRuleId != null) {
    claims.push('ClaimA_judgment')
  }

  return claims
}

// ---------------------------------------------------------------------
// Pure: aggregation.
// ---------------------------------------------------------------------

/**
 * Aggregate evidence chain records into stats.
 * Pure — no I/O.
 *
 * IMPORTANT: `unavailableMetrics` always includes metrics that are
 * explicitly NOT measurable yet and must never be estimated.
 */
export function computeEvidenceStats(
  records: EvidenceChainRecord[],
): EvidenceStats {
  const total = records.length

  if (total === 0) {
    return {
      totalRecords: 0,
      byModule: {},
      byRoute: {},
      byClaimRelevance: {},
      avgTriggerScore: null,
      baselineCount: 0,
      dateRange: null,
      unavailableMetrics: [...UNAVAILABLE_METRICS],
    }
  }

  const byModule: Record<string, number> = {}
  const byRoute: Record<string, number> = {}
  const byClaimRelevance: Record<string, number> = {}
  let triggerScoreSum = 0
  let triggerScoreCount = 0
  let baselineCount = 0

  const timestamps: string[] = []

  for (const r of records) {
    // Module counts
    byModule[r.module] = (byModule[r.module] ?? 0) + 1

    // Route counts
    const route = r.process.routeTaken
    byRoute[route] = (byRoute[route] ?? 0) + 1

    // Claim relevance counts
    for (const claim of r.patentClaimRelevant) {
      byClaimRelevance[claim] = (byClaimRelevance[claim] ?? 0) + 1
    }

    // Trigger scores
    if (r.process.triggerScore != null) {
      triggerScoreSum += r.process.triggerScore
      triggerScoreCount++
    }

    // Baseline
    if (r.baselineComparisonFlag) {
      baselineCount++
    }

    timestamps.push(r.timestamp)
  }

  timestamps.sort()

  return {
    totalRecords: total,
    byModule,
    byRoute,
    byClaimRelevance,
    avgTriggerScore:
      triggerScoreCount > 0
        ? Math.round((triggerScoreSum / triggerScoreCount) * 10000) / 10000
        : null,
    baselineCount,
    dateRange: {
      earliest: timestamps[0],
      latest: timestamps[timestamps.length - 1],
    },
    unavailableMetrics: [...UNAVAILABLE_METRICS],
  }
}

// ---------------------------------------------------------------------
// Pure: filters.
// ---------------------------------------------------------------------

/** Filter records by module. Pure — no I/O. */
export function filterByModule(
  records: EvidenceChainRecord[],
  module: string,
): EvidenceChainRecord[] {
  return records.filter((r) => r.module === module)
}

/** Filter records by patent claim relevance. Pure — no I/O. */
export function filterByClaimRelevance(
  records: EvidenceChainRecord[],
  claim: string,
): EvidenceChainRecord[] {
  return records.filter((r) => r.patentClaimRelevant.includes(claim))
}

/** Filter records by date range. Pure — no I/O. */
export function filterByDateRange(
  records: EvidenceChainRecord[],
  since: string,
  until?: string,
): EvidenceChainRecord[] {
  const sinceTime = new Date(since).getTime()
  const untilTime = until ? new Date(until).getTime() : Infinity

  return records.filter((r) => {
    const t = new Date(r.timestamp).getTime()
    return t >= sinceTime && t <= untilTime
  })
}

// ---------------------------------------------------------------------
// Pure: patent report export.
// ---------------------------------------------------------------------

/**
 * Generate patent-ready statistics from evidence chain records.
 * Pure — no I/O.
 *
 * Mirrors the report.ts structure but works from EvidenceChainRecords
 * rather than raw PatentMetricRecords.
 */
export function exportForPatentReport(records: EvidenceChainRecord[]): {
  routingStats: {
    totalDecisions: number
    byRoute: Record<string, number>
    layer6TriggerRate: number
    sufficientSampleSize: boolean
  }
  bridgeStats: {
    totalSessions: number
    avgTimeToFirstActionMs: number
    stateTransitionCoverage: number
    sufficientSampleSize: boolean
  }
  evidenceInjectionStats: {
    totalEvents: number
    avgTriggerScore: number | null
    avgEvidenceCount: number
    sufficientSampleSize: boolean
  }
  sampleSize: number
  dateRange: { from: string; to: string } | null
  filingReadiness: {
    routingDataSufficient: boolean
    bridgeDataSufficient: boolean
    evidenceDataSufficient: boolean
    overallReady: boolean
  }
} {
  const routingRecords = filterByModule(records, 'routing')
  const bridgeRecords = filterByModule(records, 'bridge')
  const evidenceRecords = filterByModule(records, 'evidence')

  // Routing stats
  const routeByRoute: Record<string, number> = {}
  let layer6Count = 0
  for (const r of routingRecords) {
    const route = r.process.routeTaken
    routeByRoute[route] = (routeByRoute[route] ?? 0) + 1
    if (route === 'L6_HUMAN') layer6Count++
  }

  // Bridge stats
  const bridgeTimes = bridgeRecords
    .map((r) => r.output.timeToFirstActionMs)
    .filter((t): t is number => t != null)
  const bridgeWithTransitions = bridgeRecords.filter(
    (r) => r.process.stateTransitionPath.length > 0,
  ).length

  // Evidence stats
  const evidenceTriggerScores = evidenceRecords
    .map((r) => r.process.triggerScore)
    .filter((s): s is number => s != null)
  const evidenceCounts = evidenceRecords.map(
    (r) => r.process.evidenceUsed.length,
  )

  const timestamps = records.map((r) => r.timestamp).sort()
  const dateRange =
    timestamps.length > 0
      ? { from: timestamps[0], to: timestamps[timestamps.length - 1] }
      : null

  const routingDataSufficient = routingRecords.length >= 200
  const bridgeDataSufficient = bridgeRecords.length >= 30
  const evidenceDataSufficient = evidenceRecords.length >= 100

  return {
    routingStats: {
      totalDecisions: routingRecords.length,
      byRoute: routeByRoute,
      layer6TriggerRate:
        routingRecords.length > 0
          ? Math.round((layer6Count / routingRecords.length) * 10000) / 10000
          : 0,
      sufficientSampleSize: routingDataSufficient,
    },
    bridgeStats: {
      totalSessions: bridgeRecords.length,
      avgTimeToFirstActionMs:
        bridgeTimes.length > 0
          ? Math.round(
              bridgeTimes.reduce((a, b) => a + b, 0) / bridgeTimes.length,
            )
          : 0,
      stateTransitionCoverage:
        bridgeRecords.length > 0
          ? Math.round(
              (bridgeWithTransitions / bridgeRecords.length) * 10000,
            ) / 10000
          : 0,
      sufficientSampleSize: bridgeDataSufficient,
    },
    evidenceInjectionStats: {
      totalEvents: evidenceRecords.length,
      avgTriggerScore:
        evidenceTriggerScores.length > 0
          ? Math.round(
              (evidenceTriggerScores.reduce((a, b) => a + b, 0) /
                evidenceTriggerScores.length) *
                10000,
            ) / 10000
          : null,
      avgEvidenceCount:
        evidenceCounts.length > 0
          ? Math.round(
              (evidenceCounts.reduce((a, b) => a + b, 0) /
                evidenceCounts.length) *
                100,
            ) / 100
          : 0,
      sufficientSampleSize: evidenceDataSufficient,
    },
    sampleSize: records.length,
    dateRange,
    filingReadiness: {
      routingDataSufficient,
      bridgeDataSufficient,
      evidenceDataSufficient,
      overallReady:
        routingDataSufficient &&
        bridgeDataSufficient &&
        evidenceDataSufficient,
    },
  }
}

// ---------------------------------------------------------------------
// I/O: JSONL persistence.
// ---------------------------------------------------------------------

const DATA_DIR =
  process.env.VERCEL === '1'
    ? '/tmp'
    : path.join(process.cwd(), '.data')

const EVIDENCE_CHAIN_FILE = path.join(DATA_DIR, 'evidence_chain.jsonl')

function ensureDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
  } catch {
    // swallow — best-effort
  }
}

/**
 * Append an evidence chain record to evidence_chain.jsonl.
 * Returns true on success, false on failure.
 * NEVER throws — best-effort write so the request path is never interrupted.
 */
export function logEvidenceRecord(record: EvidenceChainRecord): boolean {
  ensureDir()
  try {
    fs.appendFileSync(
      EVIDENCE_CHAIN_FILE,
      JSON.stringify(record) + '\n',
      'utf8',
    )
    return true
  } catch (err) {
    console.error('[evidence-chain-logger] write failed', err)
    return false
  }
}

/**
 * Read all evidence chain records from JSONL.
 * Returns records in file order (oldest first).
 */
export function readEvidenceChain(): EvidenceChainRecord[] {
  try {
    if (!fs.existsSync(EVIDENCE_CHAIN_FILE)) return []
    const raw = fs.readFileSync(EVIDENCE_CHAIN_FILE, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const records: EvidenceChainRecord[] = []
    for (const line of lines) {
      try {
        records.push(JSON.parse(line) as EvidenceChainRecord)
      } catch {
        // skip corrupt line
      }
    }
    return records
  } catch {
    return []
  }
}

/**
 * Convenience: read all records and compute stats.
 */
export function getEvidenceStats(): EvidenceStats {
  const records = readEvidenceChain()
  return computeEvidenceStats(records)
}
