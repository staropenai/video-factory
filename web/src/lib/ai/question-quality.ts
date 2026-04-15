/**
 * Question Quality Scorer — v9 module.
 *
 * Applies the 李笑来 AI提问方法论 to score incoming user queries
 * and suggest improvements. All exports are PURE — no I/O.
 *
 * Five quality elements:
 *   1. Goal clarity     — does the query state what it wants to solve?
 *   2. Context provided  — is background situation mentioned?
 *   3. Constraints given  — time/budget/visa-type/location specifics?
 *   4. Format requested   — does user want steps/list/comparison?
 *   5. Success criteria   — what counts as a "good answer"?
 *
 * Two "bad question" detectors:
 *   A. Not fact-based (subjective/emotional)
 *   B. Unknowable (future prediction, random outcome)
 *
 * Patent relevance: feeds into Patent A evidence (routing efficiency —
 * higher quality questions → better routing → fewer L6 escalations).
 */

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export interface QualityElement {
  element: 'goal' | 'context' | 'constraints' | 'format' | 'criteria'
  present: boolean
  signal: string | null
}

export type BadQuestionType = 'not_fact_based' | 'unknowable' | null

export interface QualityScore {
  /** 0.0 – 1.0, five elements each worth 0.2 */
  score: number
  elements: QualityElement[]
  /** Total elements present (0-5) */
  elementsPresent: number
  /** Detected bad question type, null if OK */
  badType: BadQuestionType
  /** Short recommendation for the user */
  suggestion: string | null
  /** Language of the query */
  lang: 'zh' | 'ja' | 'en'
}

export interface RewriteSuggestion {
  original: string
  rewritten: string
  elementsAdded: string[]
  qualityBefore: number
  qualityAfter: number
}

// ---------------------------------------------------------------------
// Signal patterns.
// ---------------------------------------------------------------------

/** Patterns that indicate a goal is stated. */
const GOAL_SIGNALS: Record<string, RegExp[]> = {
  zh: [/想/, /需要/, /如何/, /怎[么样]/, /可以.{0,4}吗/, /要/, /希望/, /请问/, /解决/, /办理/],
  ja: [/したい/, /方法/, /どう/, /どのように/, /ほしい/, /したら/, /するには/, /教えて/, /手続き/],
  en: [/want to/i, /need to/i, /how (to|do|can)/i, /looking for/i, /trying to/i, /help me/i],
}

/** Patterns that indicate context/background is provided. */
const CONTEXT_SIGNALS: Record<string, RegExp[]> = {
  zh: [/我是/, /目前/, /现在/, /在.{1,6}(住|工作|学)/, /留学/, /工作签/, /已经/, /刚(来|到)/],
  ja: [/私は/, /今/, /現在/, /に住んで/, /留学/, /就労/, /もう/, /来たばかり/],
  en: [/i am/i, /i('m| am)/i, /currently/i, /i live in/i, /i('ve| have) been/i, /student visa/i, /work visa/i],
}

/** Patterns that indicate constraints are given. */
const CONSTRAINT_SIGNALS: Record<string, RegExp[]> = {
  zh: [/\d+[天月年]/, /到期/, /期限/, /预算/, /不超过/, /之[前内]/, /来不及/, /签证.{0,4}(类型|种类)/],
  ja: [/\d+[日ヶ月年]/, /期限/, /まで/, /予算/, /以内/, /間に合/, /ビザの種類/],
  en: [/\d+ (day|month|year|week)/i, /deadline/i, /by (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d)/i, /budget/i, /visa type/i, /before/i],
}

/** Patterns that indicate format is requested. */
const FORMAT_SIGNALS: Record<string, RegExp[]> = {
  zh: [/步骤/, /清单/, /表格/, /列[出举]/, /比较/, /分[几步]/, /流程/, /顺序/, /一步一步/],
  ja: [/ステップ/, /リスト/, /表/, /比較/, /手順/, /一覧/, /順番/],
  en: [/step.?by.?step/i, /list/i, /table/i, /compare/i, /checklist/i, /in order/i, /format/i],
}

/** Patterns that indicate success criteria. */
const CRITERIA_SIGNALS: Record<string, RegExp[]> = {
  zh: [/什么算/, /怎样才算/, /最重要/, /关键/, /优先/, /哪[个些]最/, /判断标准/],
  ja: [/何が重要/, /どれが/, /一番/, /優先/, /基準/, /ポイント/],
  en: [/what counts/i, /most important/i, /priority/i, /criteria/i, /key factor/i, /what matters/i],
}

/** Not-fact-based patterns (subjective/emotional). */
const NOT_FACT_BASED: Record<string, RegExp[]> = {
  zh: [/我(漂亮|帅|好看)吗/, /他.{0,4}爱我/, /我是不是(失败|没用|笨)/, /我值得/, /命运/],
  ja: [/私.{0,4}(かわいい|かっこいい|素敵)/, /愛して(る|いる)/, /私.{0,4}ダメ/, /運命/],
  en: [/am i (pretty|handsome|ugly|stupid|a failure)/i, /does .{1,20} love me/i, /my destiny/i],
}

/** Unknowable patterns (future prediction, random). */
const UNKNOWABLE: Record<string, RegExp[]> = {
  zh: [/(明天|下周).{0,6}(涨|跌)/, /生命.{0,4}意义/, /我.{0,6}(会|能)成功/, /预测.{0,6}未来/, /彩票/],
  ja: [/(明日|来週).{0,6}(上が|下が)/, /人生の意味/, /成功(する|できる)か/, /未来を予測/, /宝くじ/],
  en: [/(tomorrow|next week).{0,15}(go up|rise|fall|crash)/i, /meaning of life/i, /will i succeed/i, /predict the future/i, /lottery/i],
}

// ---------------------------------------------------------------------
// Pure functions.
// ---------------------------------------------------------------------

function detectLang(text: string): 'zh' | 'ja' | 'en' {
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh'
  return 'en'
}

function matchAny(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return m[0]
  }
  return null
}

function checkElement(
  text: string,
  lang: string,
  signals: Record<string, RegExp[]>,
  element: QualityElement['element'],
): QualityElement {
  const patterns = signals[lang] ?? signals['en'] ?? []
  const signal = matchAny(text, patterns)
  return { element, present: signal !== null, signal }
}

/**
 * Score a user query on the five-element quality scale.
 *
 * Returns a QualityScore with element breakdown, bad-question detection,
 * and a localized improvement suggestion.
 */
export function scoreQuestionQuality(query: string): QualityScore {
  const lang = detectLang(query)
  const text = query

  // Check bad question types first
  const notFactBased = matchAny(text, NOT_FACT_BASED[lang] ?? [])
  const unknowable = matchAny(text, UNKNOWABLE[lang] ?? [])

  const badType: BadQuestionType = notFactBased
    ? 'not_fact_based'
    : unknowable
      ? 'unknowable'
      : null

  // Score five elements
  const elements: QualityElement[] = [
    checkElement(text, lang, GOAL_SIGNALS, 'goal'),
    checkElement(text, lang, CONTEXT_SIGNALS, 'context'),
    checkElement(text, lang, CONSTRAINT_SIGNALS, 'constraints'),
    checkElement(text, lang, FORMAT_SIGNALS, 'format'),
    checkElement(text, lang, CRITERIA_SIGNALS, 'criteria'),
  ]

  const elementsPresent = elements.filter((e) => e.present).length
  const score = elementsPresent / 5

  // Generate suggestion
  const suggestion = generateSuggestion(elements, badType, lang)

  return { score, elements, elementsPresent, badType, suggestion, lang }
}

function generateSuggestion(
  elements: QualityElement[],
  badType: BadQuestionType,
  lang: string,
): string | null {
  if (badType === 'not_fact_based') {
    const msgs: Record<string, string> = {
      zh: '这类主观问题没有客观答案。试着改成具体的事实问题。',
      ja: 'この種の主観的な質問には客観的な答えがありません。具体的な事実の質問に変えてみましょう。',
      en: 'Subjective questions have no objective answer. Try rephrasing as a factual question.',
    }
    return msgs[lang] ?? msgs.en
  }

  if (badType === 'unknowable') {
    const msgs: Record<string, string> = {
      zh: '这类问题无法预测。试着改成可以查到答案的具体问题。',
      ja: 'この種の質問は予測不可能です。調べられる具体的な質問に変えましょう。',
      en: 'This is unknowable. Try rephrasing as a question with a researchable answer.',
    }
    return msgs[lang] ?? msgs.en
  }

  const missing = elements.filter((e) => !e.present)
  if (missing.length === 0) return null // Perfect score

  const missingNames = missing.map((e) => e.element)

  const labels: Record<string, Record<string, string>> = {
    zh: { goal: '目标', context: '背景', constraints: '约束条件', format: '输出格式', criteria: '判断标准' },
    ja: { goal: '目標', context: '背景', constraints: '制約条件', format: '出力形式', criteria: '判断基準' },
    en: { goal: 'goal', context: 'context', constraints: 'constraints', format: 'format', criteria: 'criteria' },
  }

  const l = labels[lang] ?? labels.en
  const missingLabels = missingNames.map((n) => l[n] ?? n)

  const templates: Record<string, string> = {
    zh: `补充以下信息可以获得更好的回答：${missingLabels.join('、')}`,
    ja: `以下を補足するとより良い回答が得られます：${missingLabels.join('、')}`,
    en: `Adding ${missingLabels.join(', ')} would improve the answer quality.`,
  }

  return templates[lang] ?? templates.en
}

/**
 * Generate a rewrite suggestion for a low-quality question.
 * Only rewrites if score < 0.6 (missing 3+ elements).
 * Returns null if the question is already good enough.
 */
export function suggestRewrite(
  query: string,
  context?: { category?: string; lang?: string },
): RewriteSuggestion | null {
  const quality = scoreQuestionQuality(query)
  if (quality.score >= 0.6) return null // Good enough
  if (quality.badType) return null // Can't fix bad question types

  const lang = context?.lang ?? quality.lang
  const cat = context?.category ?? ''

  // Build rewritten version by adding missing elements as prompts
  const additions: string[] = []
  const added: string[] = []

  for (const e of quality.elements) {
    if (e.present) continue
    const hint = REWRITE_HINTS[lang]?.[e.element] ?? REWRITE_HINTS.en[e.element]
    if (hint) {
      additions.push(hint(cat))
      added.push(e.element)
    }
  }

  if (additions.length === 0) return null

  const rewritten = `${query}\n${additions.join('\n')}`
  const afterScore = Math.min(1.0, quality.score + added.length * 0.2)

  return {
    original: query,
    rewritten,
    elementsAdded: added,
    qualityBefore: quality.score,
    qualityAfter: afterScore,
  }
}

type HintFn = (category: string) => string

const REWRITE_HINTS: Record<string, Record<string, HintFn>> = {
  zh: {
    goal: () => '（补充：我想解决的问题是___）',
    context: (cat) => `（补充：我目前的情况是___${cat ? `，类别：${cat}` : ''}）`,
    constraints: () => '（补充：时间限制/签证类型/预算是___）',
    format: () => '（补充：请用步骤/清单/表格形式回答）',
    criteria: () => '（补充：我最关心的是___）',
  },
  ja: {
    goal: () => '（補足：解決したい問題は___）',
    context: (cat) => `（補足：現在の状況は___${cat ? `、カテゴリ：${cat}` : ''}）`,
    constraints: () => '（補足：期限/ビザ種類/予算は___）',
    format: () => '（補足：ステップ/リスト/表で回答してください）',
    criteria: () => '（補足：最も重要なのは___）',
  },
  en: {
    goal: () => '(Add: The problem I want to solve is ___)',
    context: (cat) => `(Add: My current situation is ___${cat ? `, category: ${cat}` : ''})`,
    constraints: () => '(Add: My deadline/visa type/budget is ___)',
    format: () => '(Add: Please answer in steps/list/table format)',
    criteria: () => '(Add: What matters most to me is ___)',
  },
}

/**
 * Compute aggregate quality statistics from an array of scores.
 * Useful for patent evidence reports (Patent A — query quality → routing efficiency).
 */
export interface QualityStats {
  totalQueries: number
  meanScore: number
  medianScore: number
  elementsDistribution: Record<string, number>
  badQuestionRate: number
  badTypeBreakdown: { not_fact_based: number; unknowable: number }
  lowQualityRate: number  // score < 0.4
  highQualityRate: number // score >= 0.6
}

export function computeQualityStats(scores: QualityScore[]): QualityStats {
  const n = scores.length
  if (n === 0) {
    return {
      totalQueries: 0,
      meanScore: 0,
      medianScore: 0,
      elementsDistribution: { goal: 0, context: 0, constraints: 0, format: 0, criteria: 0 },
      badQuestionRate: 0,
      badTypeBreakdown: { not_fact_based: 0, unknowable: 0 },
      lowQualityRate: 0,
      highQualityRate: 0,
    }
  }

  const sorted = scores.map((s) => s.score).sort((a, b) => a - b)
  const mean = sorted.reduce((a, b) => a + b, 0) / n
  const median = n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2

  const dist: Record<string, number> = { goal: 0, context: 0, constraints: 0, format: 0, criteria: 0 }
  for (const s of scores) {
    for (const e of s.elements) {
      if (e.present) dist[e.element] = (dist[e.element] ?? 0) + 1
    }
  }
  // Normalize to rates
  for (const k of Object.keys(dist)) dist[k] = dist[k] / n

  const badCount = scores.filter((s) => s.badType !== null).length
  const notFact = scores.filter((s) => s.badType === 'not_fact_based').length
  const unkn = scores.filter((s) => s.badType === 'unknowable').length
  const low = scores.filter((s) => s.score < 0.4).length
  const high = scores.filter((s) => s.score >= 0.6).length

  return {
    totalQueries: n,
    meanScore: Math.round(mean * 1000) / 1000,
    medianScore: Math.round(median * 1000) / 1000,
    elementsDistribution: dist,
    badQuestionRate: Math.round((badCount / n) * 1000) / 1000,
    badTypeBreakdown: { not_fact_based: notFact, unknowable: unkn },
    lowQualityRate: Math.round((low / n) * 1000) / 1000,
    highQualityRate: Math.round((high / n) * 1000) / 1000,
  }
}
