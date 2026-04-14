/**
 * JTG v7 — Mathematical Routing Optimizer (Layer 2)
 *
 * Upgrades from rule-based routing (Layer 1: "if X then Y") to algorithmic
 * optimization:
 *
 *   R* = argmin_R [ alpha * cost + beta * latency - gamma * quality ]
 *
 * The existing router (src/lib/router/decide.ts) uses a rule engine.
 * This optimizer sits alongside it as the "judgment layer 2" — it scores
 * each possible route mathematically and picks the optimal one.
 *
 * Design:
 *   - Pure / I/O separation: all optimization logic is pure functions
 *   - No top-level await
 *   - Weights read from process.env with safe defaults
 */

// ─── Types ──────────────────────────────────────────────────────────

/** Route candidates — the possible outcomes */
export type RouteCandidate =
  | 'layer1_static'
  | 'layer3_ai'
  | 'layer5_bridge'
  | 'layer6_human'

export interface RouteFeatures {
  /** 0-1: semantic match quality from retrieval */
  fSemantic: number
  /** 0-1: risk assessment score */
  fRisk: number
  /** 0-1: language action capacity (from patent f-lang.ts) */
  fLang: number
  /** 0-1: evidence freshness (from confidence decay) */
  fTemporal: number
  /** 0-1: overall confidence band mapped to number */
  fConfidence: number
  /** 0-1: estimated query complexity */
  queryComplexity: number
}

export interface RouteCostModel {
  /** Dollar cost per query for each route */
  costPerQuery: Record<RouteCandidate, number>
  /** Average latency in ms for each route */
  latencyMs: Record<RouteCandidate, number>
  /** Base quality score for each route (before feature adjustment) */
  baseQuality: Record<RouteCandidate, number>
}

export interface OptimizationWeights {
  /** Cost weight */
  alpha: number
  /** Latency weight */
  beta: number
  /** Quality weight (higher = prefer quality over cost) */
  gamma: number
}

export interface RouteScore {
  route: RouteCandidate
  rawCost: number
  rawLatency: number
  rawQuality: number
  /** Normalized objective: lower = better (minimization problem) */
  objectiveValue: number
}

export interface OptimizationResult {
  optimal: RouteCandidate
  scores: RouteScore[]
  features: RouteFeatures
  weights: OptimizationWeights
  /** Whether layer6 was avoided (key patent metric) */
  avoidedHumanEscalation: boolean
  /** Estimated cost saving vs always-human baseline */
  costSavingVsBaseline: number
}

// ─── Constants ──────────────────────────────────────────────────────

export const ROUTE_CANDIDATES: readonly RouteCandidate[] = [
  'layer1_static',
  'layer3_ai',
  'layer5_bridge',
  'layer6_human',
] as const

export const DEFAULT_COST_MODEL: RouteCostModel = {
  costPerQuery: {
    layer1_static: 0.0,
    layer3_ai: 0.02,
    layer5_bridge: 0.05,
    layer6_human: 5.0,
  },
  latencyMs: {
    layer1_static: 50,
    layer3_ai: 800,
    layer5_bridge: 1200,
    layer6_human: 300_000,
  },
  baseQuality: {
    layer1_static: 0.95,
    layer3_ai: 0.8,
    layer5_bridge: 0.85,
    layer6_human: 0.99,
  },
}

/** Weights read from env with safe defaults */
const ROUTE_WEIGHT_ALPHA = parseFloat(
  process.env.PATENT_ROUTE_ALPHA ?? '0.3',
)
const ROUTE_WEIGHT_BETA = parseFloat(
  process.env.PATENT_ROUTE_BETA ?? '0.1',
)
const ROUTE_WEIGHT_GAMMA = parseFloat(
  process.env.PATENT_ROUTE_GAMMA ?? '0.6',
)

export const DEFAULT_WEIGHTS: OptimizationWeights = {
  alpha: ROUTE_WEIGHT_ALPHA,
  beta: ROUTE_WEIGHT_BETA,
  gamma: ROUTE_WEIGHT_GAMMA,
}

/** Human baseline cost — used to compute savings */
const HUMAN_BASELINE_LATENCY_MS = 300_000

// ─── Pure Functions ─────────────────────────────────────────────────

/**
 * Min-max normalize a value to the 0-1 range.
 * Clamps output to [0, 1].
 */
export function normalizeValue(
  value: number,
  min: number,
  max: number,
): number {
  if (max === min) return 0
  const normalized = (value - min) / (max - min)
  return Math.max(0, Math.min(1, normalized))
}

/**
 * Adjusts the base quality of a route by the query features.
 *
 * - layer1_static:  quality x fSemantic x fTemporal
 *     (good when retrieval match is strong AND evidence is fresh)
 * - layer3_ai:      quality x fConfidence x (1 - fRisk * 0.5)
 *     (penalize when risk is high)
 * - layer5_bridge:  quality x (1 - fLang)
 *     (more valuable when language capacity is LOW)
 * - layer6_human:   quality x 1.0
 *     (human is always high quality, but expensive)
 *
 * Constraint enforcement (applied after base adjustment):
 * - fRisk > 0.8  =>  layer6_human gets +0.2 quality bonus (safety override)
 * - fSemantic > 0.9 AND fTemporal > 0.8  =>  layer1_static gets +0.1 bonus
 */
export function computeQualityAdjustment(
  route: RouteCandidate,
  features: RouteFeatures,
  costModel: RouteCostModel = DEFAULT_COST_MODEL,
): number {
  const base = costModel.baseQuality[route]
  let quality: number

  switch (route) {
    case 'layer1_static':
      quality = base * features.fSemantic * features.fTemporal
      break
    case 'layer3_ai':
      quality = base * features.fConfidence * (1 - features.fRisk * 0.5)
      break
    case 'layer5_bridge':
      quality = base * (1 - features.fLang)
      break
    case 'layer6_human':
      quality = base * 1.0
      break
    default: {
      const _exhaustive: never = route
      throw new Error(`Unknown route: ${_exhaustive}`)
    }
  }

  // Constraint enforcement: safety override
  if (features.fRisk > 0.8 && route === 'layer6_human') {
    quality += 0.2
  }

  // Constraint enforcement: high-confidence shortcut
  if (
    features.fSemantic > 0.9 &&
    features.fTemporal > 0.8 &&
    route === 'layer1_static'
  ) {
    quality += 0.1
  }

  return quality
}

/**
 * Score a single route candidate.
 *
 * objectiveValue = alpha * normalizedCost + beta * normalizedLatency - gamma * rawQuality
 *
 * Lower objectiveValue = better (this is a minimization problem).
 */
export function computeRouteScore(
  route: RouteCandidate,
  features: RouteFeatures,
  weights: OptimizationWeights = DEFAULT_WEIGHTS,
  costModel: RouteCostModel = DEFAULT_COST_MODEL,
): RouteScore {
  const rawCost = costModel.costPerQuery[route]
  const rawLatency = costModel.latencyMs[route] / HUMAN_BASELINE_LATENCY_MS
  const rawQuality = computeQualityAdjustment(route, features, costModel)

  // Normalize cost against the human baseline (most expensive route)
  const maxCost = Math.max(
    ...ROUTE_CANDIDATES.map((r) => costModel.costPerQuery[r]),
  )
  const normalizedCost = maxCost > 0 ? rawCost / maxCost : 0

  const objectiveValue =
    weights.alpha * normalizedCost +
    weights.beta * rawLatency -
    weights.gamma * rawQuality

  return {
    route,
    rawCost,
    rawLatency,
    rawQuality,
    objectiveValue,
  }
}

/**
 * Score all 4 route candidates and return the optimal one
 * (lowest objectiveValue).
 */
export function optimizeRoute(
  features: RouteFeatures,
  weights: OptimizationWeights = DEFAULT_WEIGHTS,
  costModel: RouteCostModel = DEFAULT_COST_MODEL,
): OptimizationResult {
  const scores = ROUTE_CANDIDATES.map((route) =>
    computeRouteScore(route, features, weights, costModel),
  )

  // Pick the route with the lowest objective value
  const sorted = [...scores].sort(
    (a, b) => a.objectiveValue - b.objectiveValue,
  )
  const optimal = sorted[0]!.route

  const avoidedHumanEscalation = optimal !== 'layer6_human'

  // Cost saving: difference between human cost and chosen route cost
  const humanCost = costModel.costPerQuery.layer6_human
  const chosenCost = costModel.costPerQuery[optimal]
  const costSavingVsBaseline = humanCost - chosenCost

  return {
    optimal,
    scores,
    features,
    weights,
    avoidedHumanEscalation,
    costSavingVsBaseline,
  }
}

// ─── Convenience Converters ─────────────────────────────────────────

/**
 * Map a confidence band label to a numeric value.
 */
export function computeConfidenceBandNumeric(
  band: 'low' | 'medium' | 'high',
): number {
  switch (band) {
    case 'low':
      return 0.3
    case 'medium':
      return 0.6
    case 'high':
      return 0.9
  }
}

/**
 * Build RouteFeatures from the existing router context types.
 *
 * This bridges the rule-based router's outputs into the optimizer's
 * feature vector.
 */
export function featuresFromRouterContext(
  retrieval: { topScore: number; hasStaleSource: boolean },
  riskLevel: string,
  confidenceBand: string,
  fLang: number = 0.5,
): RouteFeatures {
  const fSemantic = Math.max(0, Math.min(1, retrieval.topScore))
  const fTemporal = retrieval.hasStaleSource ? 0.3 : 0.9

  // Map risk level string to numeric
  let fRisk: number
  switch (riskLevel) {
    case 'high':
      fRisk = 0.9
      break
    case 'medium':
      fRisk = 0.5
      break
    case 'low':
      fRisk = 0.1
      break
    default:
      fRisk = 0.5
  }

  // Map confidence band to numeric
  const band = (
    ['low', 'medium', 'high'].includes(confidenceBand)
      ? confidenceBand
      : 'medium'
  ) as 'low' | 'medium' | 'high'
  const fConfidence = computeConfidenceBandNumeric(band)

  // Query complexity heuristic: inverse of confidence, scaled by risk
  const queryComplexity = Math.max(
    0,
    Math.min(1, (1 - fConfidence) * 0.6 + fRisk * 0.4),
  )

  return {
    fSemantic,
    fRisk,
    fLang: Math.max(0, Math.min(1, fLang)),
    fTemporal,
    fConfidence,
    queryComplexity,
  }
}
