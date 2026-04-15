/**
 * JTG V6 P0-3A — Prompt injection detection filter.
 *
 * V6 spec (执行文件 §P0-3, 总方案 §6.1):
 *   Detect and block prompt injection attacks BEFORE they reach the LLM.
 *   Patterns cover:
 *     - Direct injection: "忽略之前的指令", "ignore previous instructions"
 *     - Role hijacking: "你现在是", "you are now a"
 *     - System prompt extraction: "system prompt", "show me your instructions"
 *     - Multi-language coverage: en/zh/ja
 *
 * Design:
 *   - `INJECTION_PATTERNS` — compiled RegExp array, updated as new attacks emerge
 *   - `checkPromptInjection` — pure function: returns detection result
 *   - `sanitizeInput` — pure function: strips known dangerous constructs
 *
 * The router and bridge endpoints call `checkPromptInjection` at the top
 * of their POST handlers. If injection is detected, the request is
 * rejected with a 400 and a security event is logged.
 */

// ---------------------------------------------------------------------
// Injection patterns (V6 §6.1 + 总方案 §6.2 B1).
// ---------------------------------------------------------------------

export interface InjectionPattern {
  id: string
  pattern: RegExp
  category: 'direct_injection' | 'role_hijack' | 'system_extraction' | 'data_exfil' | 'encoding_bypass'
  severity: 'high' | 'medium'
  description: string
}

export const INJECTION_PATTERNS: InjectionPattern[] = [
  // ---- Direct injection (en) ----
  {
    id: 'INJ-001',
    pattern: /ignore\s+(all\s+)?previous\s+(instructions?|rules?|prompts?)/i,
    category: 'direct_injection',
    severity: 'high',
    description: 'English: ignore previous instructions',
  },
  {
    id: 'INJ-002',
    pattern: /forget\s+(everything|all|your)\s+(instructions?|rules?|training)/i,
    category: 'direct_injection',
    severity: 'high',
    description: 'English: forget your instructions',
  },
  {
    id: 'INJ-003',
    pattern: /disregard\s+(all\s+)?(prior|previous|above|earlier)\s+(instructions?|context)/i,
    category: 'direct_injection',
    severity: 'high',
    description: 'English: disregard prior instructions',
  },
  // ---- Direct injection (zh) ----
  {
    id: 'INJ-004',
    pattern: /忽略(之前|以上|所有|先前)(的)?(指令|规则|设定|提示|限制)/,
    category: 'direct_injection',
    severity: 'high',
    description: 'Chinese: ignore previous instructions',
  },
  {
    id: 'INJ-005',
    pattern: /无视(之前|以上|所有)(的)?(指令|规则|设定|限制)/,
    category: 'direct_injection',
    severity: 'high',
    description: 'Chinese: disregard instructions',
  },
  // ---- Direct injection (ja) ----
  {
    id: 'INJ-006',
    pattern: /(前の|以前の|すべての)(指示|ルール|設定|制限)(を)?(無視|忘れ)/,
    category: 'direct_injection',
    severity: 'high',
    description: 'Japanese: ignore previous instructions',
  },
  // ---- Role hijacking ----
  {
    id: 'INJ-010',
    pattern: /you\s+are\s+now\s+(a|an|my)\s/i,
    category: 'role_hijack',
    severity: 'high',
    description: 'English: role reassignment',
  },
  {
    id: 'INJ-011',
    pattern: /act\s+as\s+(a|an|if|though)\s/i,
    category: 'role_hijack',
    severity: 'medium',
    description: 'English: role play instruction',
  },
  {
    id: 'INJ-012',
    pattern: /你现在是.{0,20}(没有|不受|无).{0,10}(限制|规则)/,
    category: 'role_hijack',
    severity: 'high',
    description: 'Chinese: role hijack with no restrictions',
  },
  {
    id: 'INJ-013',
    pattern: /pretend\s+(you\s+are|to\s+be|you're)\s/i,
    category: 'role_hijack',
    severity: 'medium',
    description: 'English: pretend role play',
  },
  // ---- System prompt extraction ----
  {
    id: 'INJ-020',
    pattern: /system\s*prompt/i,
    category: 'system_extraction',
    severity: 'high',
    description: 'System prompt reference',
  },
  {
    id: 'INJ-021',
    pattern: /(show|tell|reveal|display|print|output)\s+(me\s+)?(your|the)\s+(instructions?|prompt|rules?|system\s*message)/i,
    category: 'system_extraction',
    severity: 'high',
    description: 'English: request to reveal system instructions',
  },
  {
    id: 'INJ-022',
    pattern: /(给我|告诉我|显示|展示|输出)(你的)?(指令|提示词|系统提示|系统消息|规则)/,
    category: 'system_extraction',
    severity: 'high',
    description: 'Chinese: request system prompt',
  },
  // ---- Data exfiltration ----
  {
    id: 'INJ-030',
    pattern: /(show|give|list|tell)\s+(me\s+)?(all\s+)?(user|customer|client)\s*(data|history|questions?|queries?|information)/i,
    category: 'data_exfil',
    severity: 'high',
    description: 'English: request user data',
  },
  {
    id: 'INJ-031',
    pattern: /(database|db|sql|connection)\s*(string|password|credentials?|config)/i,
    category: 'data_exfil',
    severity: 'high',
    description: 'Database credential extraction attempt',
  },
  // ---- Encoding bypass ----
  {
    id: 'INJ-040',
    pattern: /\b(base64|rot13|hex)\s*(encode|decode|convert)/i,
    category: 'encoding_bypass',
    severity: 'medium',
    description: 'Encoding bypass attempt',
  },
]

// ---------------------------------------------------------------------
// Pure: detection.
// ---------------------------------------------------------------------

export interface InjectionDetection {
  detected: boolean
  matchedPatterns: Array<{
    id: string
    category: string
    severity: string
    description: string
    matchedText: string
  }>
  highestSeverity: 'high' | 'medium' | 'none'
}

/**
 * Check user input for prompt injection patterns.
 * Pure — no I/O, no side effects.
 *
 * Returns a detection result. The caller decides whether to block the
 * request or log a warning.
 */
export function checkPromptInjection(input: string): InjectionDetection {
  if (!input || typeof input !== 'string') {
    return { detected: false, matchedPatterns: [], highestSeverity: 'none' }
  }

  const matched: InjectionDetection['matchedPatterns'] = []

  for (const p of INJECTION_PATTERNS) {
    const match = p.pattern.exec(input)
    if (match) {
      matched.push({
        id: p.id,
        category: p.category,
        severity: p.severity,
        description: p.description,
        matchedText: match[0].slice(0, 50),
      })
    }
  }

  const hasHigh = matched.some((m) => m.severity === 'high')
  const hasMedium = matched.some((m) => m.severity === 'medium')

  return {
    detected: matched.length > 0,
    matchedPatterns: matched,
    highestSeverity: hasHigh ? 'high' : hasMedium ? 'medium' : 'none',
  }
}

// ---------------------------------------------------------------------
// Pure: input sanitization.
// ---------------------------------------------------------------------

/**
 * Sanitize user input by removing known dangerous constructs.
 * This is a SECONDARY defense — the primary defense is detection +
 * rejection. Sanitization is used for logging (strip dangerous content
 * before persisting to audit log).
 */
export function sanitizeForLog(input: string, maxLength = 500): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .replace(/<script[^>]*>.*?<\/script>/gi, '[SCRIPT_REMOVED]')
    .replace(/<[^>]+>/g, '') // strip HTML tags
    .slice(0, maxLength)
}
