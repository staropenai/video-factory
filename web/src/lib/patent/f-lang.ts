/**
 * Patent 方案A 要素2 — Language action capacity index (f_lang).
 *
 * 权利要求2（从属）:
 *   "对用户在T天内的查询历史进行分析，统计语言切换频率、非母语查询比例，
 *    输出[0,1]区间内的语言行动能力指数；
 *    当f_lang低于预定义阈值τ时，自动激活语言桥接处理单元。"
 *
 * f_lang = w1 × L2_query_ratio + w2 × (1 - code_switch_frequency)
 *
 * Interpretation:
 *   f_lang ∈ [0, 1]
 *   f_lang LOW  → weak language ability → activate bridge layer
 *   f_lang HIGH → strong ability → lower bridge priority
 *
 * All exported functions are PURE. Parameters are passed in explicitly
 * so that confidential weights (w1, w2, τ) never appear in this file.
 * The I/O wrapper at the bottom reads from the user_queries table.
 */

import type { UserQueryRow } from '@/lib/db/tables'

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export interface FLangParams {
  /** Weight for L2 (non-target-language) query ratio. [CONFIDENTIAL] */
  w1: number
  /** Weight for code-switch frequency inverse. [CONFIDENTIAL] */
  w2: number
  /** Analysis window in days. */
  windowDays: number
  /** Default f_lang for cold-start users (history < minHistoryCount). [CONFIDENTIAL] */
  coldStartDefault: number
  /** Minimum query count to compute f_lang (below → cold start). */
  minHistoryCount: number
  /** Target language of the environment (queries IN this language = capable). */
  targetLanguage: 'ja' | 'en' | 'zh'
}

export interface FLangResult {
  /** f_lang ∈ [0, 1]. */
  value: number
  /** Whether cold-start default was used. */
  coldStart: boolean
  /** Number of queries in window. */
  queryCount: number
  /** Ratio of queries detected as non-target-language. */
  l2QueryRatio: number
  /** Ratio of queries containing multiple scripts. */
  codeSwitchFrequency: number
}

/** Default params — weights are placeholders; production reads from env/.patent-internal. */
export const DEFAULT_FLANG_PARAMS: FLangParams = {
  w1: parseFloat(process.env.PATENT_FLANG_W1 ?? '0.5'),
  w2: parseFloat(process.env.PATENT_FLANG_W2 ?? '0.5'),
  windowDays: 30,
  coldStartDefault: parseFloat(process.env.PATENT_FLANG_DEFAULT ?? '0.3'),
  minHistoryCount: 3,
  targetLanguage: 'ja',
}

// ---------------------------------------------------------------------
// Pure: script detection (Unicode-based, no external dependencies).
// ---------------------------------------------------------------------

/** Unicode block ranges for script classification. */
const SCRIPT_RANGES = {
  /** CJK Unified Ideographs (shared Chinese/Japanese). */
  cjk: /[\u4E00-\u9FFF]/,
  /** Hiragana. */
  hiragana: /[\u3040-\u309F]/,
  /** Katakana. */
  katakana: /[\u30A0-\u30FF]/,
  /** Latin alphabet. */
  latin: /[A-Za-z]/,
  /** Hangul (Korean). */
  hangul: /[\uAC00-\uD7AF]/,
} as const

/**
 * Detect which scripts are present in a text string.
 * Pure — no I/O.
 */
export function detectScripts(text: string): Set<string> {
  const scripts = new Set<string>()
  for (const [name, re] of Object.entries(SCRIPT_RANGES)) {
    if (re.test(text)) scripts.add(name)
  }
  return scripts
}

/**
 * Check whether a text contains characters from 2+ distinct script families.
 * "Japanese" is hiragana OR katakana OR CJK; "Chinese" is CJK without kana;
 * "English" is latin. We count script families, not individual Unicode blocks.
 *
 * Pure — no I/O.
 */
export function hasMultipleScriptFamilies(text: string): boolean {
  const scripts = detectScripts(text)
  // Group into families.
  const families = new Set<string>()
  if (scripts.has('hiragana') || scripts.has('katakana')) families.add('japanese_kana')
  if (scripts.has('cjk')) families.add('cjk')
  if (scripts.has('latin')) families.add('latin')
  if (scripts.has('hangul')) families.add('hangul')
  return families.size >= 2
}

// ---------------------------------------------------------------------
// Pure: f_lang computation.
// ---------------------------------------------------------------------

/**
 * Compute language action capacity index from query history.
 * Pure — no I/O. Caller provides queries and params.
 *
 * @param queries - user query rows (newest-first expected, but order doesn't matter)
 * @param params  - tuning parameters (weights are CONFIDENTIAL)
 * @param asOf    - reference date for window filtering
 */
export function computeFLang(
  queries: UserQueryRow[],
  params: FLangParams = DEFAULT_FLANG_PARAMS,
  asOf: Date = new Date(),
): FLangResult {
  // Filter to window.
  const windowMs = params.windowDays * 86_400_000
  const cutoff = asOf.getTime() - windowMs
  const inWindow = queries.filter((q) => {
    const ts = Date.parse(q.timestamp)
    return Number.isFinite(ts) && ts >= cutoff && ts <= asOf.getTime()
  })

  // Cold start.
  if (inWindow.length < params.minHistoryCount) {
    return {
      value: params.coldStartDefault,
      coldStart: true,
      queryCount: inWindow.length,
      l2QueryRatio: 0,
      codeSwitchFrequency: 0,
    }
  }

  // L2 query ratio: queries detected as NOT the target language.
  const l2Count = inWindow.filter(
    (q) => q.detectedLanguage !== params.targetLanguage,
  ).length
  const l2QueryRatio = l2Count / inWindow.length

  // Code-switch frequency: queries with 2+ script families.
  const codeSwCount = inWindow.filter((q) =>
    hasMultipleScriptFamilies(q.queryText),
  ).length
  const codeSwitchFrequency = codeSwCount / inWindow.length

  // f_lang = w1 × L2_query_ratio + w2 × (1 - code_switch_frequency)
  const raw = params.w1 * l2QueryRatio + params.w2 * (1 - codeSwitchFrequency)
  const value = Math.max(0, Math.min(1, raw))

  return {
    value,
    coldStart: false,
    queryCount: inWindow.length,
    l2QueryRatio,
    codeSwitchFrequency,
  }
}

/**
 * Should the language bridge layer be activated for this user?
 * Pure — no I/O.
 *
 * @param fLang  - computed f_lang value
 * @param tau    - activation threshold [CONFIDENTIAL]
 */
export function shouldActivateBridge(
  fLang: number,
  tau: number = parseFloat(process.env.PATENT_TAU_BRIDGE ?? '0.45'),
): boolean {
  // f_lang LOW → weak ability → activate bridge.
  return fLang < tau
}

// ---------------------------------------------------------------------
// I/O wrapper.
// ---------------------------------------------------------------------

import { listUserQueries } from '@/lib/db/tables'

/**
 * Compute f_lang for the most recent user activity.
 * I/O — reads from user_queries table.
 */
export function getUserFLang(params?: Partial<FLangParams>): FLangResult {
  const fullParams = { ...DEFAULT_FLANG_PARAMS, ...params }
  const queries = listUserQueries(500)
  return computeFLang(queries, fullParams)
}
