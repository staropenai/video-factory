/**
 * Escalation Configuration (TASK 7)
 *
 * Extracts high-risk topic patterns from hardcoded builtins.ts into
 * a configurable structure. The rule in builtins.ts now delegates
 * pattern matching to this config.
 *
 * Adding a new high-risk pattern:
 *   1. Add an entry to HIGH_RISK_PATTERNS below
 *   2. Run tests: npm test -- --grep "escalation"
 *   3. No code changes needed in builtins.ts
 */

export interface EscalationPattern {
  /** Stable identifier for audit trails */
  id: string
  /** Human-readable description */
  description: string
  /** Language this pattern covers */
  language: 'en' | 'zh' | 'ja' | 'all'
  /** Regex pattern to match against normalizedQuery */
  pattern: RegExp
  /** Risk level when this pattern fires */
  risk_level: 'high' | 'medium'
}

/**
 * All high-risk patterns, extracted from builtins.ts high_risk_gate.
 * Each pattern is individually identifiable for audit and false-positive tracking.
 */
export const HIGH_RISK_PATTERNS: EscalationPattern[] = [
  // ── English ──────────────────────────────────────────────────────────
  {
    id: 'en_legal_dispute',
    description: 'Legal disputes, lawsuits, discrimination',
    language: 'en',
    pattern: /\b(lawsuit|dispute|legal|discrimination|sue)\b/i,
    risk_level: 'high',
  },
  {
    id: 'en_emergency',
    description: 'Urgent/emergency situations',
    language: 'en',
    pattern: /\b(urgent|emergency)\b/i,
    risk_level: 'high',
  },
  {
    id: 'en_eviction_threat',
    description: 'Eviction, deportation, arrest, harassment',
    language: 'en',
    pattern: /\b(evicted|deported|arrested|harassed|being evicted|threatened|scared|afraid)\b/i,
    risk_level: 'high',
  },
  {
    id: 'en_coercion',
    description: 'Forced signing, landlord threatening, agent deception',
    language: 'en',
    pattern: /\b(forced to sign|landlord threatening|agent lied|signed under pressure)\b/i,
    risk_level: 'high',
  },
  {
    id: 'en_visa_immigration',
    description: 'Visa expiry, illegal status, overstay',
    language: 'en',
    pattern: /(visa.*expir|illegal|overstay|fraud|scam|abused|coerced)/i,
    risk_level: 'high',
  },

  // ── Chinese ──────────────────────────────────────────────────────────
  {
    id: 'zh_legal',
    description: 'Chinese legal/dispute terms',
    language: 'zh',
    pattern: /(诉讼|纠纷|法律|歧视|紧急|紧急情况|起诉|离婚|驱逐|被骗|威胁|家暴|劳动争议|欠薪|被辞退)/,
    risk_level: 'high',
  },
  {
    id: 'zh_coercion',
    description: 'Chinese coercion/pressure terms',
    language: 'zh',
    pattern: /(逼.{0,4}签|被迫签|强迫|害怕|恐吓|房东威胁|中介骗)/,
    risk_level: 'high',
  },
  {
    id: 'zh_immigration',
    description: 'Chinese visa/immigration risk terms',
    language: 'zh',
    pattern: /(签证.{0,6}过期|非法|诈骗|走投无路|不知道怎么办|强制退|非法滞留)/,
    risk_level: 'high',
  },

  // ── Japanese ─────────────────────────────────────────────────────────
  {
    id: 'ja_legal',
    description: 'Japanese legal/dispute terms',
    language: 'ja',
    pattern: /(訴訟|紛争|法律|差別|緊急|離婚|強制退去|解雇|脅迫|労働問題|未払い|家庭内暴力|詐欺)/,
    risk_level: 'high',
  },
  {
    id: 'ja_coercion',
    description: 'Japanese coercion/pressure terms',
    language: 'ja',
    pattern: /(無理やり|急かされ|今日中.{0,6}契約|今日中.{0,6}サイン|今日中.{0,6}払|契約しろ|サインしろ|サインを強要)/,
    risk_level: 'high',
  },
  {
    id: 'ja_fear_threat',
    description: 'Japanese fear/threat terms',
    language: 'ja',
    pattern: /(怖い|怯え|大家.{0,4}脅|嘘をつか)/,
    risk_level: 'high',
  },
  {
    id: 'ja_immigration',
    description: 'Japanese visa/immigration risk terms',
    language: 'ja',
    pattern: /(ビザ.{0,6}切れ|不法滞在|オーバーステイ|どうしたらいいか分から)/,
    risk_level: 'high',
  },
]

/**
 * Check if a query matches any high-risk escalation pattern.
 * Returns all matched pattern IDs for audit logging.
 */
export function matchEscalationPatterns(
  normalizedQuery: string,
): { matched: boolean; patternIds: string[]; riskLevel: 'high' | 'medium' | null } {
  const hits: string[] = []
  let maxRisk: 'high' | 'medium' | null = null

  for (const p of HIGH_RISK_PATTERNS) {
    if (p.pattern.test(normalizedQuery)) {
      hits.push(p.id)
      if (maxRisk === null || p.risk_level === 'high') {
        maxRisk = p.risk_level
      }
    }
  }

  return { matched: hits.length > 0, patternIds: hits, riskLevel: maxRisk }
}
