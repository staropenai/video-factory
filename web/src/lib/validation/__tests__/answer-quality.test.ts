import { validateAnswerQuality } from '../answer-quality'
import type { AnswerMeta } from '@/lib/answer-reliability/types'

function baseMeta(overrides: Partial<AnswerMeta> = {}): AnswerMeta {
  return {
    answer_type: 'rule_based',
    verification: { verified: true, verification_notes: 'test', source_count: 1, needs_human_review: false },
    evidence: { rule_ids: [], source_ids: ['faq-1'], evidence_snippets: [], reasoning_mode: 'deterministic', limitations: [] },
    escalation: { triggered: false },
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('validateAnswerQuality', () => {
  it('passes a valid direct answer', () => {
    const result = validateAnswerQuality(
      'This is a helpful answer with enough content to pass the minimum length check.',
      baseMeta(),
      'en',
    )
    expect(result.passed).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('fails on empty answer for non-escalation', () => {
    const result = validateAnswerQuality('', baseMeta(), 'en')
    expect(result.passed).toBe(false)
    expect(result.issues).toContain('Empty answer for non-escalation path')
  })

  it('allows empty answer for human_review_required', () => {
    const meta = baseMeta({ answer_type: 'human_review_required' })
    const result = validateAnswerQuality('', meta, 'en')
    expect(result.passed).toBe(true)
  })

  it('fails on too-short verified answer', () => {
    const result = validateAnswerQuality('Short.', baseMeta(), 'en')
    expect(result.passed).toBe(false)
    expect(result.issues[0]).toMatch(/too short/)
  })

  it('detects system prompt leakage', () => {
    const result = validateAnswerQuality(
      'Based on the SAFETY RULES we follow, here is your answer about housing.',
      baseMeta(),
      'en',
    )
    expect(result.passed).toBe(false)
    expect(result.issues[0]).toMatch(/system prompt leakage/)
  })

  it('detects internal field name leakage', () => {
    const result = validateAnswerQuality(
      'The answerModeOverride was set to handoff because of high risk.',
      baseMeta(),
      'en',
    )
    expect(result.passed).toBe(false)
  })

  it('flags language mismatch for Chinese', () => {
    const result = validateAnswerQuality(
      'This is a purely English answer with no Chinese characters at all and it is quite long.',
      baseMeta(),
      'zh',
    )
    expect(result.passed).toBe(false)
    expect(result.issues[0]).toMatch(/not be in detected language/)
  })

  it('passes Chinese answer for Chinese detection', () => {
    const result = validateAnswerQuality(
      '这是一个关于日本生活的有用回答，包含足够的内容来通过最低长度检查。',
      baseMeta(),
      'zh',
    )
    expect(result.passed).toBe(true)
  })

  it('passes Japanese answer for Japanese detection', () => {
    const result = validateAnswerQuality(
      'これは日本での生活に関する有益な回答です。最低長さのチェックをパスするのに十分な内容が含まれています。',
      baseMeta(),
      'ja',
    )
    expect(result.passed).toBe(true)
  })
})
