/**
 * Deterministic fallback classifier — used when OpenAI is unavailable.
 *
 * From openai_router_production_design.md §10 + §19. This is a *minimum*
 * safety net so the router still responds even when OPENAI_API_KEY is missing,
 * the Responses API is down, or JSON parsing fails after one retry.
 *
 * It is intentionally conservative:
 *   - language detection: Hiragana/katakana → ja; CJK ideographs → zh; else en
 *   - category: keyword sniffing
 *   - shouldOfficialOnly: visa / immigration / tax / pension / legal keywords
 *   - shouldHandoff: explicit pressure / eviction / overstay / threat keywords
 *
 * It does NOT do retrieval rewriting beyond echoing the original query.
 */

import type { AIUnderstandingResult, AICategory, Language } from '@/lib/ai/types'

function detectLanguage(text: string): Language {
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja'
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh'
  return 'en'
}

function detectCategory(q: string, raw: string): AICategory {
  if (
    /(visa|immigration|residence card|zairyu|permanent|naturali[sz]ation)/i.test(q) ||
    /(签证|在留|永住|入管|归化|移民)/.test(raw) ||
    /(ビザ|在留|永住|入管|帰化)/.test(raw)
  )
    return 'visa'
  if (
    /(tax|income tax|resident tax|juminzei|nenkin|pension|my ?number)/i.test(q) ||
    /(税金|所得税|住民税|年金|个人编号)/.test(raw) ||
    /(税金|所得税|住民税|年金|マイナンバー)/.test(raw)
  )
    return 'tax'
  if (
    /(lawsuit|court|sued|lawyer|legal dispute|harassed|threatened)/i.test(q) ||
    /(诉讼|法院|起诉|律师|法律纠纷|威胁)/.test(raw) ||
    /(訴訟|裁判|弁護士|法律相談|脅迫)/.test(raw)
  )
    return 'legal'
  if (
    /(contract|sign|broker|deposit|key money|guarantor)/i.test(q) ||
    /(合同|签约|押金|礼金|保证人)/.test(raw) ||
    /(契約|サイン|敷金|礼金|保証人)/.test(raw)
  )
    return 'contract'
  if (
    /(rent|apartment|landlord|lease|move in|move out|部屋|アパート)/i.test(q) ||
    /(租房|借房|房东|搬家)/.test(raw) ||
    /(部屋|アパート|大家|引っ越し)/.test(raw)
  )
    return 'renting'
  if (
    /(buy.*(home|house|apartment)|mortgage|loan)/i.test(q) ||
    /(买房|购房|房贷)/.test(raw) ||
    /(住宅購入|住宅ローン)/.test(raw)
  )
    return 'home_buying'
  if (
    /(electric|electricity|power|water|gas|garbage|trash|wifi|internet|hospital|school)/i.test(q) ||
    /(电|停电|水|煤气|垃圾|网|医院|学校)/.test(raw) ||
    /(電気|停電|水道|ガス|ゴミ|ごみ|ネット|病院|学校)/.test(raw)
  )
    return 'daily_life'
  if (/(bill|invoice|fee|charge|payment due)/i.test(q) || /(账单|缴费)/.test(raw) || /(請求書|料金)/.test(raw))
    return 'billing'
  return 'other'
}

export function classifyFallback(queryText: string): AIUnderstandingResult {
  const q = queryText.toLowerCase()
  const language = detectLanguage(queryText)
  const category = detectCategory(q, queryText)

  const isOfficial = category === 'visa' || category === 'tax' || category === 'legal'

  const isHandoff =
    /(eviction|evicted|forced to sign|sign today|pressured|deported|overstay|threatened|harassed|abuse)/i.test(q) ||
    /(被逼签|今天就签|驱逐|被骗|威胁|签证.{0,6}过期|非法滞留|强迫)/.test(queryText) ||
    /(急かされ|今日中.{0,6}契約|契約しろ|サインしろ|強制退去|不法滞在|オーバーステイ|脅迫)/.test(queryText)

  return {
    language,
    intent: 'unknown (fallback parse)',
    category,
    subtopic: null,
    riskLevel: isHandoff ? 'high' : isOfficial ? 'medium' : 'low',
    missingInfo: [],
    searchQueries: [queryText],
    shouldOfficialOnly: isOfficial,
    shouldHandoff: isHandoff,
    confidence: 0.2,
    entities: {
      location: null,
      documentType: null,
      deadline: null,
    },
  }
}
