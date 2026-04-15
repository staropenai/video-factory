import { classifyAnswer } from '../classify'
import type { RouterDecision, RetrievalSummary } from '@/lib/router/types'

/** Minimal RouterDecision for testing */
function makeDecision(overrides: Partial<RouterDecision> = {}): RouterDecision {
  return {
    queryType: 'faq',
    riskLevel: 'low',
    confidenceBand: 'high',
    selectedFaqSlugs: [],
    selectedRuleKeys: [],
    missingInputs: [],
    answerMode: 'direct_answer',
    shouldEscalate: false,
    decisionReason: 'test',
    traceTags: [],
    knowledgeTrace: {
      knowledgeFound: false,
      faqMatchCount: 0,
      sourceCount: 0,
      supportingSourceCount: 0,
      topScore: 0,
      retrievalPath: 'none',
    },
    ...overrides,
  }
}

/** Minimal RetrievalSummary for testing */
function makeRetrieval(overrides: Partial<RetrievalSummary> = {}): RetrievalSummary {
  return {
    faqSlugs: [],
    sourceCount: 0,
    supportingSourceCount: 0,
    topScore: 0,
    hasConflict: false,
    hasStaleSource: false,
    hasDynamicDependencyWithoutVerification: false,
    ...overrides,
  }
}

describe('classifyAnswer', () => {
  it('classifies escalation/handoff as human_review_required', () => {
    const result = classifyAnswer({
      decision: makeDecision({ shouldEscalate: true, answerMode: 'handoff', selectedRuleKeys: ['high_risk_gate'] }),
      retrieval: makeRetrieval(),
      llmCalled: false,
      shortcutTaken: false,
    })

    expect(result.answer_type).toBe('human_review_required')
    expect(result.verification.verified).toBe(false)
    expect(result.verification.needs_human_review).toBe(true)
    expect(result.escalation.triggered).toBe(true)
    expect(result.evidence.rule_ids).toContain('high_risk_gate')
  })

  it('classifies Tier A shortcut as rule_based', () => {
    const result = classifyAnswer({
      decision: makeDecision({ answerMode: 'direct_answer', selectedRuleKeys: [] }),
      retrieval: makeRetrieval({ shortcut: 'tier_a_shortcut', faqSlugs: ['faq-1'], sourceCount: 1, topScore: 0.95 }),
      llmCalled: false,
      shortcutTaken: true,
    })

    expect(result.answer_type).toBe('rule_based')
    expect(result.verification.verified).toBe(true)
    expect(result.verification.needs_human_review).toBe(false)
    expect(result.evidence.reasoning_mode).toBe('deterministic')
  })

  it('classifies Tier B shortcut as rule_based', () => {
    const result = classifyAnswer({
      decision: makeDecision(),
      retrieval: makeRetrieval({ shortcut: 'tier_b_shortcut', faqSlugs: ['faq-2'], sourceCount: 2, topScore: 0.85 }),
      llmCalled: false,
      shortcutTaken: true,
    })

    expect(result.answer_type).toBe('rule_based')
    expect(result.verification.verified).toBe(true)
  })

  it('classifies high-score retrieval without LLM as retrieved_grounded', () => {
    const result = classifyAnswer({
      decision: makeDecision(),
      retrieval: makeRetrieval({ faqSlugs: ['faq-1'], sourceCount: 3, topScore: 0.8 }),
      llmCalled: false,
      shortcutTaken: false,
    })

    expect(result.answer_type).toBe('retrieved_grounded')
    expect(result.verification.verified).toBe(true)
    expect(result.evidence.reasoning_mode).toBe('retrieval')
  })

  it('classifies LLM + strong knowledge as verified inference_only', () => {
    const result = classifyAnswer({
      decision: makeDecision(),
      retrieval: makeRetrieval({ faqSlugs: ['faq-1'], sourceCount: 2, supportingSourceCount: 2, topScore: 0.8 }),
      llmCalled: true,
      shortcutTaken: false,
    })

    expect(result.answer_type).toBe('inference_only')
    expect(result.verification.verified).toBe(true)
    expect(result.evidence.reasoning_mode).toBe('hybrid')
  })

  it('classifies LLM + weak knowledge as unverified', () => {
    const result = classifyAnswer({
      decision: makeDecision(),
      retrieval: makeRetrieval({ faqSlugs: ['faq-1'], sourceCount: 1, supportingSourceCount: 0, topScore: 0.4 }),
      llmCalled: true,
      shortcutTaken: false,
    })

    expect(result.answer_type).toBe('unverified')
    expect(result.verification.verified).toBe(false)
    expect(result.verification.needs_human_review).toBe(true)
  })

  it('classifies LLM + conflicting sources as unverified', () => {
    const result = classifyAnswer({
      decision: makeDecision(),
      retrieval: makeRetrieval({ faqSlugs: ['faq-1'], sourceCount: 2, supportingSourceCount: 2, topScore: 0.9, hasConflict: true }),
      llmCalled: true,
      shortcutTaken: false,
    })

    expect(result.answer_type).toBe('unverified')
    expect(result.evidence.limitations).toContain('Conflicting sources detected')
  })

  it('classifies LLM + no knowledge as unverified', () => {
    const result = classifyAnswer({
      decision: makeDecision(),
      retrieval: makeRetrieval({ faqSlugs: [], sourceCount: 0, topScore: 0 }),
      llmCalled: true,
      shortcutTaken: false,
    })

    expect(result.answer_type).toBe('unverified')
    expect(result.verification.verified).toBe(false)
    expect(result.verification.needs_human_review).toBe(true)
    expect(result.evidence.reasoning_mode).toBe('inference')
    expect(result.evidence.limitations).toContain('No knowledge base sources available')
  })

  it('records stale source limitation', () => {
    const result = classifyAnswer({
      decision: makeDecision(),
      retrieval: makeRetrieval({ faqSlugs: ['faq-1'], sourceCount: 1, supportingSourceCount: 1, topScore: 0.8, hasStaleSource: true }),
      llmCalled: true,
      shortcutTaken: false,
    })

    expect(result.evidence.limitations).toContain('Some sources may be stale')
  })

  it('always includes a timestamp', () => {
    const result = classifyAnswer({
      decision: makeDecision(),
      retrieval: makeRetrieval(),
      llmCalled: true,
      shortcutTaken: false,
    })

    expect(result.timestamp).toBeDefined()
    expect(() => new Date(result.timestamp)).not.toThrow()
  })

  it('escalation takes priority over shortcut', () => {
    const result = classifyAnswer({
      decision: makeDecision({ shouldEscalate: true, answerMode: 'handoff' }),
      retrieval: makeRetrieval({ shortcut: 'tier_a_shortcut', faqSlugs: ['faq-1'], topScore: 0.95 }),
      llmCalled: false,
      shortcutTaken: true,
    })

    // Escalation must win even if shortcut was taken
    expect(result.answer_type).toBe('human_review_required')
  })
})
