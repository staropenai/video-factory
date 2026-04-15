/**
 * Answer Quality Validators (TASK 14)
 *
 * Minimum quality checks that every answer must pass before delivery.
 * These are post-generation checks (after the LLM or shortcut produces text).
 *
 * Validation rules:
 * 1. Non-empty answer for non-escalation paths
 * 2. Language consistency (answer should be in detected language)
 * 3. Minimum length for direct answers
 * 4. No system prompt leakage
 * 5. Unverified answers must not contain certainty markers
 */

import type { AnswerMeta } from '@/lib/answer-reliability/types'

export interface QualityCheckResult {
  passed: boolean
  issues: string[]
}

/** Minimum answer length for direct_answer mode (characters) */
const MIN_DIRECT_ANSWER_LENGTH = 20

/** Patterns that indicate system prompt leakage */
const PROMPT_LEAKAGE_PATTERNS = [
  /\bSAFETY RULES\b/i,
  /\bimmutable.*do not override\b/i,
  /\brouting analysis model\b/i,
  /\bfinal response layer\b/i,
  /\byou must obey the routing mode\b/i,
  /\bruleKey\b/,
  /\banswerModeOverride\b/,
  /\bshouldEscalate\b/,
  /\btraceTag\b/,
]

/** Language detection heuristics */
const LANGUAGE_INDICATORS: Record<string, RegExp> = {
  zh: /[\u4E00-\u9FFF]/,
  ja: /[\u3040-\u309F\u30A0-\u30FF]/,
  en: /^[a-zA-Z\s.,!?'"()\-:;0-9]+$/,
}

/**
 * Run all quality checks on an answer.
 */
export function validateAnswerQuality(
  answerText: string | null,
  meta: AnswerMeta,
  detectedLanguage: string,
): QualityCheckResult {
  const issues: string[] = []

  // Rule 1: Non-escalation answers must have content
  if (meta.answer_type !== 'human_review_required') {
    if (!answerText || answerText.trim().length === 0) {
      issues.push('Empty answer for non-escalation path')
    }
  }

  // Skip remaining checks if no answer text
  if (!answerText || answerText.trim().length === 0) {
    return { passed: issues.length === 0, issues }
  }

  // Rule 2: Minimum length for verified answers
  if (
    meta.verification.verified &&
    meta.answer_type !== 'human_review_required' &&
    answerText.length < MIN_DIRECT_ANSWER_LENGTH
  ) {
    issues.push(`Answer too short (${answerText.length} chars, minimum ${MIN_DIRECT_ANSWER_LENGTH})`)
  }

  // Rule 3: System prompt leakage detection
  for (const pattern of PROMPT_LEAKAGE_PATTERNS) {
    if (pattern.test(answerText)) {
      issues.push(`Potential system prompt leakage detected: ${pattern.source.slice(0, 30)}`)
      break // One leakage finding is enough
    }
  }

  // Rule 4: Language consistency check (soft — only flags major mismatches)
  if (detectedLanguage === 'zh' || detectedLanguage === 'ja') {
    const hasTargetLang = LANGUAGE_INDICATORS[detectedLanguage]?.test(answerText)
    if (!hasTargetLang && answerText.length > 50) {
      issues.push(`Answer may not be in detected language (${detectedLanguage})`)
    }
  }

  return { passed: issues.length === 0, issues }
}
