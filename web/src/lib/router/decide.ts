/**
 * Router decision maker.
 *
 * Takes query + task state + retrieval → runs rules → produces RouterDecision.
 * This is the TypeScript decision pipeline.
 *
 * Design constraint: Router's job is "make a choice", not "say something pretty".
 * Low-confidence, high-risk, official-only, escalation gates all run before any
 * response generation.
 */

import type {
  AnswerMode,
  ConfidenceBand,
  KnowledgeTrace,
  RiskLevel,
  RetrievalSummary,
  RouterDecision,
  TaskState,
} from '@/lib/router/types'
import { classifyQuery } from '@/lib/router/classify'
import { runRules } from '@/lib/rules/engine'

/**
 * Does the query actually look like a topic where "go to the city office /
 * get it from the official source" is the right answer? Visa, immigration,
 * tax, pension, formal government benefits, legal disputes.
 *
 * This is deliberately narrow. Ordinary living/housing/utility troubleshooting
 * ("no electricity", "水漏れ", "wifi断了") must NOT match this.
 */
function isOfficialTopic(normalized: string, raw: string): boolean {
  const en = /(visa|immigration|residence card|zairyu|permanent residen|naturalization|work permit|pension|nenkin|tax return|income tax|resident tax|juminzei|my ?number|government benefit|social welfare|welfare|legal|lawsuit|legal dispute|court|deport|overstay|regulatory|compliance|official)/i
  const zh = /(签证|在留|在留卡|永住|永久居留|入管|入国管理|移民|归化|税金|所得税|住民税|年金|养老金|个人编号|政府补助|低保|法律|起诉|诉讼|法院|驱逐|非法滞留|监管|合规)/
  const ja = /(ビザ|在留|在留カード|永住|帰化|入管|入国管理|移民|税金|所得税|住民税|年金|マイナンバー|生活保護|政府補助|法律|訴訟|裁判|強制退去|不法滞在|オーバーステイ|規制|コンプライアンス|公式)/
  return en.test(normalized) || zh.test(raw) || ja.test(raw)
}

export function decideRoute(input: {
  queryText: string
  normalizedQuery: string
  taskState: TaskState
  retrieval: RetrievalSummary
  clarificationRounds?: number
}): RouterDecision {
  const queryType = classifyQuery(input.normalizedQuery)
  const clarificationRounds = input.clarificationRounds ?? 0

  let riskLevel: RiskLevel = 'low'
  let confidenceBand: ConfidenceBand = 'high'
  let answerMode: AnswerMode = 'direct_answer'
  let shouldEscalate = false
  const selectedFaqSlugs = input.retrieval.faqSlugs
  const selectedRuleKeys: string[] = []
  const missingInputs: string[] = []
  const traceTags: string[] = []
  const reasons: string[] = []

  const results = runRules({
    queryText: input.queryText,
    normalizedQuery: input.normalizedQuery,
    queryType,
    taskState: input.taskState,
    retrieval: input.retrieval,
    clarificationRounds,
  })

  for (const result of results) {
    selectedRuleKeys.push(result.ruleKey)
    if (result.traceTag) traceTags.push(result.traceTag)
    if (result.reason) reasons.push(result.reason)
    if (result.missingInputs?.length) missingInputs.push(...result.missingInputs)
    if (result.riskLevelOverride) riskLevel = result.riskLevelOverride
    if (result.confidenceOverride) confidenceBand = result.confidenceOverride
    if (result.answerModeOverride) answerMode = result.answerModeOverride
    if (result.shouldEscalate) shouldEscalate = true
  }

  // Out-of-scope handling.
  //
  // Previously this forced official_only for ANY unmatched query, which sent
  // ordinary housing / utility troubleshooting ("没电了怎么办", "wifi断了") into
  // the visa/tax fallback template. Fix: only force official_only when the
  // query actually looks like a government/legal/visa/tax/pension topic.
  // Everything else falls through to whatever the rule engine picked (usually
  // low_confidence_gate → clarify), which asks for more context in-language.
  if (queryType === 'out_of_scope') {
    confidenceBand = 'low'
    traceTags.push('scope:out_of_scope')
    if (answerMode !== 'handoff' && isOfficialTopic(input.normalizedQuery, input.queryText)) {
      answerMode = 'official_only'
      reasons.push('Out-of-scope query looks like an official/regulatory topic.')
    } else if (answerMode !== 'handoff' && answerMode !== 'clarify') {
      // Default unmatched ordinary query → clarify, NOT official_only.
      answerMode = 'clarify'
      reasons.push('No matching knowledge — asking for more context.')
    }
  }

  // Dynamic listing override — not our product foundation
  if (queryType === 'dynamic') {
    answerMode = 'handoff'
    shouldEscalate = true
    confidenceBand = 'low'
    reasons.push('Dynamic listing questions are not answered as a product foundation.')
    traceTags.push('boundary:dynamic_not_foundation')
  }

  // ----------------------------------------------------------------
  // Final safety override: handoff dominates everything else.
  //
  // Rule loop is last-writer-wins by priority order, which means
  // official_only_gate (priority 50) was overwriting high_risk_gate
  // (priority 40)'s `handoff` when both matched (e.g. "visa expires
  // next month + landlord forced to sign"). High-risk MUST win over
  // official-only — coercion + risk to person trumps "go to immigration".
  //
  // Likewise, if any rule set shouldEscalate=true, the answer mode
  // must be handoff regardless of what a later rule said.
  // ----------------------------------------------------------------
  if (shouldEscalate && answerMode !== 'handoff') {
    answerMode = 'handoff'
    traceTags.push('safety:handoff_override_due_to_escalation')
    reasons.push('Escalation flag forced answerMode=handoff (overriding later rule).')
  }

  // Knowledge trace — records whether knowledge participated in this decision
  const knowledgeTrace: KnowledgeTrace = {
    knowledgeFound: input.retrieval.faqSlugs.length > 0,
    faqMatchCount: input.retrieval.faqSlugs.length,
    sourceCount: input.retrieval.sourceCount,
    supportingSourceCount: input.retrieval.supportingSourceCount,
    topScore: input.retrieval.topScore,
    retrievalPath: input.retrieval.faqSlugs.length > 0
      ? (input.retrieval.sourceCount > 0 ? 'local' : 'backend')
      : 'none',
  }

  // Add knowledge trace tag
  if (knowledgeTrace.knowledgeFound) {
    traceTags.push(`knowledge:found:${knowledgeTrace.faqMatchCount}faq:${knowledgeTrace.sourceCount}src`)
  } else {
    traceTags.push('knowledge:none')
  }

  return {
    queryType,
    riskLevel,
    confidenceBand,
    selectedFaqSlugs,
    selectedRuleKeys,
    missingInputs: [...new Set(missingInputs)],
    answerMode,
    shouldEscalate,
    decisionReason: reasons.join(' | ') || 'Default direct answer path.',
    traceTags: [...new Set(traceTags)],
    knowledgeTrace,
  }
}
