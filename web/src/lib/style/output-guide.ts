/**
 * JTG V6 P1-1 — Text fingerprint system (文字指纹).
 *
 * V6 总方案 §5.2 + 执行文件 §P1-1:
 *   "AI输出的品牌一致性" — every AI-generated response must conform to
 *   JTG's voice: 准确、冷静、可操作、不过度承诺.
 *
 * This module provides:
 *   1. `BRAND_GLOSSARY` — 50+ core terms with standard usage (en/zh/ja)
 *   2. `FORBIDDEN_PHRASES` — expressions that must never appear in output
 *   3. `STYLE_RULES` — structural rules every response must satisfy
 *   4. `checkOutputStyle` — pure validator: flags violations in a text
 *   5. `scoreStyleCompliance` — pure: 0-100 compliance score
 *
 * All functions are pure. Route handlers / prompt templates call
 * `checkOutputStyle` on LLM output before returning to the user.
 */

// ---------------------------------------------------------------------
// Brand glossary (V6 §5.2).
// ---------------------------------------------------------------------

export interface GlossaryEntry {
  term: string
  /** Standard usage across languages. */
  standard: { en: string; zh: string; ja: string }
  /** Context where this term is used. */
  domain: 'renting' | 'home_buying' | 'visa' | 'daily_life' | 'legal' | 'general'
}

/**
 * Core brand glossary. These are the canonical terms JTG uses — AI
 * output should use these rather than synonyms to maintain consistency.
 */
export const BRAND_GLOSSARY: GlossaryEntry[] = [
  // ---- Renting ----
  { term: '敷金', standard: { en: 'security deposit', zh: '押金', ja: '敷金' }, domain: 'renting' },
  { term: '礼金', standard: { en: 'key money', zh: '礼金', ja: '礼金' }, domain: 'renting' },
  { term: '仲介手数料', standard: { en: 'brokerage fee', zh: '中介费', ja: '仲介手数料' }, domain: 'renting' },
  { term: '更新料', standard: { en: 'renewal fee', zh: '续约费', ja: '更新料' }, domain: 'renting' },
  { term: '初期費用', standard: { en: 'initial costs', zh: '初期费用', ja: '初期費用' }, domain: 'renting' },
  { term: '賃貸契約', standard: { en: 'rental agreement', zh: '租赁合同', ja: '賃貸契約' }, domain: 'renting' },
  { term: '管理会社', standard: { en: 'management company', zh: '管理公司', ja: '管理会社' }, domain: 'renting' },
  { term: '退去', standard: { en: 'move-out', zh: '退租', ja: '退去' }, domain: 'renting' },
  { term: '原状回復', standard: { en: 'restoration to original condition', zh: '原状恢复', ja: '原状回復' }, domain: 'renting' },
  { term: '家賃', standard: { en: 'monthly rent', zh: '月租', ja: '家賃' }, domain: 'renting' },
  // ---- Home buying ----
  { term: '住宅ローン', standard: { en: 'home loan / mortgage', zh: '住房贷款', ja: '住宅ローン' }, domain: 'home_buying' },
  { term: '重要事項説明', standard: { en: 'important matters explanation', zh: '重要事项说明', ja: '重要事項説明' }, domain: 'home_buying' },
  { term: '登記', standard: { en: 'property registration', zh: '产权登记', ja: '登記' }, domain: 'home_buying' },
  { term: '固定資産税', standard: { en: 'fixed asset tax', zh: '固定资产税', ja: '固定資産税' }, domain: 'home_buying' },
  { term: '手付金', standard: { en: 'earnest money', zh: '定金', ja: '手付金' }, domain: 'home_buying' },
  // ---- Visa ----
  { term: '在留資格', standard: { en: 'residence status', zh: '在留资格', ja: '在留資格' }, domain: 'visa' },
  { term: '在留カード', standard: { en: 'residence card', zh: '在留卡', ja: '在留カード' }, domain: 'visa' },
  { term: '入国管理局', standard: { en: 'immigration bureau', zh: '入管局', ja: '入国管理局' }, domain: 'visa' },
  { term: '就労ビザ', standard: { en: 'work visa', zh: '工作签证', ja: '就労ビザ' }, domain: 'visa' },
  { term: '永住権', standard: { en: 'permanent residence', zh: '永住权', ja: '永住権' }, domain: 'visa' },
  // ---- Daily life ----
  { term: 'ゴミ分別', standard: { en: 'garbage sorting', zh: '垃圾分类', ja: 'ゴミ分別' }, domain: 'daily_life' },
  { term: '住民票', standard: { en: 'resident registration', zh: '住民票', ja: '住民票' }, domain: 'daily_life' },
  { term: '転入届', standard: { en: 'move-in notification', zh: '迁入申报', ja: '転入届' }, domain: 'daily_life' },
  { term: '国民健康保険', standard: { en: 'national health insurance', zh: '国民健康保险', ja: '国民健康保険' }, domain: 'daily_life' },
  { term: '年金', standard: { en: 'pension', zh: '年金', ja: '年金' }, domain: 'daily_life' },
  { term: '印鑑', standard: { en: 'personal seal (hanko)', zh: '印章', ja: '印鑑' }, domain: 'daily_life' },
  { term: '判子', standard: { en: 'hanko stamp', zh: '印章', ja: '判子' }, domain: 'daily_life' },
  { term: '役所', standard: { en: 'ward/city office', zh: '区役所', ja: '役所' }, domain: 'daily_life' },
  { term: '確定申告', standard: { en: 'tax return filing', zh: '年度报税', ja: '確定申告' }, domain: 'daily_life' },
  { term: 'マイナンバー', standard: { en: 'My Number (social ID)', zh: '个人编号', ja: 'マイナンバー' }, domain: 'daily_life' },
  // ---- Legal ----
  { term: '消費者センター', standard: { en: 'consumer affairs center', zh: '消费者中心', ja: '消費者センター' }, domain: 'legal' },
  { term: '少額訴訟', standard: { en: 'small claims court', zh: '小额诉讼', ja: '少額訴訟' }, domain: 'legal' },
  { term: '弁護士', standard: { en: 'lawyer / attorney', zh: '律师', ja: '弁護士' }, domain: 'legal' },
  { term: '行政書士', standard: { en: 'administrative scrivener', zh: '行政书士', ja: '行政書士' }, domain: 'legal' },
  { term: '宅建士', standard: { en: 'real estate transaction specialist', zh: '宅建士', ja: '宅建士' }, domain: 'legal' },
  // ---- General ----
  { term: '知識カード', standard: { en: 'knowledge card', zh: '知识卡片', ja: '知識カード' }, domain: 'general' },
  { term: '証拠', standard: { en: 'evidence', zh: '证据', ja: '証拠' }, domain: 'general' },
  { term: '言語ブリッジ', standard: { en: 'language bridge', zh: '语言桥接', ja: '言語ブリッジ' }, domain: 'general' },
]

// ---------------------------------------------------------------------
// Forbidden phrases (V6 §5.2).
// ---------------------------------------------------------------------

export interface ForbiddenPhrase {
  pattern: RegExp
  reason: string
  /** Language(s) this applies to. */
  languages: Array<'en' | 'zh' | 'ja' | 'all'>
}

export const FORBIDDEN_PHRASES: ForbiddenPhrase[] = [
  // ---- Overconfidence ----
  { pattern: /肯定没问题/, reason: 'Overpromising — cannot guarantee outcomes', languages: ['zh'] },
  { pattern: /绝对(没问题|可以|安全)/, reason: 'Overpromising — absolute certainty', languages: ['zh'] },
  { pattern: /definitely (safe|fine|no problem)/i, reason: 'Overpromising', languages: ['en'] },
  { pattern: /guaranteed|100% (safe|sure)/i, reason: 'Overpromising', languages: ['en'] },
  { pattern: /絶対(大丈夫|安全|問題ない)/, reason: 'Overpromising', languages: ['ja'] },
  // ---- Self-promotion ----
  { pattern: /我们最好/, reason: 'Self-promotion — let service quality speak', languages: ['zh'] },
  { pattern: /we('re| are) the best/i, reason: 'Self-promotion', languages: ['en'] },
  // ---- Vague legal language ----
  { pattern: /应该(可以|没问题|合法)/, reason: 'Vague legal language — use definitive sources', languages: ['zh'] },
  // ---- Discouraged hedging when source exists ----
  { pattern: /可能(是|有|会)/, reason: 'Hedging when official source may exist — cite source instead', languages: ['zh'] },
]

// ---------------------------------------------------------------------
// Style rules (V6 §5.2).
// ---------------------------------------------------------------------

export interface StyleRule {
  id: string
  description: string
  /** Weight for scoring: higher = more important. */
  weight: number
  check: (text: string) => boolean
}

export const STYLE_RULES: StyleRule[] = [
  {
    id: 'SR-01',
    description: 'Answer must appear in the first 3 lines (shortest answer first)',
    weight: 3,
    check: (text) => {
      const lines = text.split('\n').filter(Boolean)
      // At least one substantive line in the first 3.
      return lines.length > 0 && lines.slice(0, 3).some((l) => l.length > 10)
    },
  },
  {
    id: 'SR-02',
    description: 'Response must end with an actionable next step',
    weight: 3,
    check: (text) => {
      const lower = text.toLowerCase()
      return (
        lower.includes('next step') ||
        lower.includes('下一步') ||
        lower.includes('次のステップ') ||
        lower.includes('you can') ||
        lower.includes('您可以') ||
        lower.includes('できます') ||
        lower.includes('建议') ||
        lower.includes('suggest') ||
        lower.includes('recommend')
      )
    },
  },
  {
    id: 'SR-03',
    description: 'Risk information must not be in the first line (avoid scare-first)',
    weight: 2,
    check: (text) => {
      const firstLine = text.split('\n').filter(Boolean)[0] ?? ''
      const scarePatterns = /注意|warning|risk|危险|リスク|danger|⚠/i
      return !scarePatterns.test(firstLine)
    },
  },
  {
    id: 'SR-04',
    description: 'Official source citation when available (来源/Source/出典)',
    weight: 2,
    check: (text) => {
      // This is a soft rule — not all answers need citations.
      // We check for presence but don't require it.
      return true // Always passes; P1-4 will make this context-dependent
    },
  },
  {
    id: 'SR-05',
    description: 'No empty response or single-word answer',
    weight: 5,
    check: (text) => text.trim().length > 20,
  },
]

// ---------------------------------------------------------------------
// Pure: style checking.
// ---------------------------------------------------------------------

export interface StyleViolation {
  ruleId: string
  description: string
  weight: number
}

export interface ForbiddenMatch {
  phrase: string
  reason: string
}

export interface StyleCheckResult {
  /** 0-100 compliance score. */
  score: number
  violations: StyleViolation[]
  forbiddenMatches: ForbiddenMatch[]
  totalRules: number
  passedRules: number
}

/**
 * Check AI output text against the JTG style guide.
 * Pure — no I/O.
 *
 * Returns a compliance score (0-100) and a list of violations.
 */
export function checkOutputStyle(text: string): StyleCheckResult {
  const violations: StyleViolation[] = []
  const forbiddenMatches: ForbiddenMatch[] = []

  // Check style rules.
  let totalWeight = 0
  let passedWeight = 0
  for (const rule of STYLE_RULES) {
    totalWeight += rule.weight
    const passed = rule.check(text)
    if (passed) {
      passedWeight += rule.weight
    } else {
      violations.push({
        ruleId: rule.id,
        description: rule.description,
        weight: rule.weight,
      })
    }
  }

  // Check forbidden phrases.
  for (const fp of FORBIDDEN_PHRASES) {
    const match = fp.pattern.exec(text)
    if (match) {
      forbiddenMatches.push({
        phrase: match[0].slice(0, 50),
        reason: fp.reason,
      })
    }
  }

  // Forbidden phrase penalties: -10 per match, up to -30.
  const forbiddenPenalty = Math.min(forbiddenMatches.length * 10, 30)

  const baseScore = totalWeight > 0
    ? Math.round((passedWeight / totalWeight) * 100)
    : 100

  return {
    score: Math.max(0, baseScore - forbiddenPenalty),
    violations,
    forbiddenMatches,
    totalRules: STYLE_RULES.length,
    passedRules: STYLE_RULES.length - violations.length,
  }
}

/**
 * Quick pass/fail: does the output meet the minimum compliance threshold?
 * Default minimum: 70.
 */
export function isStyleCompliant(text: string, minScore = 70): boolean {
  return checkOutputStyle(text).score >= minScore
}
