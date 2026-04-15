/**
 * Router-specific types for the TypeScript rule engine layer.
 *
 * Domain-agnostic decision infrastructure.
 * Housing-specific TaskState fields removed.
 */

export type QueryType = 'faq' | 'rule' | 'case_specific' | 'dynamic' | 'out_of_scope'
export type RiskLevel = 'low' | 'medium' | 'high'
export type ConfidenceBand = 'low' | 'medium' | 'high'
export type AnswerMode = 'direct_answer' | 'clarify' | 'official_only' | 'handoff'

export type TaskState = {
  taskStateId?: string
  userId?: string
  anonSessionId?: string
  currentStage?: string
  requiresHuman?: boolean
  /** Extensible context — new domain fields go here */
  context?: Record<string, unknown>
}

/**
 * Card entropy tier — v4 改进 #1. See seed.ts / tables.ts for the full
 * contract. Re-exported here so router/decide.ts doesn't have to import from
 * the knowledge module.
 */
export type FaqTier = 'A' | 'B' | 'C'

/**
 * Source-type contract — v4 改进 #6. Every piece of knowledge entering the
 * router carries one of these tags so answers can be rendered with explicit
 * provenance instead of "hallucination with citations".
 */
export type SourceType = 'STATIC' | 'REALTIME' | 'AI_INFERRED'

export type RetrievalSummary = {
  faqSlugs: string[]
  sourceCount: number
  supportingSourceCount: number
  topScore: number
  hasConflict: boolean
  hasStaleSource: boolean
  hasDynamicDependencyWithoutVerification: boolean
  /**
   * Tier of the top matched card (v4 改进 #1). When this is 'A' or 'B' and
   * topScore is above the shortcut threshold, the router bypasses the LLM.
   */
  topTier?: FaqTier
  /**
   * Provenance of the top matched card (v4 改进 #6). Always present on
   * real retrievals; retained as optional so the EMPTY_RETRIEVAL literal
   * stays valid.
   */
  topSourceType?: SourceType
  /**
   * 'tier_a_shortcut' / 'tier_b_shortcut' when the router can skip the LLM.
   * 'none' when the AI layer must run.
   */
  shortcut?: 'tier_a_shortcut' | 'tier_b_shortcut' | 'none'
}

export type RuleContext = {
  queryText: string
  normalizedQuery: string
  queryType: QueryType
  taskState: TaskState
  retrieval: RetrievalSummary
  clarificationRounds: number
}

export type RuleResult = {
  matched: boolean
  ruleKey: string
  traceTag?: string
  answerModeOverride?: AnswerMode
  riskLevelOverride?: RiskLevel
  confidenceOverride?: ConfidenceBand
  shouldEscalate?: boolean
  reason?: string
  missingInputs?: string[]
}

export type KnowledgeTrace = {
  knowledgeFound: boolean
  faqMatchCount: number
  sourceCount: number
  supportingSourceCount: number
  topScore: number
  retrievalPath: 'local' | 'backend' | 'none'
}

export type RouterDecision = {
  queryType: QueryType
  riskLevel: RiskLevel
  confidenceBand: ConfidenceBand
  selectedFaqSlugs: string[]
  selectedRuleKeys: string[]
  missingInputs: string[]
  answerMode: AnswerMode
  shouldEscalate: boolean
  decisionReason: string
  traceTags: string[]
  knowledgeTrace: KnowledgeTrace
}

export type Rule = {
  key: string
  version: number
  priority: number
  match: (ctx: RuleContext) => boolean
  execute: (ctx: RuleContext) => RuleResult
}
