import { validateAnswerMeta, detectFalseClaims } from '../validators'
import type { AnswerMeta } from '../types'

function baseMeta(overrides: Partial<AnswerMeta> = {}): AnswerMeta {
  return {
    answer_type: 'rule_based',
    verification: {
      verified: true,
      verification_notes: 'test',
      source_count: 1,
      needs_human_review: false,
    },
    evidence: {
      rule_ids: ['test_rule'],
      source_ids: ['faq-1'],
      evidence_snippets: [],
      reasoning_mode: 'deterministic',
      limitations: [],
    },
    escalation: { triggered: false },
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('validateAnswerMeta', () => {
  it('passes valid rule_based meta', () => {
    const result = validateAnswerMeta(baseMeta())
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('rejects rule_based with no source_ids', () => {
    const meta = baseMeta({
      evidence: { rule_ids: [], source_ids: [], evidence_snippets: [], reasoning_mode: 'deterministic', limitations: [] },
    })
    const result = validateAnswerMeta(meta)
    expect(result.valid).toBe(false)
    expect(result.corrected!.answer_type).toBe('unverified')
    expect(result.corrected!.verification.verified).toBe(false)
  })

  it('rejects verified=true with source_count=0', () => {
    const meta = baseMeta({
      verification: { verified: true, verification_notes: 'test', source_count: 0, needs_human_review: false },
    })
    const result = validateAnswerMeta(meta)
    expect(result.valid).toBe(false)
    expect(result.corrected!.verification.verified).toBe(false)
  })

  it('corrects human_review_required with needs_human_review=false', () => {
    const meta = baseMeta({
      answer_type: 'human_review_required',
      verification: { verified: false, verification_notes: 'escalated', source_count: 0, needs_human_review: false },
      escalation: { triggered: true, reason: 'high risk' },
    })
    const result = validateAnswerMeta(meta)
    expect(result.valid).toBe(false)
    expect(result.corrected!.verification.needs_human_review).toBe(true)
    expect(result.corrected!.answer_type).toBe('human_review_required')
  })

  it('corrects human_review_required with escalation not triggered', () => {
    const meta = baseMeta({
      answer_type: 'human_review_required',
      verification: { verified: false, verification_notes: 'escalated', source_count: 0, needs_human_review: true },
      escalation: { triggered: false },
    })
    const result = validateAnswerMeta(meta)
    expect(result.valid).toBe(false)
    expect(result.corrected!.escalation.triggered).toBe(true)
  })

  it('passes valid unverified meta', () => {
    const meta = baseMeta({
      answer_type: 'unverified',
      verification: { verified: false, verification_notes: 'no sources', source_count: 0, needs_human_review: true },
      evidence: { rule_ids: [], source_ids: [], evidence_snippets: [], reasoning_mode: 'inference', limitations: [] },
    })
    const result = validateAnswerMeta(meta)
    expect(result.valid).toBe(true)
  })
})

describe('detectFalseClaims', () => {
  it('does not flag rule_based answers', () => {
    const meta = baseMeta({ answer_type: 'rule_based' })
    const result = detectFalseClaims('This is definitely correct.', meta)
    expect(result.hasCertaintyLanguage).toBe(false)
  })

  it('flags certainty language in unverified answers (English)', () => {
    const meta = baseMeta({ answer_type: 'unverified' })
    const result = detectFalseClaims('This is definitely the correct answer, guaranteed.', meta)
    expect(result.hasCertaintyLanguage).toBe(true)
    expect(result.matchedPatterns.length).toBeGreaterThan(0)
  })

  it('flags certainty language in unverified answers (Chinese)', () => {
    const meta = baseMeta({ answer_type: 'unverified' })
    const result = detectFalseClaims('我们绝对保证这个答案是正确的', meta)
    expect(result.hasCertaintyLanguage).toBe(true)
  })

  it('flags certainty language in unverified answers (Japanese)', () => {
    const meta = baseMeta({ answer_type: 'unverified' })
    const result = detectFalseClaims('この回答は絶対に正しいです', meta)
    expect(result.hasCertaintyLanguage).toBe(true)
  })

  it('does not flag normal language in unverified answers', () => {
    const meta = baseMeta({ answer_type: 'unverified' })
    const result = detectFalseClaims('Based on available information, here is what we found.', meta)
    expect(result.hasCertaintyLanguage).toBe(false)
  })

  it('flags certainty in inference_only answers', () => {
    const meta = baseMeta({ answer_type: 'inference_only' })
    const result = detectFalseClaims('We can confirm this is 100% accurate.', meta)
    expect(result.hasCertaintyLanguage).toBe(true)
    expect(result.matchedPatterns).toEqual(expect.arrayContaining([expect.stringMatching(/100%|confirm/i)]))
  })
})
