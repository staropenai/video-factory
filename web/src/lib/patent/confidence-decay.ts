/**
 * Patent 方案B — Evidence confidence temporal decay.
 *
 * 权利要求1（独立）:
 *   "conf(E, t) = confidence_base × f_decay(t - collect_date, decay_function_type)"
 *   "当conf_current(E) < θ_evidence_min时，标记为'需更新'并从活跃集合中排除"
 *
 * Three decay function types:
 *   - linear:      f(Δt) = max(0, 1 - rate × Δt)
 *   - exponential: f(Δt) = exp(-ln(2) × Δt / half_life)
 *   - step:        f(Δt) = 1 if Δt < expiry_days, else 0
 *
 * All exported functions are PURE. Decay parameters (half_life, rate, θ)
 * are passed explicitly — confidential values live in .patent-internal/.
 *
 * The I/O wrapper at the bottom scans the evidence table and returns
 * records annotated with their current confidence.
 */

import type { EvidenceRecord, EvidenceConfidence } from '@/lib/db/tables'

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export type DecayFunctionType = 'linear' | 'exponential' | 'step'

export interface DecayParams {
  type: DecayFunctionType
  /** For linear: confidence reduction per day. [CONFIDENTIAL] */
  linearRatePerDay?: number
  /** For exponential: days until confidence halves. [CONFIDENTIAL] */
  halfLifeDays?: number
  /** For step: days until confidence drops to 0. Used from expiryDate. */
  stepExpiryDays?: number
}

export interface ConfidenceResult {
  evidenceId: string
  /** Base confidence from the confidence level category. */
  confidenceBase: number
  /** Current confidence after decay. */
  confidenceCurrent: number
  /** Days since evidence was collected. */
  daysSinceCollection: number
  /** Decay function applied. */
  decayType: DecayFunctionType
  /** Decay multiplier ∈ [0, 1]. */
  decayMultiplier: number
  /** Whether this evidence falls below θ_evidence_min. */
  needsUpdate: boolean
}

/** Map confidence level labels to base numeric scores. */
const CONFIDENCE_BASE_MAP: Record<EvidenceConfidence, number> = {
  official: 1.0,
  verified: 0.75,
  unverified: 0.50,
}

/** Default decay params — production reads from env/.patent-internal. */
export const DEFAULT_DECAY_PARAMS: DecayParams = {
  type: 'exponential',
  linearRatePerDay: parseFloat(process.env.PATENT_DECAY_LINEAR_RATE ?? '0.002'),
  halfLifeDays: parseFloat(process.env.PATENT_DECAY_HALF_LIFE ?? '180'),
}

/** Default minimum confidence threshold. [CONFIDENTIAL] */
export const DEFAULT_THETA_MIN = parseFloat(
  process.env.PATENT_THETA_EVIDENCE_MIN ?? '0.30',
)

// ---------------------------------------------------------------------
// Pure: decay functions.
// ---------------------------------------------------------------------

/**
 * Compute the decay multiplier f_decay(Δt).
 * Pure — no I/O.
 *
 * Returns a value ∈ [0, 1] representing how much of the original
 * confidence remains after Δt days.
 */
export function computeDecayMultiplier(
  daysSinceCollection: number,
  params: DecayParams,
): number {
  if (daysSinceCollection <= 0) return 1.0

  switch (params.type) {
    case 'linear': {
      const rate = params.linearRatePerDay ?? 0.002
      return Math.max(0, 1 - rate * daysSinceCollection)
    }
    case 'exponential': {
      const halfLife = params.halfLifeDays ?? 180
      // f(Δt) = exp(-ln(2) × Δt / half_life)
      return Math.exp((-Math.LN2 * daysSinceCollection) / halfLife)
    }
    case 'step': {
      const expiry = params.stepExpiryDays ?? 365
      return daysSinceCollection < expiry ? 1.0 : 0.0
    }
    default:
      return 1.0
  }
}

/**
 * Compute current confidence for a single evidence record.
 * Pure — no I/O.
 *
 * conf_current(E) = confidence_base × f_decay(Δt)
 */
export function computeCurrentConfidence(
  evidence: EvidenceRecord,
  params: DecayParams = DEFAULT_DECAY_PARAMS,
  thetaMin: number = DEFAULT_THETA_MIN,
  asOf: Date = new Date(),
): ConfidenceResult {
  const collectMs = Date.parse(evidence.dateCollected)
  const asOfMs = asOf.getTime()
  const daysSinceCollection = Number.isFinite(collectMs)
    ? Math.max(0, (asOfMs - collectMs) / 86_400_000)
    : 0

  const confidenceBase = CONFIDENCE_BASE_MAP[evidence.confidenceLevel] ?? 0.5
  const decayMultiplier = computeDecayMultiplier(daysSinceCollection, params)
  const confidenceCurrent = confidenceBase * decayMultiplier

  return {
    evidenceId: evidence.id,
    confidenceBase,
    confidenceCurrent,
    daysSinceCollection: Math.round(daysSinceCollection * 10) / 10,
    decayType: params.type,
    decayMultiplier: Math.round(decayMultiplier * 10000) / 10000,
    needsUpdate: confidenceCurrent < thetaMin,
  }
}

/**
 * Batch: compute current confidence for multiple evidence records.
 * Returns records sorted by confidenceCurrent descending.
 * Pure — no I/O.
 */
export function computeBatchConfidence(
  records: EvidenceRecord[],
  params: DecayParams = DEFAULT_DECAY_PARAMS,
  thetaMin: number = DEFAULT_THETA_MIN,
  asOf: Date = new Date(),
): ConfidenceResult[] {
  return records
    .map((r) => computeCurrentConfidence(r, params, thetaMin, asOf))
    .sort((a, b) => b.confidenceCurrent - a.confidenceCurrent)
}

/**
 * Filter evidence records to only those above θ_evidence_min.
 * Pure — no I/O.
 *
 * This implements the patent claim:
 *   "当conf_current(E) < θ_evidence_min时，从活跃集合中排除"
 */
export function filterActiveEvidence(
  records: EvidenceRecord[],
  params: DecayParams = DEFAULT_DECAY_PARAMS,
  thetaMin: number = DEFAULT_THETA_MIN,
  asOf: Date = new Date(),
): { active: ConfidenceResult[]; needsUpdate: ConfidenceResult[] } {
  const all = computeBatchConfidence(records, params, thetaMin, asOf)
  return {
    active: all.filter((r) => !r.needsUpdate),
    needsUpdate: all.filter((r) => r.needsUpdate),
  }
}

// ---------------------------------------------------------------------
// Pure: trigger score (方案B 触发信号检测).
// ---------------------------------------------------------------------

export interface TriggerScoreInput {
  /** Text entropy estimate H(text). */
  textEntropy: number
  /** Normalized dwell time ∈ [0, 1]. 1 = unusually long. */
  dwellNormalized: number
  /** Click pattern score ∈ [0, 1]. 1 = high uncertainty signals. */
  clickPatternScore: number
}

export interface TriggerScoreParams {
  w1: number  // text entropy weight [CONFIDENTIAL]
  w2: number  // dwell weight [CONFIDENTIAL]
  w3: number  // click weight [CONFIDENTIAL]
  theta: number  // trigger threshold [CONFIDENTIAL]
}

export const DEFAULT_TRIGGER_PARAMS: TriggerScoreParams = {
  w1: parseFloat(process.env.PATENT_TRIGGER_W1 ?? '0.5'),
  w2: parseFloat(process.env.PATENT_TRIGGER_W2 ?? '0.3'),
  w3: parseFloat(process.env.PATENT_TRIGGER_W3 ?? '0.2'),
  theta: parseFloat(process.env.PATENT_TRIGGER_THETA ?? '0.6'),
}

/**
 * Compute text entropy H(text) as character-level Shannon entropy.
 * Pure — no I/O.
 */
export function computeTextEntropy(text: string): number {
  if (!text || text.length === 0) return 0
  const freq = new Map<string, number>()
  for (const ch of text) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1)
  }
  const len = text.length
  let entropy = 0
  for (const count of freq.values()) {
    const p = count / len
    if (p > 0) entropy -= p * Math.log2(p)
  }
  return entropy
}

/**
 * Compute trigger score for evidence injection decision.
 * Pure — no I/O.
 *
 * trigger_score = w1·H(text) + w2·dwell_normalized + w3·click_pattern_score
 * Normalized to [0, 1] range (entropy is divided by max expected ~4.5 bits).
 */
export function computeTriggerScore(
  input: TriggerScoreInput,
  params: TriggerScoreParams = DEFAULT_TRIGGER_PARAMS,
): { score: number; shouldInject: boolean } {
  // Normalize entropy to [0, 1] (max character entropy ≈ 4.5 for mixed text).
  const normalizedEntropy = Math.min(1, input.textEntropy / 4.5)
  const score =
    params.w1 * normalizedEntropy +
    params.w2 * input.dwellNormalized +
    params.w3 * input.clickPatternScore
  return {
    score: Math.round(score * 10000) / 10000,
    shouldInject: score > params.theta,
  }
}

// ---------------------------------------------------------------------
// I/O wrapper.
// ---------------------------------------------------------------------

import { listEvidence } from '@/lib/db/tables'

/**
 * Scan all active evidence and annotate with current confidence.
 * I/O — reads from evidence table.
 */
export function scanEvidenceConfidence(
  params?: DecayParams,
  thetaMin?: number,
): { active: ConfidenceResult[]; needsUpdate: ConfidenceResult[] } {
  const records = listEvidence({ status: 'active' })
  return filterActiveEvidence(records, params, thetaMin)
}
