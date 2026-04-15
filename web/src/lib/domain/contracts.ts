/**
 * JTG Spec v1 §4 — Source Tag + Output Block contract.
 *
 * Every user-visible answer must be expressed as one or more labeled output
 * blocks. This file defines the types AND the validator. Any call site that
 * emits an AnswerPayload MUST pipe it through `validateAnswerPayload()`
 * before returning it.
 *
 * Enforcement rules (§4.3):
 *   - REALTIME content without timestamp     → reject
 *   - AI_INFERRED content without INFERENCE label → reject
 *   - A single block mixing source types      → reject (caller must split)
 *   - An OutputBlock with no source tags       → reject
 *
 * Failure mode (§4.4):
 *   - On any violation, the payload is marked `blocked: true` with a stable
 *     `block_reason` code. Callers decide whether to surface the error or
 *     swap in a safe template.
 */

import type { SourceType } from './enums'

export interface SourceTag {
  source_type: SourceType
  source_id?: string
  card_id?: string
  /** ISO 8601. Required at type level; REALTIME validation enforces it at runtime too. */
  timestamp: string
  /** Normalized 0..1. Not enforced numerically by the validator. */
  confidence: number
  expiry_warning: boolean
}

export type BlockLabel = 'FACT' | 'REALTIME' | 'INFERENCE'

export interface OutputBlock {
  content: string
  source_tags: SourceTag[]
  label: BlockLabel
}

export interface AnswerPayload {
  blocks: OutputBlock[]
  blocked?: boolean
  block_reason?: string
}

/** Stable error codes so tests and the frontend can pattern-match. */
export const BLOCK_REASONS = {
  NO_SOURCE_TAGS: 'NO_SOURCE_TAGS',
  REALTIME_MISSING_TIMESTAMP: 'REALTIME_MISSING_TIMESTAMP',
  AI_INFERRED_MISSING_LABEL: 'AI_INFERRED_MISSING_LABEL',
  MIXED_SOURCES_IN_BLOCK: 'MIXED_SOURCES_IN_BLOCK',
  EMPTY_PAYLOAD: 'EMPTY_PAYLOAD',
} as const
export type BlockReason = (typeof BLOCK_REASONS)[keyof typeof BLOCK_REASONS]

/**
 * Walks every block and enforces §4.3. Returns the payload unchanged on
 * success, or a `{blocked: true, block_reason}` shape on the first
 * violation. Callers decide whether to propagate or substitute.
 */
export function validateAnswerPayload(payload: AnswerPayload): AnswerPayload {
  if (!payload.blocks || payload.blocks.length === 0) {
    return {
      ...payload,
      blocked: true,
      block_reason: BLOCK_REASONS.EMPTY_PAYLOAD,
    }
  }
  for (const block of payload.blocks) {
    if (!block.source_tags || block.source_tags.length === 0) {
      return {
        ...payload,
        blocked: true,
        block_reason: BLOCK_REASONS.NO_SOURCE_TAGS,
      }
    }
    const types = new Set(block.source_tags.map((t) => t.source_type))
    if (types.size > 1) {
      return {
        ...payload,
        blocked: true,
        block_reason: BLOCK_REASONS.MIXED_SOURCES_IN_BLOCK,
      }
    }
    const only = block.source_tags[0].source_type
    if (only === 'REALTIME') {
      const allHaveTs = block.source_tags.every(
        (t) => typeof t.timestamp === 'string' && t.timestamp.length > 0,
      )
      if (!allHaveTs || block.label !== 'REALTIME') {
        return {
          ...payload,
          blocked: true,
          block_reason: BLOCK_REASONS.REALTIME_MISSING_TIMESTAMP,
        }
      }
    }
    if (only === 'AI_INFERRED' && block.label !== 'INFERENCE') {
      return {
        ...payload,
        blocked: true,
        block_reason: BLOCK_REASONS.AI_INFERRED_MISSING_LABEL,
      }
    }
  }
  return payload
}

/**
 * Tiny helper to build a fully-tagged STATIC fact block from a FAQ row. Kept
 * here instead of inline in route handlers so the contract isn't reinvented.
 */
export function staticFactBlock(
  content: string,
  cardId: string,
  confidence = 1,
): OutputBlock {
  return {
    content,
    label: 'FACT',
    source_tags: [
      {
        source_type: 'STATIC',
        card_id: cardId,
        timestamp: new Date().toISOString(),
        confidence,
        expiry_warning: false,
      },
    ],
  }
}

/** Build an INFERENCE block for model-generated text. */
export function aiInferredBlock(
  content: string,
  derivedFromCardIds: string[],
  confidence = 0.6,
): OutputBlock {
  return {
    content,
    label: 'INFERENCE',
    source_tags: [
      {
        source_type: 'AI_INFERRED',
        // `source_id` records provenance upstream — which cards fed the model.
        source_id: derivedFromCardIds.join(','),
        timestamp: new Date().toISOString(),
        confidence,
        expiry_warning: false,
      },
    ],
  }
}
