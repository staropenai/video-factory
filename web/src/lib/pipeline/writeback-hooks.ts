/**
 * JTG P2 — Layer 7 writeback hooks (v5 改进 #4).
 *
 * v5 redefines Layer 7 as "全链路基础设施" (full-pipeline infrastructure),
 * not an endpoint feature. Every layer should emit structured writeback
 * events so the system learns from usage.
 *
 * This module provides:
 *
 *   1. **shouldAutoPropose** — pure threshold check: has a cluster reached
 *      the proposal threshold (default ≥ 5)?
 *
 *   2. **buildProposalMetadata** — pure transform: build the structured
 *      metadata block the sensing → review → publish loop needs.
 *
 *   3. **recordLayerHit** — I/O wrapper: inserts a durable event with
 *      layer + trace metadata via insertEvent.
 *
 *   4. **autoProposeFaqCandidate** — I/O wrapper: if a cluster crosses
 *      the threshold AND no candidate with that signature already exists,
 *      create one in CLUSTERED state.
 *
 * The pure functions are what the P2 test suite validates. The I/O
 * wrappers are thin and only call insertEvent / insertFaqCandidate.
 */

import type { LayerLabel, PathTraceInput } from '@/lib/routing/layer-stats'
import { classifyQueryLayer } from '@/lib/routing/layer-stats'
import type { FaqCandidateRow } from '@/lib/db/tables'
import {
  insertEvent,
  insertFaqCandidate,
  listFaqCandidates,
} from '@/lib/db/tables'

// ---------------------------------------------------------------------
// Pure: auto-proposal threshold.
// ---------------------------------------------------------------------

export interface AutoProposalOptions {
  /** Minimum cluster size to trigger a proposal. Default 5 (v5 §4). */
  minCount?: number
}

/**
 * Pure check: should the system auto-propose a FAQ candidate for this
 * cluster? The v5 spec says "same question asked ≥ 5 times in 7 days,
 * Layer 1 未命中". Caller provides the pre-computed count.
 */
export function shouldAutoPropose(
  clusterCount: number,
  options: AutoProposalOptions = {},
): boolean {
  const min = options.minCount ?? 5
  return clusterCount >= min
}

// ---------------------------------------------------------------------
// Pure: proposal metadata builder.
// ---------------------------------------------------------------------

export interface ProposalMetadata {
  signature: string
  clusterSize: number
  sampleQuery: string
  dominantLanguage: 'en' | 'zh' | 'ja'
  source: 'auto_writeback'
  windowDays: number
}

/**
 * Pure builder for the metadata that accompanies an auto-proposed FAQ
 * candidate. No I/O — just shapes the data.
 */
export function buildProposalMetadata(input: {
  signature: string
  clusterSize: number
  sampleQuery: string
  dominantLanguage: 'en' | 'zh' | 'ja'
  windowDays?: number
}): ProposalMetadata {
  return {
    signature: input.signature,
    clusterSize: input.clusterSize,
    sampleQuery: input.sampleQuery.slice(0, 200),
    dominantLanguage: input.dominantLanguage,
    source: 'auto_writeback',
    windowDays: input.windowDays ?? 7,
  }
}

// ---------------------------------------------------------------------
// Pure: writeback event shape.
// ---------------------------------------------------------------------

export type WritebackAction =
  | 'layer_hit'
  | 'layer_miss'
  | 'escalation'
  | 'bridge_used'
  | 'feedback_received'
  | 'auto_proposal'

export interface WritebackEvent {
  layer: LayerLabel
  action: WritebackAction
  queryId?: string
  cardId?: string
  sessionId?: string
  metadata: Record<string, unknown>
}

/**
 * Pure builder for a layer-hit writeback event from a router pathTrace.
 * Classifies the layer and shapes the event. No I/O.
 */
export function buildLayerHitEvent(
  pathTrace: PathTraceInput,
  extras: { queryId?: string; cardId?: string; sessionId?: string } = {},
): WritebackEvent {
  const layer = classifyQueryLayer(pathTrace)
  return {
    layer,
    action: layer === 'L6_ESCALATION' ? 'escalation' : 'layer_hit',
    queryId: extras.queryId,
    cardId: extras.cardId,
    sessionId: extras.sessionId,
    metadata: {
      sourceClass: pathTrace.sourceClass,
      llmCalled: pathTrace.llmCalled,
      layerCount: pathTrace.layers.length,
    },
  }
}

// ---------------------------------------------------------------------
// I/O wrappers.
// ---------------------------------------------------------------------

/**
 * Persist a writeback event as a durable QUERY_RECEIVED event with
 * layer metadata. Route is tagged as '/writeback' so the daily-summary
 * and layer-stats modules can filter for these.
 */
export function recordLayerHit(event: WritebackEvent): void {
  insertEvent({
    eventType: 'QUERY_RECEIVED',
    route: '/writeback',
    relatedIds: {
      queryId: event.queryId,
      cardId: event.cardId,
      sessionId: event.sessionId,
    },
    metadata: {
      layer: event.layer,
      action: event.action,
      ...event.metadata,
    },
  })
}

/**
 * Check whether a candidate with the given clusterSignature already
 * exists (in any non-REJECTED state). If it does, we shouldn't propose
 * a duplicate.
 */
function candidateExistsForSignature(signature: string): boolean {
  const candidates = listFaqCandidates()
  return candidates.some(
    (c) => c.clusterSignature === signature && c.state !== 'REJECTED',
  )
}

/**
 * Auto-propose a FAQ candidate from a cluster. Only creates one if:
 *   1. The cluster count meets the threshold.
 *   2. No existing non-REJECTED candidate has the same signature.
 *
 * Returns the new candidate row, or null if proposal was skipped.
 */
export function autoProposeFaqCandidate(input: {
  signature: string
  clusterSize: number
  sampleQuery: string
  dominantLanguage: 'en' | 'zh' | 'ja'
  queries?: string[]
  options?: AutoProposalOptions
}): FaqCandidateRow | null {
  if (!shouldAutoPropose(input.clusterSize, input.options)) return null
  if (candidateExistsForSignature(input.signature)) return null

  const candidate = insertFaqCandidate({
    source: 'sensing',
    state: 'CLUSTERED',
    sourceQueryText: input.sampleQuery,
    detectedLanguage: input.dominantLanguage,
    candidateTitle: input.sampleQuery.slice(0, 120),
    candidateAnswer: '',
    riskLevel: 'unknown',
    createdBy: 'auto_writeback',
    clusterSignature: input.signature,
    clusterSize: input.clusterSize,
    clusterQueries: (input.queries ?? []).slice(0, 20),
    notes: `Auto-proposed by writeback pipeline: ${input.clusterSize} no-match queries`,
  })

  insertEvent({
    eventType: 'CANDIDATE_CREATED',
    route: '/writeback',
    relatedIds: { candidateId: candidate.id },
    metadata: { ...buildProposalMetadata({
      signature: input.signature,
      clusterSize: input.clusterSize,
      sampleQuery: input.sampleQuery,
      dominantLanguage: input.dominantLanguage,
    }) },
  })

  return candidate
}
