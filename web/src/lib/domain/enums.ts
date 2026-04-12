/**
 * JTG Spec v1 §3 — Required domain enums.
 *
 * Single source of truth for every closed-loop state in the system. Every
 * other module imports from here so that a typo like "NEEEDS_EDIT" is a
 * compile-time failure, not a runtime surprise.
 */

/** §3.1 SourceType — provenance contract for every knowledge artifact. */
export const SOURCE_TYPES = ['STATIC', 'REALTIME', 'AI_INFERRED'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

/** §3.2 CandidateState — lifecycle for FAQ candidates. */
export const CANDIDATE_STATES = [
  'NEW',
  'CLUSTERED',
  'REVIEWED',
  'NEEDS_EDIT',
  'PUBLISHED',
  'REJECTED',
] as const
export type CandidateState = (typeof CANDIDATE_STATES)[number]

/** §3.3 EventType — durable audit events. */
export const EVENT_TYPES = [
  'QUERY_RECEIVED',
  'CANDIDATE_CREATED',
  'CANDIDATE_REVIEWED',
  'LIVE_FAQ_PUBLISHED',
  'PUBLISH_FAILED',
  'RETRIEVE_HIT_STATIC',
  'RETRIEVE_HIT_REALTIME',
  'RETRIEVE_HIT_AI_INFERRED',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

/** §3.4 KnowledgeCardTier — tier-based routing. */
export const KNOWLEDGE_CARD_TIERS = ['A', 'B', 'C'] as const
export type KnowledgeCardTier = (typeof KNOWLEDGE_CARD_TIERS)[number]

/**
 * Narrow arbitrary input to a CandidateState, falling back to 'NEW'. Used on
 * read paths so legacy JSONL rows without a `state` field are normalized on
 * ingest (see `normalizeCandidateRow` in tables.ts).
 */
export function coerceCandidateState(v: unknown): CandidateState {
  return (CANDIDATE_STATES as readonly string[]).includes(v as string)
    ? (v as CandidateState)
    : 'NEW'
}
