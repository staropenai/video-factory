/**
 * POST /api/bridge — JTG P1 language bridge endpoint.
 *
 * Turns a user's message (or image OCR text) into a plain-language
 * explanation PLUS a Japanese template they can paste. The endpoint
 * enforces the language-bridge contract:
 *
 *   - Only text + image inputs. voice/call_request → 400.
 *   - HIGH-risk outputs must carry an escalationSuggestion. We auto-inject
 *     one BEFORE running validateBridgeOutput so a naive LLM response
 *     can't slip past the validator.
 *   - japaneseTemplate.sourceType is pinned to 'AI_INFERRED'.
 *   - Emits a durable QUERY_RECEIVED event tagged with route=/api/bridge
 *     and metadata.risk so daily-summary can count bridge usage.
 *
 * LLM wiring: if `openaiAvailable` is true and the request body does not
 * include `skipLlm: true`, we call the model for the plain explanation +
 * softer-variant rewrite. Otherwise we fall back to a deterministic
 * template — the goal is that this route produces a CONTRACT-VALID
 * response in every environment, including CI without API keys.
 *
 * The route never throws on bad LLM output; it re-runs the fallback and
 * tags `source: 'fallback'` in the response + event metadata so callers
 * can tell which path answered.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  validateBridgeInput,
  validateBridgeOutput,
  classifyRisk,
  buildEscalationSuggestion,
  ASSISTANCE_DISCLAIMER,
  type BridgeInput,
  type BridgeOutput,
  type RiskLevel,
  type JapaneseTemplate,
  type UserLocale,
} from '@/lib/domain/language-bridge'
import { insertEvent } from '@/lib/db/tables'
import { logError } from '@/lib/audit/logger'
import { openai, openaiAvailable, env as openaiEnv } from '@/lib/ai/openai'
import { checkPromptInjection, sanitizeForLog } from '@/lib/security/prompt-injection'
import { buildSecurityEvent, classifySecuritySeverity, logSecurityEvent } from '@/lib/security/event-log'
import { recordBridgeSession } from '@/lib/patent/metrics-collector'

/** Stable structured-error builder (Spec §13). */
function err(
  code: string,
  message: string,
  status: number,
  relatedIds: Record<string, unknown> = {},
) {
  return NextResponse.json(
    { ok: false, error: { code, message, relatedIds } },
    { status },
  )
}

// ---------------------------------------------------------------------
// Deterministic fallback — always produces a contract-valid BridgeOutput.
// ---------------------------------------------------------------------

function fallbackJapaneseTemplate(
  risk: RiskLevel,
  rawText: string,
): JapaneseTemplate {
  const politenessTier =
    risk === 'HIGH' ? 'humble' : risk === 'MEDIUM' ? 'polite' : 'polite'
  const opener =
    risk === 'HIGH'
      ? 'お忙しいところ恐れ入ります。至急ご確認いただきたい件がございます。'
      : 'お世話になっております。'
  // We don't translate the user's text — we just stuff it into a
  // placeholder slot so staff can see WHAT the user meant while still
  // getting a safe wrapper. The LLM path produces a real translation.
  const body = `${opener}\n\n【ご相談内容】\n${rawText.slice(0, 400)}\n\nお手数をおかけしますが、ご対応のほどよろしくお願いいたします。`
  return {
    sourceType: 'AI_INFERRED',
    politenessTier,
    riskLabel: risk,
    body,
  }
}

function fallbackPlainExplanation(
  rawText: string,
  locale: UserLocale,
  risk: RiskLevel,
): string {
  const gist = rawText.slice(0, 200)
  const prefix =
    locale === 'ja'
      ? 'ご相談内容を要約しました：'
      : locale === 'zh'
        ? '我们的理解是：'
        : 'Here is our understanding of your situation:'
  const riskNote =
    risk === 'HIGH'
      ? locale === 'ja'
        ? '（重大な状況の可能性があります。専門家に相談してください。）'
        : locale === 'zh'
          ? '（这可能是严重情况，请咨询专业人士。）'
          : ' (This looks serious; please contact a professional.)'
      : ''
  return `${prefix} ${gist}${riskNote}`
}

function buildFallbackOutput(
  input: BridgeInput,
  risk: RiskLevel,
): BridgeOutput {
  const text = input.rawText ?? '(image content)'
  const template = fallbackJapaneseTemplate(risk, text)
  return {
    riskLevel: risk,
    plainExplanation: fallbackPlainExplanation(text, input.userLocale, risk),
    japaneseTemplate: template,
    keyTerms: [],
    nextAction:
      input.userLocale === 'ja'
        ? '日本語テンプレートをそのまま使用できます。'
        : input.userLocale === 'zh'
          ? '您可以直接复制日语模板使用。'
          : 'You can copy the Japanese template above and send it directly.',
    assistanceDisclaimer: ASSISTANCE_DISCLAIMER,
    bridgeVersion: '1',
  }
}

// ---------------------------------------------------------------------
// LLM path (optional) — mirrors the fallback shape so validator is happy.
// ---------------------------------------------------------------------

interface LlmBridgeRaw {
  plainExplanation?: string
  japaneseBody?: string
  politenessTier?: 'plain' | 'polite' | 'humble'
  keyTerms?: Array<{ term: string; meaning: string }>
  nextAction?: string
}

async function tryLlmBridge(
  input: BridgeInput,
  risk: RiskLevel,
): Promise<BridgeOutput | null> {
  if (!openaiAvailable || !openai) return null
  try {
    // Keep the prompt boring and verifiable. We don't let the model pick
    // risk — that's already classified deterministically and passed in.
    const resp = await openai.chat.completions.create({
      model: openaiEnv.OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You translate user messages into a plain explanation and a Japanese template. Return JSON with keys: plainExplanation, japaneseBody, politenessTier (plain|polite|humble), keyTerms (array of {term, meaning}), nextAction. Never include any phone numbers, emails, or personal info.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            userLocale: input.userLocale,
            riskLevel: risk,
            contextHint: input.contextHint ?? null,
            rawText: input.rawText ?? '',
          }),
        },
      ],
    })
    const raw = resp.choices[0]?.message?.content
    if (!raw) return null
    const parsed = JSON.parse(raw) as LlmBridgeRaw
    if (!parsed.plainExplanation || !parsed.japaneseBody) return null
    const politeness =
      parsed.politenessTier === 'plain' ||
      parsed.politenessTier === 'polite' ||
      parsed.politenessTier === 'humble'
        ? parsed.politenessTier
        : 'polite'
    const template: JapaneseTemplate = {
      sourceType: 'AI_INFERRED',
      politenessTier: politeness,
      riskLabel: risk,
      body: parsed.japaneseBody,
    }
    return {
      riskLevel: risk,
      plainExplanation: parsed.plainExplanation,
      japaneseTemplate: template,
      keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms : [],
      nextAction: parsed.nextAction ?? '',
      assistanceDisclaimer: ASSISTANCE_DISCLAIMER,
      bridgeVersion: '1',
    }
  } catch (error) {
    logError('bridge_llm_failed', error)
    return null
  }
}

// ---------------------------------------------------------------------
// Route.
// ---------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>

    // V6 §P0-3 — Prompt injection detection on raw text input.
    const rawText = String(body.rawText ?? '').trim()
    if (rawText) {
      const injCheck = checkPromptInjection(rawText)
      if (injCheck.detected && injCheck.highestSeverity === 'high') {
        const secClass = classifySecuritySeverity(injCheck.highestSeverity)
        logSecurityEvent(
          buildSecurityEvent({
            eventType: secClass.eventType,
            severity: secClass.severity,
            route: '/api/bridge',
            inputPreview: sanitizeForLog(rawText, 200),
            matchedPatternIds: injCheck.matchedPatterns.map((p) => p.id),
            description: `Bridge injection blocked: ${injCheck.matchedPatterns.map((p) => p.description).join('; ')}`,
            blocked: true,
          }),
        )
        return err('PROMPT_INJECTION', 'Your input could not be processed. Please rephrase.', 400)
      }
    }

    const parsed = validateBridgeInput(body as Partial<BridgeInput>)
    if (!parsed.ok) {
      return err(parsed.code, parsed.message, 400)
    }
    const input = parsed.input

    // Max of deterministic classifier and optional caller-supplied hint.
    const classifiedRisk = classifyRisk(input.rawText ?? '')
    const hintedRisk =
      typeof body.hintedRisk === 'string' &&
      (body.hintedRisk === 'LOW' ||
        body.hintedRisk === 'MEDIUM' ||
        body.hintedRisk === 'HIGH')
        ? (body.hintedRisk as RiskLevel)
        : undefined
    const risk: RiskLevel =
      hintedRisk && rankRisk(hintedRisk) > rankRisk(classifiedRisk)
        ? hintedRisk
        : classifiedRisk

    // Try LLM first, fall back deterministically.
    const skipLlm = body.skipLlm === true
    const llmResult = skipLlm ? null : await tryLlmBridge(input, risk)
    let output: BridgeOutput = llmResult ?? buildFallbackOutput(input, risk)
    const source: 'llm' | 'fallback' = llmResult ? 'llm' : 'fallback'

    // Auto-inject escalation BEFORE validation — HIGH risk must never
    // reach a user without it.
    if (risk === 'HIGH' && !output.escalationSuggestion) {
      const esc = buildEscalationSuggestion(risk, input.userLocale)
      if (esc) output = { ...output, escalationSuggestion: esc }
    }

    const validated = validateBridgeOutput(output)
    if (!validated.ok) {
      // Last-resort: fall back to deterministic output and revalidate.
      // If even that fails, surface a structured error.
      const rescue = buildFallbackOutput(input, risk)
      const rescueWithEsc: BridgeOutput =
        risk === 'HIGH'
          ? {
              ...rescue,
              escalationSuggestion:
                rescue.escalationSuggestion ??
                buildEscalationSuggestion(risk, input.userLocale),
            }
          : rescue
      const revalidated = validateBridgeOutput(rescueWithEsc)
      if (!revalidated.ok) {
        return err(revalidated.code, revalidated.message, 500)
      }
      output = revalidated.output
    } else {
      output = validated.output
    }

    // Durable audit event — QUERY_RECEIVED with bridge-specific metadata.
    // We reuse the existing enum rather than adding a new type.
    insertEvent({
      eventType: 'QUERY_RECEIVED',
      route: '/api/bridge',
      relatedIds: {},
      metadata: {
        risk,
        source,
        inputType: input.inputType,
        userLocale: input.userLocale,
        llmAvailable: openaiAvailable,
      },
    })

    // Patent PoC — record bridge session for 方案C data collection.
    try {
      recordBridgeSession({
        sessionId: `bridge_${Date.now()}`,
        sceneTag: typeof body.sceneTag === 'string' ? body.sceneTag : null,
        timeToFirstScript: 0, // Populated by frontend when timing data is available
        riskLevel: risk,
        userLocale: input.userLocale,
      })
    } catch (e) {
      logError('patent_bridge_metric_error', e)
    }

    return NextResponse.json({ ok: true, source, output })
  } catch (error) {
    logError('bridge_route_error', error)
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL',
          message: error instanceof Error ? error.message : 'Internal error',
          relatedIds: {},
        },
      },
      { status: 500 },
    )
  }
}

function rankRisk(r: RiskLevel): number {
  return r === 'HIGH' ? 3 : r === 'MEDIUM' ? 2 : 1
}
