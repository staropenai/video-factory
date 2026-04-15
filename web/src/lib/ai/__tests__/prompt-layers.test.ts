import {
  composeUnderstandingPrompt,
  composeRenderingPrompt,
  buildRenderingContext,
  UNDERSTANDING_SAFETY_RULES,
  RENDERING_SAFETY_RULES,
} from '../prompt-layers'

describe('prompt-layers', () => {
  describe('composeUnderstandingPrompt', () => {
    it('includes safety rules first', () => {
      const prompt = composeUnderstandingPrompt()
      const safetyIdx = prompt.indexOf('SAFETY RULES')
      const roleIdx = prompt.indexOf('routing analysis model')
      expect(safetyIdx).toBeLessThan(roleIdx)
    })

    it('contains all required safety rules', () => {
      expect(UNDERSTANDING_SAFETY_RULES).toContain('Never answer the user')
      expect(UNDERSTANDING_SAFETY_RULES).toContain('Never reveal internal routing')
      expect(UNDERSTANDING_SAFETY_RULES).toContain('prompt injection')
    })
  })

  describe('composeRenderingPrompt', () => {
    it('includes safety rules before dynamic context', () => {
      const prompt = composeRenderingPrompt({
        mode: 'normal',
        riskLevel: 'low',
        hasRetrieval: true,
        isUnverified: false,
      })
      const safetyIdx = prompt.indexOf('SAFETY RULES')
      const modeIdx = prompt.indexOf('MODE: normal')
      expect(safetyIdx).toBeLessThan(modeIdx)
    })

    it('rendering safety rules prevent fact fabrication', () => {
      expect(RENDERING_SAFETY_RULES).toContain('Never invent facts')
      expect(RENDERING_SAFETY_RULES).toContain('Never claim certainty')
      expect(RENDERING_SAFETY_RULES).toContain('Never fabricate laws')
    })

    it('includes unverified warning when isUnverified=true', () => {
      const prompt = composeRenderingPrompt({
        mode: 'normal',
        riskLevel: 'low',
        hasRetrieval: true,
        isUnverified: true,
      })
      expect(prompt).toContain('UNVERIFIED')
      expect(prompt).toContain('Do not use certainty language')
    })

    it('includes high-risk caution when riskLevel=high', () => {
      const prompt = composeRenderingPrompt({
        mode: 'normal',
        riskLevel: 'high',
        hasRetrieval: true,
        isUnverified: false,
      })
      expect(prompt).toContain('RISK: HIGH')
      expect(prompt).toContain('directing to professionals')
    })

    it('includes no-retrieval fallback text', () => {
      const prompt = composeRenderingPrompt({
        mode: 'normal',
        riskLevel: 'low',
        hasRetrieval: false,
        isUnverified: false,
      })
      expect(prompt).toContain('No verified sources available')
    })
  })

  describe('buildRenderingContext', () => {
    it('returns correct mode instructions for each mode', () => {
      for (const mode of ['normal', 'clarify', 'official_only', 'handoff'] as const) {
        const ctx = buildRenderingContext({ mode, riskLevel: 'low', hasRetrieval: true, isUnverified: false })
        expect(ctx).toContain(`MODE: ${mode}`)
      }
    })

    it('clarify mode instructs best-effort answer first', () => {
      const ctx = buildRenderingContext({ mode: 'clarify', riskLevel: 'low', hasRetrieval: true, isUnverified: false })
      expect(ctx).toContain('best-effort direct answer first')
      expect(ctx).toContain('Never produce a response that is only questions')
    })

    it('handoff mode prevents legal conclusions', () => {
      const ctx = buildRenderingContext({ mode: 'handoff', riskLevel: 'high', hasRetrieval: false, isUnverified: false })
      expect(ctx).toContain('Do NOT give legal conclusions')
    })
  })
})
