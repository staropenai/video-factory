/**
 * Built-in rules — generic safety gates only.
 *
 * Housing-specific rules (initial_cost_breakdown, missing_input_clarification)
 * have been removed. 4 generic safety gates remain:
 *
 * 1. low_confidence_gate — low retrieval quality → clarify/handoff
 * 2. high_risk_gate — liability-sensitive patterns → handoff + escalate
 * 3. official_only_gate — government/official domain → official_only mode
 * 4. escalation_gate — task state flagged → handoff + escalate
 */

import type { Rule } from '@/lib/router/types'

/**
 * Low-confidence gate — RELAXED per phase-1 rule:
 *   "Do NOT ask before answering unless critical info blocks a safe answer
 *    OR legal/financial correctness depends on it OR retrieval is too weak
 *    for a safe best-effort answer."
 *
 * Behaviour:
 *   - "weak" retrieval (no hits AND no decent top score) AND clarificationRounds < 2
 *     → answerMode=clarify (the AI render layer is told to give a best-effort
 *       answer + assumptions + 1–2 follow-ups even in clarify mode)
 *   - clarificationRounds >= 2 → handoff (we asked twice already; bring a human in)
 *   - any case where retrieval has at least one usable match (topScore >= 0.5)
 *     → emit a `medium` confidence trace tag but DO NOT change the answer mode.
 *       Render layer is responsible for surfacing assumptions on weak grounding.
 *   - data-quality issues (conflict / stale / unverified dynamic) still bump to
 *     low-confidence, but no longer force clarify by themselves.
 */
export const lowConfidenceGateRule: Rule = {
  key: 'low_confidence_gate',
  version: 3,
  priority: 30,
  match: (ctx) => {
    const r = ctx.retrieval
    if (ctx.clarificationRounds >= 2) return true
    const noUsableHit = r.faqSlugs.length === 0 || r.topScore < 0.5
    const dataQualityIssue =
      r.hasConflict || r.hasStaleSource || r.hasDynamicDependencyWithoutVerification
    return noUsableHit || dataQualityIssue
  },
  execute: (ctx) => {
    const r = ctx.retrieval
    const noUsableHit = r.faqSlugs.length === 0 || r.topScore < 0.5
    if (ctx.clarificationRounds >= 2) {
      return {
        matched: true,
        ruleKey: 'low_confidence_gate',
        traceTag: 'gate:low_confidence_handoff',
        confidenceOverride: 'low',
        answerModeOverride: 'handoff',
        shouldEscalate: true,
        reason: 'Two clarification rounds already happened — escalating.',
      }
    }
    if (noUsableHit) {
      return {
        matched: true,
        ruleKey: 'low_confidence_gate',
        traceTag: 'gate:low_confidence_weak_retrieval',
        confidenceOverride: 'low',
        answerModeOverride: 'clarify',
        reason: 'Retrieval too weak for a safe best-effort answer.',
      }
    }
    // Data-quality issue but at least one usable hit — keep direct_answer,
    // surface low-confidence trace so the render layer adds caveats.
    return {
      matched: true,
      ruleKey: 'low_confidence_gate',
      traceTag: 'gate:low_confidence_caveat',
      confidenceOverride: 'medium',
      reason: 'Retrieval acceptable but data-quality flag present.',
    }
  },
}

export const highRiskGateRule: Rule = {
  key: 'high_risk_gate',
  version: 1,
  priority: 40,
  match: (ctx) =>
    /(lawsuit|dispute|legal|discrimination|urgent|emergency|sue|evicted|deported|arrested|harassed|forced to sign|landlord threatening|being evicted|threatened|scared|afraid|agent lied|signed under pressure|visa.*expir|illegal|overstay|fraud|scam|abused|coerced)/i.test(
      ctx.normalizedQuery
    ) ||
    /(诉讼|纠纷|法律|歧视|紧急|紧急情况|起诉|离婚|驱逐|被骗|威胁|家暴|劳动争议|欠薪|被辞退|逼.{0,4}签|被迫签|强迫|害怕|恐吓|房东威胁|中介骗|签证.{0,6}过期|非法|诈骗|走投无路|不知道怎么办|强制退|非法滞留)/.test(
      ctx.normalizedQuery
    ) ||
    /(訴訟|紛争|法律|差別|緊急|離婚|強制退去|解雇|脅迫|労働問題|未払い|家庭内暴力|詐欺|無理やり|急かされ|今日中.{0,6}契約|今日中.{0,6}サイン|今日中.{0,6}払|契約しろ|サインしろ|サインを強要|怖い|怯え|大家.{0,4}脅|嘘をつか|ビザ.{0,6}切れ|不法滞在|オーバーステイ|どうしたらいいか分から)/.test(
      ctx.normalizedQuery
    ),
  execute: () => ({
    matched: true,
    ruleKey: 'high_risk_gate',
    traceTag: 'gate:high_risk',
    riskLevelOverride: 'high',
    answerModeOverride: 'handoff',
    shouldEscalate: true,
    reason: 'High-risk or liability-sensitive intent detected.',
  }),
}

export const officialOnlyGateRule: Rule = {
  key: 'official_only_gate',
  version: 2,
  priority: 50,
  // Narrow: visa / immigration / tax / pension / formal government benefits /
  // legal disputes / regulatory. Ordinary living / housing / utility
  // troubleshooting must NOT match this.
  match: (ctx) => {
    const q = ctx.queryText
    return (
      /(visa|immigration|residence card|zairyu|permanent residen|naturalization|pension|nenkin|tax return|income tax|resident tax|juminzei|my ?number|government benefit|welfare|legal dispute|lawsuit|court|deport|overstay|regulatory|compliance|official)/i.test(
        ctx.normalizedQuery
      ) ||
      /(签证|在留|在留卡|永住|永久居留|入管|入国管理|移民|归化|税金|所得税|住民税|年金|养老金|个人编号|政府补助|低保|起诉|诉讼|法院|驱逐|非法滞留)/.test(q) ||
      /(ビザ|在留|在留カード|永住|帰化|入管|入国管理|移民|税金|所得税|住民税|年金|マイナンバー|生活保護|訴訟|裁判|強制退去|不法滞在|オーバーステイ)/.test(q)
    )
  },
  execute: () => ({
    matched: true,
    ruleKey: 'official_only_gate',
    traceTag: 'gate:official_only',
    answerModeOverride: 'official_only',
    reason: 'Official-source-only domain detected.',
  }),
}

export const escalationGateRule: Rule = {
  key: 'escalation_gate',
  version: 1,
  priority: 60,
  match: (ctx) => ctx.taskState.requiresHuman === true,
  execute: () => ({
    matched: true,
    ruleKey: 'escalation_gate',
    traceTag: 'gate:escalation',
    answerModeOverride: 'handoff',
    shouldEscalate: true,
    reason: 'Task state already requires human fulfillment.',
  }),
}

export const BUILTIN_RULES: Rule[] = [
  lowConfidenceGateRule,
  highRiskGateRule,
  officialOnlyGateRule,
  escalationGateRule,
].sort((a, b) => a.priority - b.priority)
