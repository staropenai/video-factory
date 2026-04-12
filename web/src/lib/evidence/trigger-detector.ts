/**
 * JTG V5 改进2 — Trust signal trigger detector.
 *
 * Detects user "doubt signals" to decide when to proactively show
 * evidence/trust cards alongside AI answers.
 *
 * Five signal types:
 *   1. explicit_doubt     — user asks "is this real?" / "can I trust this?"
 *   2. high_amount_topic  — conversation involves high-value financial terms
 *   3. prolonged_hesitation — user dwells unusually long without action
 *   4. repeated_question  — same topic asked multiple times
 *   5. file_uploaded      — user attached a file (contract/receipt/photo)
 *
 * All functions are PURE. No I/O.
 */

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export type TrustSignal =
  | 'explicit_doubt'
  | 'high_amount_topic'
  | 'prolonged_hesitation'
  | 'repeated_question'
  | 'file_uploaded'

export interface TrustTriggerResult {
  triggered: boolean
  signalType: TrustSignal | null
  /** Evidence topics that should be shown if triggered. */
  suggestedEvidenceTopics: string[]
  urgency: 'low' | 'medium' | 'high'
}

// ---------------------------------------------------------------------
// Keyword dictionaries (trilingual).
// ---------------------------------------------------------------------

/** Explicit doubt phrases. */
const DOUBT_PATTERNS: RegExp[] = [
  // Japanese
  /本当(に|ですか|なの)/,
  /信じ(て|られ|ていい)/,
  /詐欺/,
  /騙(さ|し)/,
  /怪しい/,
  /嘘/,
  // Chinese
  /是真的吗/,
  /可信吗/,
  /能信(任|赖)/,
  /骗/,
  /假的/,
  /不信任/,
  /怀疑/,
  // English
  /is this (real|true|legit)/i,
  /can I trust/i,
  /scam/i,
  /\blie\b/i,
  /fake/i,
  /fraud/i,
  /suspicious/i,
]

/** High-value financial topics. */
const HIGH_AMOUNT_PATTERNS: RegExp[] = [
  // Japanese
  /初期費用/,
  /敷金/,
  /礼金/,
  /仲介手数料/,
  /更新料/,
  /原状回復/,
  /違約金/,
  /保証金/,
  /手付金/,
  // Chinese
  /初期费用/,
  /押金/,
  /礼金/,
  /中介费/,
  /违约金/,
  /保证金/,
  /定金/,
  // English
  /deposit/i,
  /key money/i,
  /brokerage fee/i,
  /penalty/i,
  /initial cost/i,
  /earnest money/i,
]

/** Map signal → evidence topic suggestions. */
const SIGNAL_EVIDENCE_MAP: Record<TrustSignal, string[]> = {
  explicit_doubt: ['official_guidelines', 'consumer_protection', 'legal_rights'],
  high_amount_topic: ['deposit_rules', 'fee_breakdown', 'MLIT_guidelines'],
  prolonged_hesitation: ['FAQ_basics', 'common_mistakes'],
  repeated_question: ['detailed_explanation', 'step_by_step'],
  file_uploaded: ['document_verification', 'contract_terms'],
}

/** Map signal → urgency. */
const SIGNAL_URGENCY_MAP: Record<TrustSignal, 'low' | 'medium' | 'high'> = {
  explicit_doubt: 'high',
  high_amount_topic: 'medium',
  prolonged_hesitation: 'low',
  repeated_question: 'medium',
  file_uploaded: 'medium',
}

// ---------------------------------------------------------------------
// Pure: detection functions.
// ---------------------------------------------------------------------

/**
 * Check if text contains explicit doubt signals.
 * Pure — no I/O.
 */
export function hasExplicitDoubt(query: string): boolean {
  return DOUBT_PATTERNS.some((p) => p.test(query))
}

/**
 * Check if text contains high-value financial topics.
 * Pure — no I/O.
 */
export function hasHighAmountTopic(query: string): boolean {
  return HIGH_AMOUNT_PATTERNS.some((p) => p.test(query))
}

/**
 * Check if user is repeating a topic.
 * Heuristic: if any previous query shares 2+ significant words with the current query.
 * Pure — no I/O.
 */
export function isRepeatedQuestion(
  query: string,
  previousQueries: string[],
): boolean {
  if (previousQueries.length === 0) return false
  // Extract significant tokens (length ≥ 2, not pure punctuation).
  const tokens = (text: string) =>
    text
      .toLowerCase()
      .split(/[\s,.\-!?;:]+/)
      .filter((t) => t.length >= 2)

  const currentTokens = new Set(tokens(query))
  for (const prev of previousQueries) {
    const prevTokens = tokens(prev)
    const overlap = prevTokens.filter((t) => currentTokens.has(t)).length
    if (overlap >= 2) return true
  }
  return false
}

/**
 * Detect trust trigger from user context.
 * Pure — no I/O.
 *
 * Priority (first match wins):
 *   1. explicit_doubt (highest urgency)
 *   2. high_amount_topic
 *   3. repeated_question
 *   4. prolonged_hesitation (if dwellTimeMs provided and > threshold)
 *   5. file_uploaded (if hasFile flag is set)
 */
export function detectTrustTrigger(
  query: string,
  previousQueries: string[] = [],
  dwellTimeMs?: number,
  hasFile?: boolean,
): TrustTriggerResult {
  const NO_TRIGGER: TrustTriggerResult = {
    triggered: false,
    signalType: null,
    suggestedEvidenceTopics: [],
    urgency: 'low',
  }

  // 1. Explicit doubt — highest priority.
  if (hasExplicitDoubt(query)) {
    return {
      triggered: true,
      signalType: 'explicit_doubt',
      suggestedEvidenceTopics: SIGNAL_EVIDENCE_MAP.explicit_doubt,
      urgency: 'high',
    }
  }

  // 2. High-value financial topic.
  if (hasHighAmountTopic(query)) {
    return {
      triggered: true,
      signalType: 'high_amount_topic',
      suggestedEvidenceTopics: SIGNAL_EVIDENCE_MAP.high_amount_topic,
      urgency: 'medium',
    }
  }

  // 3. Repeated question.
  if (isRepeatedQuestion(query, previousQueries)) {
    return {
      triggered: true,
      signalType: 'repeated_question',
      suggestedEvidenceTopics: SIGNAL_EVIDENCE_MAP.repeated_question,
      urgency: 'medium',
    }
  }

  // 4. Prolonged hesitation (30 seconds default threshold).
  if (dwellTimeMs != null && dwellTimeMs > 30_000) {
    return {
      triggered: true,
      signalType: 'prolonged_hesitation',
      suggestedEvidenceTopics: SIGNAL_EVIDENCE_MAP.prolonged_hesitation,
      urgency: 'low',
    }
  }

  // 5. File uploaded.
  if (hasFile) {
    return {
      triggered: true,
      signalType: 'file_uploaded',
      suggestedEvidenceTopics: SIGNAL_EVIDENCE_MAP.file_uploaded,
      urgency: 'medium',
    }
  }

  return NO_TRIGGER
}
