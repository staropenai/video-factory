/**
 * Patent PoC — Metrics collection system.
 *
 * 专利策略 Part2 §5:
 *   "patent_poc_collector — 自动收集用于支持专利申请的技术效果数据"
 *
 * Three record types:
 *   1. RoutingDecisionRecord  — 方案A route efficiency data
 *   2. BridgeSessionRecord    — 方案C language bridge effectiveness
 *   3. EvidenceInjectionRecord — 方案B evidence injection outcomes
 *
 * All builder functions are PURE. The I/O functions persist to a
 * dedicated JSONL file (patent_metrics.jsonl), separate from the
 * main events table, following the security/event-log.ts pattern.
 */

import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export type PatentMetricType =
  | 'ROUTING_DECISION'
  | 'BRIDGE_SESSION'
  | 'EVIDENCE_INJECTION'

/** 方案A: Route efficiency record. */
export interface RoutingDecisionRecord {
  metricType: 'ROUTING_DECISION'
  id: string
  timestamp: string
  queryId: string
  /** Feature vector extracted from query + context. */
  features: {
    fSemantic: number | null
    fRisk: number
    fLang: number
    fTemporal: boolean
  }
  /** Which layer handled the query. */
  routeTaken: string
  /** Estimated cost of this route ($). */
  costEstimate: number
  /** Route confidence score. */
  confidenceScore: number
  /** What the user did after receiving the answer. */
  userActionAfter: 'satisfied' | 'clicked_human' | 'followup' | 'exited' | 'unknown'
  /** Whether Layer6 was eventually triggered. */
  layer6Triggered: boolean
}

/** 方案C: Language bridge session record. */
export interface BridgeSessionRecord {
  metricType: 'BRIDGE_SESSION'
  id: string
  timestamp: string
  sessionId: string
  /** Scenario template tag (e.g. 'HOUSING-01'). */
  sceneTag: string | null
  /** Seconds from session start to first script generation. */
  timeToFirstScript: number
  /** State sequence traversed in the scenario state machine. */
  statesTraversed: string[]
  /** Whether the user copied the generated script. */
  userCopiedScript: boolean
  /** Number of follow-up questions after bridge output. */
  followupQuestions: number
  /** Risk level of the bridge session. */
  riskLevel: string
  /** User's locale. */
  userLocale: string
}

/** 方案B: Evidence injection record. */
export interface EvidenceInjectionRecord {
  metricType: 'EVIDENCE_INJECTION'
  id: string
  timestamp: string
  queryId: string
  /** Trigger score that led to injection decision. */
  triggerScore: number
  /** Whether evidence was injected. */
  evidenceInjected: boolean
  /** Number of evidence records injected. */
  evidenceCount: number
  /** Confidence scores of injected evidence. */
  confidenceScores: number[]
  /** Whether Layer6 was triggered AFTER evidence injection. */
  subsequentLayer6Trigger: boolean
}

export type PatentMetricRecord =
  | RoutingDecisionRecord
  | BridgeSessionRecord
  | EvidenceInjectionRecord

// ---------------------------------------------------------------------
// Pure: record builders.
// ---------------------------------------------------------------------

let metricCounter = 0
function newMetricId(prefix: string): string {
  return `${prefix}_${Date.now()}_${(++metricCounter).toString(36)}`
}

/**
 * Build a routing decision record.
 * Pure — no I/O.
 */
export function buildRoutingDecisionRecord(input: {
  queryId: string
  features: RoutingDecisionRecord['features']
  routeTaken: string
  costEstimate: number
  confidenceScore: number
  userActionAfter?: RoutingDecisionRecord['userActionAfter']
  layer6Triggered?: boolean
}): RoutingDecisionRecord {
  return {
    metricType: 'ROUTING_DECISION',
    id: newMetricId('pm_route'),
    timestamp: new Date().toISOString(),
    queryId: input.queryId,
    features: input.features,
    routeTaken: input.routeTaken,
    costEstimate: input.costEstimate,
    confidenceScore: input.confidenceScore,
    userActionAfter: input.userActionAfter ?? 'unknown',
    layer6Triggered: input.layer6Triggered ?? false,
  }
}

/**
 * Build a bridge session record.
 * Pure — no I/O.
 */
export function buildBridgeSessionRecord(input: {
  sessionId: string
  sceneTag?: string | null
  timeToFirstScript: number
  statesTraversed?: string[]
  userCopiedScript?: boolean
  followupQuestions?: number
  riskLevel: string
  userLocale: string
}): BridgeSessionRecord {
  return {
    metricType: 'BRIDGE_SESSION',
    id: newMetricId('pm_bridge'),
    timestamp: new Date().toISOString(),
    sessionId: input.sessionId,
    sceneTag: input.sceneTag ?? null,
    timeToFirstScript: input.timeToFirstScript,
    statesTraversed: input.statesTraversed ?? [],
    userCopiedScript: input.userCopiedScript ?? false,
    followupQuestions: input.followupQuestions ?? 0,
    riskLevel: input.riskLevel,
    userLocale: input.userLocale,
  }
}

/**
 * Build an evidence injection record.
 * Pure — no I/O.
 */
export function buildEvidenceInjectionRecord(input: {
  queryId: string
  triggerScore: number
  evidenceInjected: boolean
  evidenceCount?: number
  confidenceScores?: number[]
  subsequentLayer6Trigger?: boolean
}): EvidenceInjectionRecord {
  return {
    metricType: 'EVIDENCE_INJECTION',
    id: newMetricId('pm_evid'),
    timestamp: new Date().toISOString(),
    queryId: input.queryId,
    triggerScore: input.triggerScore,
    evidenceInjected: input.evidenceInjected,
    evidenceCount: input.evidenceCount ?? 0,
    confidenceScores: input.confidenceScores ?? [],
    subsequentLayer6Trigger: input.subsequentLayer6Trigger ?? false,
  }
}

// ---------------------------------------------------------------------
// I/O: JSONL persistence (separate file, same pattern as event-log).
// ---------------------------------------------------------------------

const DATA_DIR =
  process.env.VERCEL === '1'
    ? '/tmp'
    : path.join(process.cwd(), '.data')

const PATENT_METRICS_FILE = path.join(DATA_DIR, 'patent_metrics.jsonl')

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
 * Persist a patent metric record to the dedicated JSONL file.
 */
export function recordPatentMetric(record: PatentMetricRecord): void {
  ensureDir()
  try {
    fs.appendFileSync(PATENT_METRICS_FILE, JSON.stringify(record) + '\n', 'utf8')
  } catch (err) {
    console.error('[patent-metrics] write failed', err)
  }
}

/** Convenience: record a routing decision. */
export function recordRoutingDecision(
  input: Parameters<typeof buildRoutingDecisionRecord>[0],
): RoutingDecisionRecord {
  const record = buildRoutingDecisionRecord(input)
  recordPatentMetric(record)
  return record
}

/** Convenience: record a bridge session. */
export function recordBridgeSession(
  input: Parameters<typeof buildBridgeSessionRecord>[0],
): BridgeSessionRecord {
  const record = buildBridgeSessionRecord(input)
  recordPatentMetric(record)
  return record
}

/** Convenience: record an evidence injection event. */
export function recordEvidenceInjection(
  input: Parameters<typeof buildEvidenceInjectionRecord>[0],
): EvidenceInjectionRecord {
  const record = buildEvidenceInjectionRecord(input)
  recordPatentMetric(record)
  return record
}

/**
 * Read all patent metric records from JSONL.
 * Returns newest-first.
 */
export function listPatentMetrics(
  filter?: { metricType?: PatentMetricType; limit?: number },
): PatentMetricRecord[] {
  try {
    if (!fs.existsSync(PATENT_METRICS_FILE)) return []
    const raw = fs.readFileSync(PATENT_METRICS_FILE, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    let records: PatentMetricRecord[] = []
    for (const line of lines) {
      try {
        records.push(JSON.parse(line) as PatentMetricRecord)
      } catch {
        // skip corrupt line
      }
    }
    if (filter?.metricType) {
      records = records.filter((r) => r.metricType === filter.metricType)
    }
    const limit = filter?.limit ?? 500
    return records.slice(-limit).reverse()
  } catch {
    return []
  }
}
