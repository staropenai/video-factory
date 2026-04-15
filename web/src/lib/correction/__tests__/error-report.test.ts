import { generateErrorReport } from '../error-report'
import type { CorrectionRecord } from '../types'

function makeCorrection(overrides: Partial<CorrectionRecord> = {}): CorrectionRecord {
  return {
    id: 'corr_test',
    createdAt: new Date().toISOString(),
    requestId: 'req_1',
    originalQuery: 'test query',
    originalAnswer: 'test answer',
    correctedAnswer: 'corrected answer',
    correctionType: 'factual_error',
    explanation: 'was wrong',
    correctedBy: 'tester',
    originalAnswerType: 'inference_only',
    originalWasVerified: false,
    originalTier: 'C',
    originalRuleKeys: [],
    appliedToKnowledgeBase: false,
    ...overrides,
  }
}

describe('generateErrorReport', () => {
  it('handles empty corrections list', () => {
    const report = generateErrorReport([])
    expect(report.totalCorrections).toBe(0)
    expect(report.verifiedErrorRate).toBe(0)
    expect(report.pendingKbUpdates).toBe(0)
  })

  it('counts by correction type', () => {
    const corrections = [
      makeCorrection({ correctionType: 'factual_error' }),
      makeCorrection({ correctionType: 'factual_error' }),
      makeCorrection({ correctionType: 'missing_info' }),
    ]
    const report = generateErrorReport(corrections)
    expect(report.byType).toEqual({ factual_error: 2, missing_info: 1 })
  })

  it('counts by tier', () => {
    const corrections = [
      makeCorrection({ originalTier: 'A' }),
      makeCorrection({ originalTier: 'C' }),
      makeCorrection({ originalTier: 'C' }),
    ]
    const report = generateErrorReport(corrections)
    expect(report.byTier).toEqual({ A: 1, C: 2 })
  })

  it('tracks verified-but-wrong as critical signal', () => {
    const corrections = [
      makeCorrection({ originalWasVerified: true }),
      makeCorrection({ originalWasVerified: true }),
      makeCorrection({ originalWasVerified: false }),
    ]
    const report = generateErrorReport(corrections)
    expect(report.verifiedButWrong).toBe(2)
    expect(report.verifiedErrorRate).toBe(1) // 2 verified, 2 wrong
  })

  it('tracks pending KB updates', () => {
    const corrections = [
      makeCorrection({ appliedToKnowledgeBase: false }),
      makeCorrection({ appliedToKnowledgeBase: true }),
      makeCorrection({ appliedToKnowledgeBase: false }),
    ]
    const report = generateErrorReport(corrections)
    expect(report.pendingKbUpdates).toBe(2)
  })

  it('ranks top error rules by count', () => {
    const corrections = [
      makeCorrection({ originalRuleKeys: ['low_confidence_gate', 'official_only_gate'] }),
      makeCorrection({ originalRuleKeys: ['low_confidence_gate'] }),
      makeCorrection({ originalRuleKeys: ['high_risk_gate'] }),
    ]
    const report = generateErrorReport(corrections)
    expect(report.topErrorRules[0]).toEqual({ ruleKey: 'low_confidence_gate', count: 2 })
  })
})
