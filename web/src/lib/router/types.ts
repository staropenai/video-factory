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

export type RetrievalSummary = {
  faqSlugs: string[]
  sourceCount: number
  supportingSourceCount: number
  topScore: number
  hasConflict: boolean
  hasStaleSource: boolean
  hasDynamicDependencyWithoutVerification: boolean
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
