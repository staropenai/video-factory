/**
 * Versioned Rule Definitions (TASK 11)
 *
 * Declarative rule definitions that can be:
 *   - Versioned independently of the engine code
 *   - Audited for changes over time
 *   - Extended without modifying engine.ts or builtins.ts
 *
 * Each rule definition is a data object (not executable code).
 * The engine compiles these into executable Rule objects.
 *
 * Schema version must be bumped when the definition format changes.
 */

export const RULE_SCHEMA_VERSION = '1.0.0'

export type MatcherType =
  | 'pattern'           // Regex pattern match on normalizedQuery
  | 'threshold'         // Numeric threshold check
  | 'state_flag'        // Boolean check on task state
  | 'composite'         // Multiple conditions (AND logic)

export interface PatternMatcher {
  type: 'pattern'
  field: 'normalizedQuery' | 'queryText'
  patterns: Array<{
    id: string
    regex: string
    flags?: string
    language: string
    description: string
  }>
  /** How many patterns must match: 'any' (OR) or 'all' (AND) */
  logic: 'any' | 'all'
}

export interface ThresholdMatcher {
  type: 'threshold'
  field: string
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq'
  value: number
}

export interface StateFlagMatcher {
  type: 'state_flag'
  field: string
  value: boolean
}

export interface CompositeMatcher {
  type: 'composite'
  logic: 'any' | 'all'
  matchers: Array<PatternMatcher | ThresholdMatcher | StateFlagMatcher>
}

export type RuleMatcher = PatternMatcher | ThresholdMatcher | StateFlagMatcher | CompositeMatcher

export interface RuleDefinition {
  /** Unique rule key (stable across versions) */
  key: string
  /** Human-readable description */
  description: string
  /** Semantic version of this rule definition */
  version: string
  /** Execution priority (lower runs first) */
  priority: number
  /** Whether this is a safety-critical rule (cannot be disabled) */
  isSafetyCritical: boolean
  /** When this rule was last updated */
  lastUpdated: string
  /** Who approved this rule version */
  approvedBy: string
  /** Match condition */
  matcher: RuleMatcher
  /** Action to take when matched */
  action: {
    answerModeOverride?: 'direct_answer' | 'clarify' | 'official_only' | 'handoff'
    riskLevelOverride?: 'low' | 'medium' | 'high'
    confidenceOverride?: 'low' | 'medium' | 'high'
    shouldEscalate?: boolean
    traceTag: string
    reason: string
  }
}

// ─── Built-in Rule Definitions ───────────────────────────────────────────────

export const RULE_DEFINITIONS: RuleDefinition[] = [
  {
    key: 'low_confidence_gate',
    description: 'Detect weak retrieval quality and trigger clarification or handoff',
    version: '3.0.0',
    priority: 30,
    isSafetyCritical: false,
    lastUpdated: '2026-04-15',
    approvedBy: 'system',
    matcher: {
      type: 'composite',
      logic: 'any',
      matchers: [
        { type: 'threshold', field: 'retrieval.topScore', operator: 'lt', value: 0.5 },
        { type: 'state_flag', field: 'retrieval.hasConflict', value: true },
        { type: 'state_flag', field: 'retrieval.hasStaleSource', value: true },
        { type: 'state_flag', field: 'retrieval.hasDynamicDependencyWithoutVerification', value: true },
      ],
    },
    action: {
      confidenceOverride: 'low',
      answerModeOverride: 'clarify',
      traceTag: 'gate:low_confidence',
      reason: 'Retrieval quality below threshold or data quality issue detected.',
    },
  },
  {
    key: 'high_risk_gate',
    description: 'Detect liability-sensitive patterns and force escalation',
    version: '1.0.0',
    priority: 40,
    isSafetyCritical: true,
    lastUpdated: '2026-04-15',
    approvedBy: 'system',
    matcher: {
      type: 'pattern',
      field: 'normalizedQuery',
      logic: 'any',
      patterns: [
        { id: 'en_legal', regex: '\\b(lawsuit|dispute|legal|discrimination|sue)\\b', flags: 'i', language: 'en', description: 'Legal disputes' },
        { id: 'en_emergency', regex: '\\b(urgent|emergency)\\b', flags: 'i', language: 'en', description: 'Emergency situations' },
        { id: 'en_threat', regex: '\\b(evicted|deported|arrested|harassed|threatened|scared|afraid)\\b', flags: 'i', language: 'en', description: 'Threats and fear' },
        { id: 'en_coercion', regex: '(forced to sign|landlord threatening|agent lied|signed under pressure)', flags: 'i', language: 'en', description: 'Coercion' },
        { id: 'en_visa', regex: '(visa.*expir|illegal|overstay|fraud|scam|abused|coerced)', flags: 'i', language: 'en', description: 'Visa/immigration risk' },
        { id: 'zh_legal', regex: '(诉讼|纠纷|法律|歧视|紧急|起诉|离婚|驱逐|被骗|威胁|家暴|劳动争议|欠薪|被辞退)', language: 'zh', description: 'Chinese legal terms' },
        { id: 'zh_coercion', regex: '(逼.{0,4}签|被迫签|强迫|害怕|恐吓|房东威胁|中介骗)', language: 'zh', description: 'Chinese coercion terms' },
        { id: 'zh_visa', regex: '(签证.{0,6}过期|非法|诈骗|走投无路|强制退|非法滞留)', language: 'zh', description: 'Chinese visa risk terms' },
        { id: 'ja_legal', regex: '(訴訟|紛争|法律|差別|緊急|離婚|強制退去|解雇|脅迫|労働問題|未払い|家庭内暴力|詐欺)', language: 'ja', description: 'Japanese legal terms' },
        { id: 'ja_coercion', regex: '(無理やり|急かされ|今日中.{0,6}契約|今日中.{0,6}サイン|契約しろ|サインしろ|サインを強要)', language: 'ja', description: 'Japanese coercion terms' },
        { id: 'ja_fear', regex: '(怖い|怯え|大家.{0,4}脅|嘘をつか)', language: 'ja', description: 'Japanese fear/threat terms' },
        { id: 'ja_visa', regex: '(ビザ.{0,6}切れ|不法滞在|オーバーステイ|どうしたらいいか分から)', language: 'ja', description: 'Japanese visa risk terms' },
      ],
    },
    action: {
      riskLevelOverride: 'high',
      answerModeOverride: 'handoff',
      shouldEscalate: true,
      traceTag: 'gate:high_risk',
      reason: 'High-risk or liability-sensitive intent detected.',
    },
  },
  {
    key: 'official_only_gate',
    description: 'Detect government/official domain topics and restrict to official sources',
    version: '2.0.0',
    priority: 50,
    isSafetyCritical: false,
    lastUpdated: '2026-04-15',
    approvedBy: 'system',
    matcher: {
      type: 'pattern',
      field: 'normalizedQuery',
      logic: 'any',
      patterns: [
        { id: 'en_official', regex: '\\b(visa|immigration|residence card|zairyu|permanent residen|naturalization|pension|nenkin|tax return|income tax|resident tax|juminzei|my ?number|government benefit|welfare|legal dispute|lawsuit|court|deport|overstay|regulatory|compliance|official)\\b', flags: 'i', language: 'en', description: 'English official domain terms' },
        { id: 'zh_official', regex: '(签证|在留|在留卡|永住|永久居留|入管|入国管理|移民|归化|税金|所得税|住民税|年金|养老金|个人编号|政府补助|低保|起诉|诉讼|法院|驱逐|非法滞留)', language: 'zh', description: 'Chinese official domain terms' },
        { id: 'ja_official', regex: '(ビザ|在留|在留カード|永住|帰化|入管|入国管理|移民|税金|所得税|住民税|年金|マイナンバー|生活保護|訴訟|裁判|強制退去|不法滞在|オーバーステイ)', language: 'ja', description: 'Japanese official domain terms' },
      ],
    },
    action: {
      answerModeOverride: 'official_only',
      traceTag: 'gate:official_only',
      reason: 'Official-source-only domain detected.',
    },
  },
  {
    key: 'escalation_gate',
    description: 'Escalate when task state already requires human fulfillment',
    version: '1.0.0',
    priority: 60,
    isSafetyCritical: true,
    lastUpdated: '2026-04-15',
    approvedBy: 'system',
    matcher: {
      type: 'state_flag',
      field: 'taskState.requiresHuman',
      value: true,
    },
    action: {
      answerModeOverride: 'handoff',
      shouldEscalate: true,
      traceTag: 'gate:escalation',
      reason: 'Task state already requires human fulfillment.',
    },
  },
]

/**
 * Get all rule definitions sorted by priority.
 */
export function getRuleDefinitions(): RuleDefinition[] {
  return [...RULE_DEFINITIONS].sort((a, b) => a.priority - b.priority)
}

/**
 * Get a specific rule definition by key.
 */
export function getRuleDefinition(key: string): RuleDefinition | undefined {
  return RULE_DEFINITIONS.find((r) => r.key === key)
}
