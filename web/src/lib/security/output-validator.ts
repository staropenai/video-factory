/**
 * JTG V7 — LLM output safety validator.
 *
 * V7 spec requirement:
 *   "所有 LLM 输出在进入以下流程前必须通过输出验证：
 *    前端渲染 / URL 跳转 / 知识图谱回写 / 工具调用 / 人工界面显示"
 *
 * Design:
 *   - 100% pure — no I/O, no network, no filesystem, no top-level await
 *   - Zero dependencies beyond built-in
 *   - Pure/I/O separation: all validation logic is pure functions
 *   - Detectors return ValidationIssue[] (composable)
 *   - Sanitizers return cleaned strings (destination-specific)
 *   - `validateOutput` orchestrates detectors + sanitizers per destination
 */

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export type OutputDestination =
  | 'render'
  | 'url_redirect'
  | 'graph_writeback'
  | 'tool_call'
  | 'display'

export interface ValidationIssue {
  type:
    | 'html_injection'
    | 'script_injection'
    | 'dangerous_url'
    | 'prompt_leak'
    | 'pii_exposure'
    | 'graph_pollution'
    | 'excessive_length'
    | 'encoding_attack'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  /** Character offset in the input where the issue was found. */
  position?: number
}

export interface ValidationResult {
  ok: boolean
  /** Cleaned output, safe to use for the given destination. */
  sanitized: string
  issues: ValidationIssue[]
  destination: OutputDestination
}

// ---------------------------------------------------------------------
// 1. detectHtmlInjection
// ---------------------------------------------------------------------

const HTML_INJECTION_PATTERNS: {
  pattern: RegExp
  description: string
  severity: ValidationIssue['severity']
  type: ValidationIssue['type']
}[] = [
  {
    pattern: /<script[\s>]/gi,
    description: 'Found <script> tag',
    severity: 'critical',
    type: 'script_injection',
  },
  {
    pattern: /<\/script>/gi,
    description: 'Found </script> closing tag',
    severity: 'critical',
    type: 'script_injection',
  },
  {
    pattern: /<iframe[\s>]/gi,
    description: 'Found <iframe> tag',
    severity: 'critical',
    type: 'html_injection',
  },
  {
    pattern: /<object[\s>]/gi,
    description: 'Found <object> tag',
    severity: 'high',
    type: 'html_injection',
  },
  {
    pattern: /<embed[\s>]/gi,
    description: 'Found <embed> tag',
    severity: 'high',
    type: 'html_injection',
  },
  {
    pattern: /<form[\s>]/gi,
    description: 'Found <form> tag',
    severity: 'high',
    type: 'html_injection',
  },
  {
    pattern: /<input[\s>/]/gi,
    description: 'Found <input> tag',
    severity: 'medium',
    type: 'html_injection',
  },
  {
    pattern: /\bon(click|error|load|mouseover|mouseout|focus|blur|change|submit|keydown|keyup|keypress)\s*=/gi,
    description: 'Found inline event handler attribute',
    severity: 'critical',
    type: 'script_injection',
  },
  {
    pattern: /javascript\s*:/gi,
    description: 'Found javascript: protocol',
    severity: 'critical',
    type: 'script_injection',
  },
  {
    pattern: /data\s*:\s*(text\/html|application\/xhtml\+xml|application\/javascript|text\/javascript)/gi,
    description: 'Found data: URI with dangerous MIME type',
    severity: 'critical',
    type: 'script_injection',
  },
]

export function detectHtmlInjection(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const rule of HTML_INJECTION_PATTERNS) {
    // Reset lastIndex for global regexps
    rule.pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = rule.pattern.exec(text)) !== null) {
      issues.push({
        type: rule.type,
        severity: rule.severity,
        description: rule.description,
        position: match.index,
      })
    }
  }
  return issues
}

// ---------------------------------------------------------------------
// 2. detectDangerousUrls
// ---------------------------------------------------------------------

const DANGEROUS_URL_PROTOCOLS = /(?:javascript|data\s*:\s*text\/html|file|about|blob)\s*:/gi

const PHISHING_TLDS = /\.(tk|ml|ga|cf|gq|top|xyz|pw|cc|buzz|surf|rest)\b/i

export function detectDangerousUrls(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Extract URL-like strings
  const urlPattern = /(?:https?:\/\/|javascript:|data:|file:\/\/|about:|blob:)[^\s"'<>)}\]]+/gi
  let match: RegExpExecArray | null
  while ((match = urlPattern.exec(text)) !== null) {
    const url = match[0]
    const pos = match.index

    // Check dangerous protocols
    DANGEROUS_URL_PROTOCOLS.lastIndex = 0
    if (DANGEROUS_URL_PROTOCOLS.test(url)) {
      issues.push({
        type: 'dangerous_url',
        severity: 'critical',
        description: `URL uses dangerous protocol: ${url.slice(0, 60)}`,
        position: pos,
      })
    }

    // Check phishing TLDs
    if (PHISHING_TLDS.test(url)) {
      issues.push({
        type: 'dangerous_url',
        severity: 'medium',
        description: `URL uses suspicious TLD: ${url.slice(0, 60)}`,
        position: pos,
      })
    }

    // Check excessive length
    if (url.length > 500) {
      issues.push({
        type: 'dangerous_url',
        severity: 'medium',
        description: `Suspiciously long URL (${url.length} chars)`,
        position: pos,
      })
    }
  }

  // Also detect bare dangerous protocol references not caught above
  const bareProtocols = /\b(javascript|file|about|blob)\s*:/gi
  while ((match = bareProtocols.exec(text)) !== null) {
    // Avoid duplicates: only flag if not already within a URL we found
    const alreadyFlagged = issues.some(
      (i) => i.position !== undefined && Math.abs(i.position - match!.index) < 5,
    )
    if (!alreadyFlagged) {
      issues.push({
        type: 'dangerous_url',
        severity: 'critical',
        description: `Bare dangerous protocol reference: ${match[0]}`,
        position: match.index,
      })
    }
  }

  return issues
}

// ---------------------------------------------------------------------
// 3. detectPromptLeak
// ---------------------------------------------------------------------

const PROMPT_LEAK_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /\bYou are a\b/i, description: 'Possible system prompt leak: "You are a"' },
  { pattern: /\bSystem\s*:\s/i, description: 'Possible system prompt leak: "System:"' },
  { pattern: /<<SYS>>/i, description: 'Possible system prompt leak: "<<SYS>>"' },
  { pattern: /###\s*Instructions/i, description: 'Possible system prompt leak: "### Instructions"' },
  { pattern: /\[INST\]/i, description: 'Possible system prompt leak: "[INST]"' },
  { pattern: /\bROUTING_RULES\b/, description: 'JTG-internal term leaked: "ROUTING_RULES"' },
  { pattern: /\bJUDGMENT_RULES\b/, description: 'JTG-internal term leaked: "JUDGMENT_RULES"' },
  { pattern: /\bpatent_internal\b/, description: 'JTG-internal term leaked: "patent_internal"' },
  { pattern: /\.patent-internal\b/, description: 'JTG-internal term leaked: ".patent-internal"' },
  { pattern: /θ_min/, description: 'JTG-internal term leaked: "θ_min"' },
  { pattern: /α·cost/, description: 'JTG-internal term leaked: "α·cost"' },
  {
    pattern: /\b(ignore|disregard|forget)\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)/i,
    description: 'Prompt injection echo pattern detected',
  },
  {
    pattern: /\b(my|the)\s+(system\s+)?prompt\s+(is|says|reads|contains)\b/i,
    description: 'Prompt content disclosure pattern',
  },
]

export function detectPromptLeak(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const rule of PROMPT_LEAK_PATTERNS) {
    rule.pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = rule.pattern.exec(text)) !== null) {
      issues.push({
        type: 'prompt_leak',
        severity: 'high',
        description: rule.description,
        position: match.index,
      })
      // Non-global patterns only match once; break to avoid infinite loop
      if (!rule.pattern.global) break
    }
  }
  return issues
}

// ---------------------------------------------------------------------
// 4. detectPiiExposure
// ---------------------------------------------------------------------

const PII_PATTERNS: { pattern: RegExp; description: string }[] = [
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    description: 'Email address detected',
  },
  {
    // Japanese phone: 0X0-XXXX-XXXX or 0X0XXXXXXXX
    pattern: /0[1-9]0[-\s]?\d{4}[-\s]?\d{4}/g,
    description: 'Japanese phone number detected',
  },
  {
    // International phone: +XX...
    pattern: /\+\d{1,3}[-\s]?\d{1,4}[-\s]?\d{2,4}[-\s]?\d{2,4}/g,
    description: 'International phone number detected',
  },
  {
    // Credit card: 4 groups of 4 digits
    pattern: /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/g,
    description: 'Credit card number pattern detected',
  },
  {
    // Japanese residence card: 2 letters + 8 digits + 2 letters
    pattern: /\b[A-Z]{2}\d{8}[A-Z]{2}\b/g,
    description: 'Japanese residence card number pattern detected',
  },
  {
    // My Number: 12 consecutive digits (standalone)
    pattern: /\b\d{12}\b/g,
    description: 'My Number (12-digit) pattern detected',
  },
]

export function detectPiiExposure(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const rule of PII_PATTERNS) {
    rule.pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = rule.pattern.exec(text)) !== null) {
      issues.push({
        type: 'pii_exposure',
        severity: 'high',
        description: rule.description,
        position: match.index,
      })
    }
  }
  return issues
}

// ---------------------------------------------------------------------
// 5. detectEncodingAttack
// ---------------------------------------------------------------------

// Cyrillic characters that visually mimic Latin characters
const CYRILLIC_LATIN_LOOKALIKES: Record<string, string> = {
  '\u0410': 'A', // А -> A
  '\u0412': 'B', // В -> B
  '\u0421': 'C', // С -> C
  '\u0415': 'E', // Е -> E
  '\u041D': 'H', // Н -> H
  '\u041A': 'K', // К -> K
  '\u041C': 'M', // М -> M
  '\u041E': 'O', // О -> O
  '\u0420': 'P', // Р -> P
  '\u0422': 'T', // Т -> T
  '\u0425': 'X', // Х -> X
  '\u0430': 'a', // а -> a
  '\u0435': 'e', // е -> e
  '\u043E': 'o', // о -> o
  '\u0440': 'p', // р -> p
  '\u0441': 'c', // с -> c
  '\u0445': 'x', // х -> x
  '\u0443': 'y', // у -> y
}

const ZERO_WIDTH_CHARS = /[\u200B\u200C\u200D\uFEFF]/g
const RTL_OVERRIDE = /\u202E/g

export function detectEncodingAttack(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Check for Cyrillic homoglyph mixed with Latin
  let hasLatin = false
  let hasCyrillicLookalike = false
  let cyrillicPosition: number | undefined

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (/[a-zA-Z]/.test(ch)) {
      hasLatin = true
    }
    if (ch in CYRILLIC_LATIN_LOOKALIKES) {
      hasCyrillicLookalike = true
      if (cyrillicPosition === undefined) {
        cyrillicPosition = i
      }
    }
  }

  if (hasLatin && hasCyrillicLookalike) {
    issues.push({
      type: 'encoding_attack',
      severity: 'high',
      description: 'Unicode homoglyph attack: Cyrillic characters mixed with Latin lookalikes',
      position: cyrillicPosition,
    })
  }

  // Check for zero-width characters
  ZERO_WIDTH_CHARS.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ZERO_WIDTH_CHARS.exec(text)) !== null) {
    issues.push({
      type: 'encoding_attack',
      severity: 'medium',
      description: `Zero-width character (U+${match[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}) could hide content`,
      position: match.index,
    })
  }

  // Check for RTL override
  RTL_OVERRIDE.lastIndex = 0
  while ((match = RTL_OVERRIDE.exec(text)) !== null) {
    issues.push({
      type: 'encoding_attack',
      severity: 'high',
      description: 'Right-to-left override character (U+202E) can disguise text direction',
      position: match.index,
    })
  }

  return issues
}

// ---------------------------------------------------------------------
// 6. sanitizeForRender
// ---------------------------------------------------------------------

export function sanitizeForRender(text: string): string {
  let result = text
  // Strip null bytes
  result = result.replace(/\0/g, '')
  // Strip zero-width characters
  result = result.replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
  // HTML-entity-encode dangerous chars
  result = result
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
  return result
}

// ---------------------------------------------------------------------
// 7. sanitizeForGraphWriteback
// ---------------------------------------------------------------------

export function sanitizeForGraphWriteback(text: string): string {
  let result = text
  // Strip all HTML tags
  result = result.replace(/<[^>]*>/g, '')
  // Normalize whitespace (collapse runs of whitespace to a single space)
  result = result.replace(/\s+/g, ' ').trim()
  // Truncate to 10000 characters
  if (result.length > 10_000) {
    result = result.slice(0, 10_000)
  }
  return result
}

// ---------------------------------------------------------------------
// 8. sanitizeUrl
// ---------------------------------------------------------------------

const ALLOWED_URL_PROTOCOLS = /^(https?|mailto|tel):/i

export function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!ALLOWED_URL_PROTOCOLS.test(trimmed)) {
    return null
  }
  return trimmed
}

// ---------------------------------------------------------------------
// 9. validateOutput
// ---------------------------------------------------------------------

export function validateOutput(
  text: string,
  destination: OutputDestination,
): ValidationResult {
  // Run all detectors
  const issues: ValidationIssue[] = [
    ...detectHtmlInjection(text),
    ...detectDangerousUrls(text),
    ...detectPromptLeak(text),
    ...detectPiiExposure(text),
    ...detectEncodingAttack(text),
  ]

  // Apply destination-specific sanitizer
  let sanitized: string
  switch (destination) {
    case 'render':
    case 'display':
      sanitized = sanitizeForRender(text)
      break
    case 'url_redirect': {
      const safe = sanitizeUrl(text)
      sanitized = safe ?? ''
      if (safe === null) {
        issues.push({
          type: 'dangerous_url',
          severity: 'critical',
          description: 'URL blocked: uses disallowed protocol',
        })
      }
      break
    }
    case 'graph_writeback':
      sanitized = sanitizeForGraphWriteback(text)
      break
    case 'tool_call':
      // For tool calls, sanitize for render safety (encode HTML) but preserve structure
      sanitized = sanitizeForRender(text)
      break
  }

  // Determine ok status: false if any critical issue found
  const hasCritical = issues.some((i) => i.severity === 'critical')

  return {
    ok: !hasCritical,
    sanitized,
    issues,
    destination,
  }
}

// ---------------------------------------------------------------------
// 10. validateBatch
// ---------------------------------------------------------------------

export function validateBatch(
  items: { text: string; destination: OutputDestination }[],
): ValidationResult[] {
  return items.map((item) => validateOutput(item.text, item.destination))
}
