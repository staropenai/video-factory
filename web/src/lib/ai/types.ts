/**
 * AI-layer types — mirrors openai_router_production_design.md §13.
 *
 * Distinct from src/lib/router/types.ts which describes the deterministic
 * rule-engine decision. The AI layer's category enum is wider (legal, tax,
 * billing, contract) so the model can express what the user is actually
 * asking; the rule layer still maps these onto the FAQ system's narrower set.
 */

export type Language = 'zh' | 'ja' | 'en'
export type AIRiskLevel = 'low' | 'medium' | 'high'

export type AICategory =
  | 'renting'
  | 'home_buying'
  | 'visa'
  | 'daily_life'
  | 'legal'
  | 'tax'
  | 'billing'
  | 'contract'
  | 'other'

/** Final response mode exposed at the API boundary. */
export type AnswerMode = 'normal' | 'official_only' | 'handoff' | 'clarify'

export interface AIUnderstandingResult {
  language: Language
  intent: string
  category: AICategory
  subtopic: string | null
  riskLevel: AIRiskLevel
  missingInfo: string[]
  searchQueries: string[]
  shouldOfficialOnly: boolean
  shouldHandoff: boolean
  confidence: number
  entities: {
    location: string | null
    documentType: string | null
    deadline: string | null
  }
}

export interface UnderstandingResult {
  understanding: AIUnderstandingResult
  source: 'openai' | 'fallback'
  latencyMs: number
  model?: string
  error?: string
}

export interface RenderResult {
  answer: string
  source: 'openai' | 'fallback'
  latencyMs: number
  model?: string
  error?: string
}
