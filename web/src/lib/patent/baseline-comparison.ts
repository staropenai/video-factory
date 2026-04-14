/**
 * JTG v8 Baseline Comparison Engine.
 *
 * Runs Mode A (direct LLM, no JTG routing) vs Mode B (full JTG path)
 * to produce quantifiable deltas for patent technical effect evidence.
 *
 * 核心原则 (v8 doc):
 *   "基线对比的目的不是证明JTG「更好」，而是产生「可量化的差值」"
 *   "不允许伪造任何指标（null 就是 null，unavailable 就是 unavailable）"
 *
 * Pure/I/O separation: all builder/compute functions are pure.
 * I/O wrappers handle persistence to baseline_comparisons.jsonl.
 */

import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export interface ComparisonMetrics {
  responseTimeMs: number | null         // measurable (system-side timing)
  routeTaken: string | null             // measurable (routing log)
  evidenceUsedCount: number | null      // measurable (evidence_ids length)
  stateTransitions: number | null       // measurable (bridge state count)
  costEstimateTokens: number | null     // null (not connected to token usage API)
  escalationRate: number | null         // null (no unified escalation log yet)
  actionSuccessProxy: number | null     // null (needs user behavior writeback)
}

export interface ComparisonRun {
  runId: string                         // "comp_" + uuid
  timestamp: string
  inputSetId: string                    // which test set was used
  queryText: string
  sampleIndex: number
  modeA: ComparisonMetrics              // baseline (direct LLM)
  modeB: ComparisonMetrics              // JTG system
  metricDeltas: Record<string, { baseline: number; jtg: number; delta: number }>
  unavailableMetrics: string[]          // explicitly listed
}

export interface ComparisonSummary {
  totalRuns: number
  inputSetId: string
  dateRange: { from: string; to: string }
  avgDeltas: Record<string, { avgBaseline: number; avgJtg: number; avgDelta: number; sampleSize: number }>
  unavailableMetrics: string[]
  statisticalSignificance: Record<string, { tStatistic: number; pValue: number; significant: boolean }> | null
}

// ---------------------------------------------------------------------
// Constants.
// ---------------------------------------------------------------------

/** Metrics known to be unavailable in the current system. */
export const UNAVAILABLE_METRICS: string[] = [
  'cost_estimate_tokens',
  'escalation_rate',
  'action_success_proxy',
  'long_term_retention',
  'knowledge_gap_fill_rate',
]

// ---------------------------------------------------------------------
// Pure functions.
// ---------------------------------------------------------------------

/**
 * Create Mode A (baseline) metrics. Only responseTimeMs is available;
 * all JTG-specific fields are null or 0.
 */
export function createBaselineMetrics(responseTimeMs: number): ComparisonMetrics {
  return {
    responseTimeMs,
    routeTaken: null,
    evidenceUsedCount: 0,
    stateTransitions: 0,
    costEstimateTokens: null,
    escalationRate: null,
    actionSuccessProxy: null,
  }
}

/**
 * Create Mode B (JTG system) metrics. Unavailable fields are
 * explicitly null — never fabricated.
 */
export function createJtgMetrics(params: {
  responseTimeMs: number
  routeTaken: string
  evidenceUsedCount: number
  stateTransitions: number
}): ComparisonMetrics {
  return {
    responseTimeMs: params.responseTimeMs,
    routeTaken: params.routeTaken,
    evidenceUsedCount: params.evidenceUsedCount,
    stateTransitions: params.stateTransitions,
    costEstimateTokens: null,
    escalationRate: null,
    actionSuccessProxy: null,
  }
}

/**
 * Mapping from ComparisonMetrics keys to snake_case metric names used
 * in deltas/summary output.
 */
const METRIC_KEY_MAP: Record<string, string> = {
  responseTimeMs: 'response_time_ms',
  routeTaken: 'route_taken',
  evidenceUsedCount: 'evidence_used_count',
  stateTransitions: 'state_transitions',
  costEstimateTokens: 'cost_estimate_tokens',
  escalationRate: 'escalation_rate',
  actionSuccessProxy: 'action_success_proxy',
}

/** Numeric metric keys that can be compared as numbers. */
const NUMERIC_METRIC_KEYS: (keyof ComparisonMetrics)[] = [
  'responseTimeMs',
  'evidenceUsedCount',
  'stateTransitions',
  'costEstimateTokens',
  'escalationRate',
  'actionSuccessProxy',
]

/**
 * Compute delta between Mode A and Mode B. ONLY computes delta for
 * metrics that are non-null on BOTH sides. Lists unavailable metrics
 * explicitly.
 */
export function computeDelta(
  modeA: ComparisonMetrics,
  modeB: ComparisonMetrics,
): { deltas: Record<string, { baseline: number; jtg: number; delta: number }>; unavailable: string[] } {
  const deltas: Record<string, { baseline: number; jtg: number; delta: number }> = {}
  const unavailable: string[] = []

  for (const key of NUMERIC_METRIC_KEYS) {
    const snakeKey = METRIC_KEY_MAP[key]
    const a = modeA[key]
    const b = modeB[key]

    if (a === null || b === null) {
      unavailable.push(snakeKey)
      continue
    }

    const aNum = a as number
    const bNum = b as number
    deltas[snakeKey] = {
      baseline: aNum,
      jtg: bNum,
      delta: bNum - aNum,
    }
  }

  return { deltas, unavailable }
}

/** Simple pseudo-UUID (no crypto dependency). */
function generateId(): string {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`
}

/**
 * Factory: create a ComparisonRun with generated runId and timestamp.
 */
export function createComparisonRun(params: {
  inputSetId: string
  queryText: string
  sampleIndex: number
  modeA: ComparisonMetrics
  modeB: ComparisonMetrics
}): ComparisonRun {
  const { deltas, unavailable } = computeDelta(params.modeA, params.modeB)

  return {
    runId: `comp_${generateId()}`,
    timestamp: new Date().toISOString(),
    inputSetId: params.inputSetId,
    queryText: params.queryText,
    sampleIndex: params.sampleIndex,
    modeA: params.modeA,
    modeB: params.modeB,
    metricDeltas: deltas,
    unavailableMetrics: unavailable,
  }
}

/**
 * Welch's t-test for two independent samples with unequal variances.
 * Pure math — no external dependencies.
 *
 * Returns t-statistic, approximate p-value, and significance at alpha=0.05.
 * Uses the Welch-Satterthwaite degrees of freedom approximation.
 */
export function welchTTest(
  samplesA: number[],
  samplesB: number[],
): { tStatistic: number; pValue: number; significant: boolean } {
  const nA = samplesA.length
  const nB = samplesB.length

  if (nA < 2 || nB < 2) {
    return { tStatistic: 0, pValue: 1, significant: false }
  }

  const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
  const variance = (arr: number[], m: number) =>
    arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1)

  const mA = mean(samplesA)
  const mB = mean(samplesB)
  const vA = variance(samplesA, mA)
  const vB = variance(samplesB, mB)

  const seA = vA / nA
  const seB = vB / nB
  const seDiff = Math.sqrt(seA + seB)

  if (seDiff === 0) {
    return { tStatistic: 0, pValue: 1, significant: false }
  }

  const t = (mA - mB) / seDiff

  // Welch-Satterthwaite degrees of freedom
  const df = (seA + seB) ** 2 / (seA ** 2 / (nA - 1) + seB ** 2 / (nB - 1))

  // Approximate two-tailed p-value using the regularized incomplete beta function.
  // For a t-distribution with df degrees of freedom:
  //   p = I(df/(df+t^2); df/2, 1/2)
  // We use a simple numerical approximation.
  const pValue = tDistPValue(Math.abs(t), df)

  return {
    tStatistic: Math.round(t * 1000) / 1000,
    pValue: Math.round(pValue * 10000) / 10000,
    significant: pValue < 0.05,
  }
}

/**
 * Approximate two-tailed p-value for Student's t-distribution.
 * Uses the regularized incomplete beta function approximation.
 */
function tDistPValue(t: number, df: number): number {
  const x = df / (df + t * t)
  const p = regularizedIncompleteBeta(x, df / 2, 0.5)
  return Math.min(1, Math.max(0, p))
}

/**
 * Regularized incomplete beta function I_x(a, b) via continued fraction
 * (Lentz's method). Sufficient precision for t-test p-values.
 */
function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1

  // Use the continued fraction expansion when x < (a+1)/(a+b+2),
  // otherwise use the symmetry relation.
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - regularizedIncompleteBeta(1 - x, b, a)
  }

  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b)
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a

  // Lentz's continued fraction
  const maxIter = 200
  const eps = 1e-10
  let f = 1
  let c = 1
  let d = 1 - (a + b) * x / (a + 1)
  if (Math.abs(d) < eps) d = eps
  d = 1 / d
  f = d

  for (let m = 1; m <= maxIter; m++) {
    // Even step
    let num = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m))
    d = 1 + num * d
    if (Math.abs(d) < eps) d = eps
    c = 1 + num / c
    if (Math.abs(c) < eps) c = eps
    d = 1 / d
    f *= c * d

    // Odd step
    num = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1))
    d = 1 + num * d
    if (Math.abs(d) < eps) d = eps
    c = 1 + num / c
    if (Math.abs(c) < eps) c = eps
    d = 1 / d
    const delta = c * d
    f *= delta

    if (Math.abs(delta - 1) < eps) break
  }

  return front * f
}

/** Lanczos approximation for ln(Gamma(z)). */
function lnGamma(z: number): number {
  const g = 7
  const coef = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]

  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z)
  }

  z -= 1
  let x = coef[0]
  for (let i = 1; i < g + 2; i++) {
    x += coef[i] / (z + i)
  }
  const t = z + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

/**
 * Aggregate multiple ComparisonRuns into a ComparisonSummary.
 *
 * - avgDeltas for each metric that has data across runs.
 * - For response_time_ms: compute Welch's t-test.
 * - unavailableMetrics always includes the system-level unavailable list.
 */
export function computeSummary(runs: ComparisonRun[]): ComparisonSummary {
  if (runs.length === 0) {
    return {
      totalRuns: 0,
      inputSetId: '',
      dateRange: { from: '', to: '' },
      avgDeltas: {},
      unavailableMetrics: [...UNAVAILABLE_METRICS],
      statisticalSignificance: null,
    }
  }

  // Date range
  const timestamps = runs.map((r) => r.timestamp).sort()
  const inputSetId = runs[0].inputSetId

  // Collect per-metric values across runs
  const metricValues: Record<string, { baselines: number[]; jtgs: number[]; deltas: number[] }> = {}

  for (const run of runs) {
    for (const [key, val] of Object.entries(run.metricDeltas)) {
      if (!metricValues[key]) {
        metricValues[key] = { baselines: [], jtgs: [], deltas: [] }
      }
      metricValues[key].baselines.push(val.baseline)
      metricValues[key].jtgs.push(val.jtg)
      metricValues[key].deltas.push(val.delta)
    }
  }

  // Compute averages
  const avgDeltas: ComparisonSummary['avgDeltas'] = {}
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length

  for (const [key, val] of Object.entries(metricValues)) {
    avgDeltas[key] = {
      avgBaseline: Math.round(avg(val.baselines) * 1000) / 1000,
      avgJtg: Math.round(avg(val.jtgs) * 1000) / 1000,
      avgDelta: Math.round(avg(val.deltas) * 1000) / 1000,
      sampleSize: val.baselines.length,
    }
  }

  // Collect all unavailable metrics from runs + system-level list
  const unavailableSet = new Set(UNAVAILABLE_METRICS)
  for (const run of runs) {
    for (const m of run.unavailableMetrics) {
      unavailableSet.add(m)
    }
  }

  // Statistical significance for response_time_ms (if available)
  let statisticalSignificance: ComparisonSummary['statisticalSignificance'] = null
  const rtData = metricValues['response_time_ms']
  if (rtData && rtData.baselines.length >= 2) {
    statisticalSignificance = {
      response_time_ms: welchTTest(rtData.baselines, rtData.jtgs),
    }
  }

  return {
    totalRuns: runs.length,
    inputSetId,
    dateRange: { from: timestamps[0], to: timestamps[timestamps.length - 1] },
    avgDeltas,
    unavailableMetrics: [...unavailableSet],
    statisticalSignificance,
  }
}

// ---------------------------------------------------------------------
// I/O wrappers.
// ---------------------------------------------------------------------

const DATA_DIR = process.env.VERCEL === '1' ? '/tmp' : path.join(process.cwd(), '.data')
const COMPARISON_FILE = 'baseline_comparisons.jsonl'

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function comparisonFilePath(): string {
  return path.join(DATA_DIR, COMPARISON_FILE)
}

/** Append a ComparisonRun to baseline_comparisons.jsonl. */
export function recordComparisonRun(run: ComparisonRun): void {
  ensureDataDir()
  const line = JSON.stringify(run) + '\n'
  fs.appendFileSync(comparisonFilePath(), line, 'utf-8')
}

/** Read all ComparisonRuns from baseline_comparisons.jsonl. */
export function readComparisonRuns(): ComparisonRun[] {
  const fp = comparisonFilePath()
  if (!fs.existsSync(fp)) return []

  const content = fs.readFileSync(fp, 'utf-8').trim()
  if (!content) return []

  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ComparisonRun)
}

/** Read all runs and compute summary. */
export function getComparisonSummary(): ComparisonSummary {
  const runs = readComparisonRuns()
  return computeSummary(runs)
}
