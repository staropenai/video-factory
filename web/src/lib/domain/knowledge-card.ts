/**
 * JTG P1 — Knowledge Card render contract.
 *
 * A KnowledgeCard is the structured data row staff author inside /review
 * (or ingest from trusted external sources). It's distinct from the
 * runtime OutputBlock contract in ./contracts — that one describes what
 * the answer API emits; THIS one describes what the underlying knowledge
 * artifact looks like before rendering.
 *
 * The key invariant: a card's tier (A/B/C) is what decides whether the
 * router can bypass the LLM. This file encodes that decision as a
 * discriminated union so the compiler blocks any Tier A block that
 * accidentally carries LLM-enrichment fields, and any Tier C block that
 * accidentally claims `canShortcut: true`.
 *
 * Renderer is a pure transform KnowledgeCard -> KnowledgeCardBlock; if a
 * card is malformed for its declared tier, it throws. The P1 test suite
 * relies on both the happy path and the throw path.
 */

import type { KnowledgeCardTier, SourceType } from './enums'

/**
 * Evidence backing a knowledge card. Every card should carry at least one
 * EvidenceItem so staff can audit why the answer is considered trustworthy.
 * `source_type` is one of the canonical domain enums so provenance stays
 * consistent with the rest of the system.
 */
export interface EvidenceItem {
  id: string
  source_type: SourceType
  /** ISO-8601 timestamp of when this evidence was captured / published. */
  capturedAt: string
  url?: string
  notes?: string
}

/**
 * Card body — everything the renderer needs besides tier metadata. Steps
 * are optional at this level because Tier A and C don't use them; the
 * Tier B renderer pulls from here and hard-fails if steps are missing.
 */
export interface KnowledgeCardBody {
  title: string
  summary: string
  /** Used by Tier B renderer; required-for-B is enforced at render time. */
  steps?: string[]
  /** Free-form staff notes. Not shown to users. */
  staffNotes?: string
}

/**
 * Canonical card shape. `tier` decides the render path; `updatedAt` feeds
 * `isCardStale`; `evidence` must be non-empty for publish-worthy cards
 * (not enforced here — the publish endpoint enforces it).
 */
export interface KnowledgeCard {
  id: string
  tier: KnowledgeCardTier
  updatedAt: string
  body: KnowledgeCardBody
  evidence: EvidenceItem[]
}

// ---------------------------------------------------------------------
// Render blocks — discriminated union keyed by tier.
// ---------------------------------------------------------------------

export interface TierABlock {
  kind: 'TIER_A'
  canShortcut: true
  sourceTag: Extract<SourceType, 'STATIC'>
  title: string
  summary: string
  evidence: EvidenceItem[]
}

export interface TierBBlock {
  kind: 'TIER_B'
  canShortcut: boolean
  sourceTag: Extract<SourceType, 'STATIC'>
  title: string
  summary: string
  steps: string[]
  evidence: EvidenceItem[]
}

export interface TierCBlock {
  kind: 'TIER_C'
  canShortcut: false
  sourceTag: Extract<SourceType, 'STATIC'>
  title: string
  summary: string
  /** Optional LLM-enrichment slot populated by the router on live calls. */
  llmEnrichment?: {
    text: string
    /** Must be AI_INFERRED — enforced by the router before attaching. */
    sourceType: Extract<SourceType, 'AI_INFERRED'>
    confidence: number
  }
  evidence: EvidenceItem[]
}

export type KnowledgeCardBlock = TierABlock | TierBBlock | TierCBlock

// ---------------------------------------------------------------------
// Rendering + staleness helpers.
// ---------------------------------------------------------------------

/**
 * Pure transform: a KnowledgeCard -> the render block its tier dictates.
 * Throws if a Tier B card is missing steps (the only per-tier hard
 * precondition at render time). Staleness is NOT checked here — the
 * router decides whether to skip a stale card.
 */
export function renderCard(card: KnowledgeCard): KnowledgeCardBlock {
  const base = {
    sourceTag: 'STATIC' as const,
    title: card.body.title,
    summary: card.body.summary,
    evidence: card.evidence,
  }
  switch (card.tier) {
    case 'A':
      return {
        kind: 'TIER_A',
        canShortcut: true,
        ...base,
      }
    case 'B': {
      const steps = card.body.steps
      if (!steps || steps.length === 0) {
        throw new Error(
          `renderCard: Tier B card ${card.id} has no steps; Tier B requires at least one step`,
        )
      }
      return {
        kind: 'TIER_B',
        // Tier B still shortcuts the LLM when the retrieval score clears
        // the bar; the router is the final arbiter, not the renderer.
        canShortcut: true,
        ...base,
        steps,
      }
    }
    case 'C':
      return {
        kind: 'TIER_C',
        canShortcut: false,
        ...base,
      }
  }
}

/**
 * Staleness check. Default window is 180 days — long enough to avoid
 * spurious alarms on stable facts (hanko, garbage sorting) but short
 * enough that policy-tracked cards get re-reviewed at least twice a year.
 * Pure; `now` is injected so tests can pin time.
 */
export function isCardStale(
  card: KnowledgeCard,
  now: Date = new Date(),
  maxAgeDays = 180,
): boolean {
  const updatedMs = Date.parse(card.updatedAt)
  if (!Number.isFinite(updatedMs)) return true
  const ageMs = now.getTime() - updatedMs
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000
}
