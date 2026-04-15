import { aggregateRuleResults } from '../priority'
import type { RuleResult } from '@/lib/router/types'

describe('aggregateRuleResults', () => {
  it('returns defaults when no results', () => {
    const state = aggregateRuleResults([])
    expect(state.answerMode).toBe('direct_answer')
    expect(state.riskLevel).toBe('low')
    expect(state.confidenceBand).toBe('high')
    expect(state.shouldEscalate).toBe(false)
  })

  it('applies single rule result', () => {
    const results: RuleResult[] = [{
      matched: true,
      ruleKey: 'high_risk_gate',
      riskLevelOverride: 'high',
      answerModeOverride: 'handoff',
      shouldEscalate: true,
      traceTag: 'gate:high_risk',
      reason: 'High risk detected',
    }]
    const state = aggregateRuleResults(results)
    expect(state.answerMode).toBe('handoff')
    expect(state.riskLevel).toBe('high')
    expect(state.shouldEscalate).toBe(true)
  })

  it('tightens answerMode: cannot loosen from handoff to direct_answer', () => {
    const results: RuleResult[] = [
      { matched: true, ruleKey: 'r1', answerModeOverride: 'handoff', shouldEscalate: true },
      { matched: true, ruleKey: 'r2', answerModeOverride: 'direct_answer' },
    ]
    const state = aggregateRuleResults(results)
    expect(state.answerMode).toBe('handoff')
  })

  it('tightens riskLevel: cannot lower from high to low', () => {
    const results: RuleResult[] = [
      { matched: true, ruleKey: 'r1', riskLevelOverride: 'high' },
      { matched: true, ruleKey: 'r2', riskLevelOverride: 'low' },
    ]
    const state = aggregateRuleResults(results)
    expect(state.riskLevel).toBe('high')
  })

  it('tightens confidenceBand: cannot raise from low to high', () => {
    const results: RuleResult[] = [
      { matched: true, ruleKey: 'r1', confidenceOverride: 'low' },
      { matched: true, ruleKey: 'r2', confidenceOverride: 'high' },
    ]
    const state = aggregateRuleResults(results)
    expect(state.confidenceBand).toBe('low')
  })

  it('escalation forces handoff even if no rule set handoff', () => {
    const results: RuleResult[] = [
      { matched: true, ruleKey: 'r1', shouldEscalate: true, answerModeOverride: 'clarify' },
    ]
    const state = aggregateRuleResults(results)
    expect(state.shouldEscalate).toBe(true)
    expect(state.answerMode).toBe('handoff')
  })

  it('collects all trace tags and reasons', () => {
    const results: RuleResult[] = [
      { matched: true, ruleKey: 'r1', traceTag: 'tag1', reason: 'reason1' },
      { matched: true, ruleKey: 'r2', traceTag: 'tag2', reason: 'reason2' },
    ]
    const state = aggregateRuleResults(results)
    expect(state.traceTags).toEqual(['tag1', 'tag2'])
    expect(state.reasons).toEqual(['reason1', 'reason2'])
    expect(state.selectedRuleKeys).toEqual(['r1', 'r2'])
  })

  it('deduplicates trace tags and missing inputs', () => {
    const results: RuleResult[] = [
      { matched: true, ruleKey: 'r1', traceTag: 'dup', missingInputs: ['a', 'b'] },
      { matched: true, ruleKey: 'r2', traceTag: 'dup', missingInputs: ['b', 'c'] },
    ]
    const state = aggregateRuleResults(results)
    expect(state.traceTags).toEqual(['dup'])
    expect(state.missingInputs).toEqual(['a', 'b', 'c'])
  })

  it('official_only cannot override handoff from earlier rule', () => {
    const results: RuleResult[] = [
      { matched: true, ruleKey: 'high_risk_gate', answerModeOverride: 'handoff', shouldEscalate: true },
      { matched: true, ruleKey: 'official_only_gate', answerModeOverride: 'official_only' },
    ]
    const state = aggregateRuleResults(results)
    expect(state.answerMode).toBe('handoff')
  })
})
