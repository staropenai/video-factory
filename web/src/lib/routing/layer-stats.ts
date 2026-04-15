/**
 * JTG P2 — Layer hit-rate computation (v5 改進 #1).
 *
 * The seven-layer architecture (v5 §0) needs quantitative feedback:
 *   - Which layer answered each query?
 *   - What % of queries hit Layer 1 (static knowledge) vs L3 (LLM)?
 *   - Is Layer 6 (escalation) firing too often?
 *
 * This module provides:
 *
 *   1. **classifyQueryLayer** — pure function that maps a router pathTrace
 *      to a canonical layer label. Testable without DB.
 *
 *   2. **computeLayerHitRates** — pure function that takes an array of
 *      layer labels + total query count and returns per-layer hit rates
 *      with target comparison.
 *
 *   3. **LAYER_TARGETS** — the v5 §1 target thresholds. Staff can compare
 *      actual rates against these to decide whether the knowledge base
 *      needs expansion (L1 too low) or the AI layer is struggling (L6
 *      too high).
 *
 * The I/O wrapper `getLayerHitRates` reads events from tables.ts; the
 * pure functions above are what the P2 test suite validates.
 */

import type { EventRow } from '@/lib/db/tables'
import { listEvents } from '@/lib/db/tables'

// ---------------------------------------------------------------------
// Layer labels.
// ---------------------------------------------------------------------

/**
 * Canonical layer labels mapped to the v5 seven-layer model.
 * L2 (evidence) and L7 (writeback) are cross-cutting and don't produce
 * "answers", so they're omitted from hit-rate tracking.
 */
export const LAYER_LABELS = [
  'L1_STATIC',
  'L3_AI',
  'L4_REALTIME',
  'L5_BRIDGE',
  'L6_ESCALATION',
  'L_UNKNOWN',
] as const
export type LayerLabel = (typeof LAYER_LABELS)[number]

/**
 * Target hit-rate thresholds from v5 改进 #1.
 *
 * L1 ≥ 55%  — cheap keyword/vector retrieval handles the majority.
 * L3 ≤ 25%  — LLM path reserved for genuinely ambiguous queries.
 * L4 ≤ 10%  — realtime data only when live prices/listings are needed.
 * L5 ≤ 15%  — language bridge for barrier scenarios.
 * L6 ≤ 5%   — escalation to human; high rate = AI capability gap.
 */
export const LAYER_TARGETS: Record<
  Exclude<LayerLabel, 'L_UNKNOWN'>,
  { target: number; comparison: 'gte' | 'lte' }
> = {
  L1_STATIC: { target: 0.55, comparison: 'gte' },
  L3_AI: { target: 0.25, comparison: 'lte' },
  L4_REALTIME: { target: 0.10, comparison: 'lte' },
  L5_BRIDGE: { target: 0.15, comparison: 'lte' },
  L6_ESCALATION: { target: 0.05, comparison: 'lte' },
}

// ---------------------------------------------------------------------
// Pure classification.
// ---------------------------------------------------------------------

/**
 * Minimal subset of the router's pathTrace that we need for classification.
 * Matches the shape the router already builds at runtime.
 */
export interface PathTraceInput {
  layers: string[]
  sourceClass: string
  llmCalled: boolean
}

/**
 * Classify a single query's pathTrace into a canonical layer label.
 * Pure — no I/O, no side effects. The router's pathTrace.sourceClass
 * is the primary signal:
 *
 *   STATIC + no LLM        → L1_STATIC
 *   STATIC + LLM called    → L3_AI (LLM enriched a static card)
 *   AI_INFERRED             → L3_AI
 *   REALTIME                → L4_REALTIME
 *   ESCALATION              → L6_ESCALATION
 *
 * Bridge (L5) is detected by checking whether the layers array includes
 * a 'bridge' entry. The bridge route is a separate endpoint so it won't
 * appear in the router's own pathTrace unless the caller chains them;
 * for now, L5 is classified from bridge events (route=/api/bridge).
 */
export function classifyQueryLayer(trace: PathTraceInput): LayerLabel {
  // Escalation takes priority — even if LLM was called, the answer
  // mode is handoff so the human is the final answerer.
  if (trace.sourceClass === 'ESCALATION') return 'L6_ESCALATION'

  // Realtime data path.
  if (trace.sourceClass === 'REALTIME') return 'L4_REALTIME'

  // Static knowledge with no LLM = pure Layer 1 (tier shortcut).
  if (trace.sourceClass === 'STATIC' && !trace.llmCalled) return 'L1_STATIC'

  // LLM was involved (either AI_INFERRED source or LLM enriched STATIC).
  if (trace.llmCalled || trace.sourceClass === 'AI_INFERRED') return 'L3_AI'

  // Bridge detection from layers array.
  if (trace.layers.some((l) => l.includes('bridge'))) return 'L5_BRIDGE'

  return 'L_UNKNOWN'
}

/**
 * Classify a bridge event. Bridge events come from /api/bridge, not from
 * the router, so they carry no pathTrace. We classify them as L5_BRIDGE.
 */
export function classifyBridgeEvent(_event: EventRow): LayerLabel {
  return 'L5_BRIDGE'
}

// ---------------------------------------------------------------------
// Pure hit-rate computation.
// ---------------------------------------------------------------------

export interface LayerHitRate {
  layer: LayerLabel
  hitCount: number
  totalQueries: number
  rate: number
  /** Target from LAYER_TARGETS, or null for L_UNKNOWN. */
  target: number | null
  /** Whether the current rate meets the target. */
  status: 'on_target' | 'below_target' | 'above_target' | 'no_target'
}

/**
 * Compute per-layer hit rates from an array of layer labels.
 * Pure — the caller is responsible for classifying events first.
 */
export function computeLayerHitRates(
  labels: LayerLabel[],
  totalQueries: number,
): LayerHitRate[] {
  const counts = new Map<LayerLabel, number>()
  for (const l of LAYER_LABELS) counts.set(l, 0)
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1)

  const total = totalQueries > 0 ? totalQueries : 1 // avoid /0

  return LAYER_LABELS.map((layer) => {
    const hitCount = counts.get(layer) ?? 0
    const rate = hitCount / total
    const spec = layer !== 'L_UNKNOWN'
      ? LAYER_TARGETS[layer]
      : null

    let status: LayerHitRate['status'] = 'no_target'
    if (spec) {
      if (spec.comparison === 'gte') {
        status = rate >= spec.target ? 'on_target' : 'below_target'
      } else {
        status = rate <= spec.target ? 'on_target' : 'above_target'
      }
    }

    return {
      layer,
      hitCount,
      totalQueries: total,
      rate,
      target: spec?.target ?? null,
      status,
    }
  })
}

// ---------------------------------------------------------------------
// I/O wrapper — reads events from JSONL, classifies, computes.
// ---------------------------------------------------------------------

/**
 * End-to-end hit-rate computation. Reads QUERY_RECEIVED events from
 * the events table (optionally filtered by `since`) and classifies
 * each one based on its metadata.pathTrace.
 *
 * Bridge events (route=/api/bridge) are classified as L5_BRIDGE.
 * Router events (route=/api/router) are classified via pathTrace
 * stored in metadata (requires P3 wiring to populate metadata.pathTrace
 * in the router — until then, those events classify as L_UNKNOWN).
 */
export function getLayerHitRates(since?: string): LayerHitRate[] {
  const routerEvents = listEvents({
    eventType: 'QUERY_RECEIVED',
    since,
  })

  const labels: LayerLabel[] = routerEvents.map((ev) => {
    // Bridge events.
    if (ev.route === '/api/bridge') return classifyBridgeEvent(ev)

    // Router events with pathTrace in metadata.
    const meta = ev.metadata as { pathTrace?: PathTraceInput } | undefined
    if (meta?.pathTrace) return classifyQueryLayer(meta.pathTrace)

    // Router events without pathTrace (pre-P3 wiring).
    return 'L_UNKNOWN' as LayerLabel
  })

  return computeLayerHitRates(labels, routerEvents.length)
}
