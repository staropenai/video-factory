/**
 * JTG P1 — Language bridge contract.
 *
 * The bridge is the one place where user-facing LLM generation is allowed:
 * it turns a user's message (in their own language) into a plain-language
 * explanation PLUS a Japanese template they can paste to their landlord,
 * city office, HR, etc.
 *
 * Strict rules (enforced by validateBridgeOutput):
 *   - Input must be text or image. Voice and "call me" requests are
 *     rejected at the contract boundary (Spec: no phone/VOIP).
 *   - Japanese template is ALWAYS marked AI_INFERRED in its source tag.
 *     Even though the prompt template is hand-written, the rendered
 *     instance is machine output, so it carries AI provenance and a
 *     "please confirm with a human" disclaimer.
 *   - HIGH-risk queries (legal threat, deportation, domestic violence)
 *     MUST carry an escalation suggestion. The route handler auto-injects
 *     one so a malformed LLM response can't slip past the validator.
 *   - Every output carries `assistanceDisclaimer` — we don't render raw
 *     AI text without the "this is machine-generated, verify with a pro"
 *     warning.
 *
 * All errors use stable codes so the route handler and the test suite
 * can pattern-match on them.
 */

import type { SourceType } from './enums'

// ---------------------------------------------------------------------
// Input / output types.
// ---------------------------------------------------------------------

export type BridgeInputType = 'text' | 'image'

/** Inputs we explicitly refuse. Kept as a type so the compiler helps. */
export type UnsupportedBridgeInputType = 'voice' | 'call_request'

export type UserLocale = 'en' | 'zh' | 'ja'

export interface BridgeInput {
  inputType: BridgeInputType
  rawText?: string
  /** Opaque storage ref; the route fetches it when inputType==='image'. */
  imageRef?: string
  userLocale: UserLocale
  /** Optional staff-supplied hint, e.g. "tenant facing eviction". */
  contextHint?: string
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type PolitenessTier = 'plain' | 'polite' | 'humble'

export interface JapaneseTemplate {
  /** Hard-coded to AI_INFERRED — validator rejects anything else. */
  sourceType: Extract<SourceType, 'AI_INFERRED'>
  politenessTier: PolitenessTier
  riskLabel: RiskLevel
  body: string
}

export interface EscalationSuggestion {
  /** Keep loose — the downstream UI decides how to render. */
  kind: 'handoff' | 'case' | 'official_resource'
  reason: string
  actionText: string
}

export interface BridgeOutput {
  riskLevel: RiskLevel
  plainExplanation: string
  japaneseTemplate: JapaneseTemplate
  /** Gentler rewording for users who flagged the initial template as cold. */
  softerVariant?: JapaneseTemplate
  keyTerms: Array<{ term: string; meaning: string }>
  nextAction: string
  assistanceDisclaimer: string
  /** REQUIRED when riskLevel === 'HIGH' — validator enforces. */
  escalationSuggestion?: EscalationSuggestion
  bridgeVersion: '1'
}

// ---------------------------------------------------------------------
// Stable error codes.
// ---------------------------------------------------------------------

export const BRIDGE_ERROR_CODES = {
  UNSUPPORTED_INPUT_TYPE: 'UNSUPPORTED_INPUT_TYPE',
  MISSING_RAW_TEXT: 'MISSING_RAW_TEXT',
  MISSING_IMAGE_REF: 'MISSING_IMAGE_REF',
  EMPTY_EXPLANATION: 'EMPTY_EXPLANATION',
  TEMPLATE_SOURCE_WRONG: 'TEMPLATE_SOURCE_WRONG',
  HIGH_RISK_NO_ESCALATION: 'HIGH_RISK_NO_ESCALATION',
  MISSING_DISCLAIMER: 'MISSING_DISCLAIMER',
} as const
export type BridgeErrorCode =
  (typeof BRIDGE_ERROR_CODES)[keyof typeof BRIDGE_ERROR_CODES]

export interface BridgeValidationOk {
  ok: true
  output: BridgeOutput
}
export interface BridgeValidationErr {
  ok: false
  code: BridgeErrorCode
  message: string
}
export type BridgeValidationResult = BridgeValidationOk | BridgeValidationErr

// ---------------------------------------------------------------------
// Constants.
// ---------------------------------------------------------------------

/**
 * Keyword list for deterministic risk classification. Keep terms literal and
 * short; the classifier lower-cases the input but does not run synonym
 * expansion — we want zero false positives on the LOW/MEDIUM bucket and we
 * want the HIGH bucket to be obvious enough that staff agree with every hit.
 *
 * If the LLM returns a different riskLevel than the classifier, the route
 * handler takes the MAX of the two (so the LLM can escalate, never
 * de-escalate).
 */
export const HIGH_RISK_KEYWORDS: ReadonlyArray<string> = [
  // English
  'lawsuit',
  'sue',
  'sued',
  'court',
  'deport',
  'deportation',
  'evict',
  'eviction',
  'visa revoked',
  'arrested',
  'assault',
  'domestic violence',
  'threatened',
  // 中文
  '起诉',
  '诉讼',
  '驱逐',
  '遣返',
  '签证被取消',
  '家暴',
  '恐吓',
  // 日本語
  '訴訟',
  '訴える',
  '強制退去',
  '立ち退き',
  '在留資格取消',
  '家庭内暴力',
  '脅迫',
]

const MEDIUM_RISK_KEYWORDS: ReadonlyArray<string> = [
  'rent increase',
  'contract dispute',
  'deposit',
  'penalty',
  '房租上涨',
  '合同纠纷',
  '押金',
  '違約金',
  '契約解除',
  '敷金',
]

export const ASSISTANCE_DISCLAIMER =
  'This translation is machine-assisted. Please verify critical details with a qualified professional (lawyer, visa advisor, city hall) before acting.'

// ---------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------

/** Deterministic risk classifier — no LLM, no network. */
export function classifyRisk(text: string): RiskLevel {
  if (!text) return 'LOW'
  const haystack = text.toLowerCase()
  for (const kw of HIGH_RISK_KEYWORDS) {
    if (haystack.includes(kw.toLowerCase())) return 'HIGH'
  }
  for (const kw of MEDIUM_RISK_KEYWORDS) {
    if (haystack.includes(kw.toLowerCase())) return 'MEDIUM'
  }
  return 'LOW'
}

/**
 * Auto-build an escalation suggestion for HIGH-risk queries. The route
 * handler calls this unconditionally when risk is HIGH, so even a naive
 * LLM output gets the escalation stapled on before validation runs.
 */
export function buildEscalationSuggestion(
  risk: RiskLevel,
  userLocale: UserLocale,
): EscalationSuggestion | undefined {
  if (risk !== 'HIGH') return undefined
  const action =
    userLocale === 'ja'
      ? '専門家（弁護士・行政書士・市役所）に直接相談してください。'
      : userLocale === 'zh'
        ? '请直接联系专业人士（律师、行政书士、市役所）获取帮助。'
        : 'Please contact a qualified professional (lawyer, immigration advisor, or city hall) directly for help.'
  return {
    kind: 'handoff',
    reason: 'HIGH-risk situation detected; machine translation is not sufficient.',
    actionText: action,
  }
}

// ---------------------------------------------------------------------
// Validator.
// ---------------------------------------------------------------------

export function validateBridgeInput(
  input: Partial<BridgeInput> & { inputType?: string },
): BridgeValidationErr | { ok: true; input: BridgeInput } {
  const t = input.inputType
  if (t !== 'text' && t !== 'image') {
    return {
      ok: false,
      code: BRIDGE_ERROR_CODES.UNSUPPORTED_INPUT_TYPE,
      message: `inputType must be 'text' or 'image'; got ${JSON.stringify(t)}`,
    }
  }
  if (t === 'text' && !input.rawText) {
    return {
      ok: false,
      code: BRIDGE_ERROR_CODES.MISSING_RAW_TEXT,
      message: 'inputType=text requires rawText',
    }
  }
  if (t === 'image' && !input.imageRef) {
    return {
      ok: false,
      code: BRIDGE_ERROR_CODES.MISSING_IMAGE_REF,
      message: 'inputType=image requires imageRef',
    }
  }
  const locale = input.userLocale
  if (locale !== 'en' && locale !== 'zh' && locale !== 'ja') {
    return {
      ok: false,
      code: BRIDGE_ERROR_CODES.UNSUPPORTED_INPUT_TYPE,
      message: `userLocale must be en|zh|ja; got ${JSON.stringify(locale)}`,
    }
  }
  return {
    ok: true,
    input: {
      inputType: t,
      rawText: input.rawText,
      imageRef: input.imageRef,
      userLocale: locale,
      contextHint: input.contextHint,
    },
  }
}

export function validateBridgeOutput(
  output: BridgeOutput,
): BridgeValidationResult {
  if (!output.plainExplanation || !output.plainExplanation.trim()) {
    return {
      ok: false,
      code: BRIDGE_ERROR_CODES.EMPTY_EXPLANATION,
      message: 'plainExplanation is required',
    }
  }
  if (!output.assistanceDisclaimer || !output.assistanceDisclaimer.trim()) {
    return {
      ok: false,
      code: BRIDGE_ERROR_CODES.MISSING_DISCLAIMER,
      message: 'assistanceDisclaimer is required',
    }
  }
  if (output.japaneseTemplate.sourceType !== 'AI_INFERRED') {
    return {
      ok: false,
      code: BRIDGE_ERROR_CODES.TEMPLATE_SOURCE_WRONG,
      message: `japaneseTemplate.sourceType must be AI_INFERRED; got ${output.japaneseTemplate.sourceType}`,
    }
  }
  if (output.riskLevel === 'HIGH' && !output.escalationSuggestion) {
    return {
      ok: false,
      code: BRIDGE_ERROR_CODES.HIGH_RISK_NO_ESCALATION,
      message: 'HIGH-risk bridge output requires an escalationSuggestion',
    }
  }
  return { ok: true, output }
}
