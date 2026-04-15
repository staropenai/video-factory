/**
 * POST /api/vision-extract — image → text+intent via OpenAI vision.
 *
 * Phase 1 MVP (§5 / §6.1 of the CEO iteration plan): the user can upload a
 * photo of a document (rental application, utility bill, official letter,
 * signage) and we extract the visible text + a short suggested query the
 * frontend can feed straight into /api/router.
 *
 * Request shape (multipart/form-data):
 *   file: File          — the image (PNG/JPG/WEBP)
 *   hint?: string       — optional user hint ("this is my lease contract")
 *   language?: 'en'|'zh'|'ja' — preferred output language
 *
 * Or JSON:
 *   { imageBase64: string, mimeType?: string, hint?, language? }
 *
 * Response:
 *   {
 *     ok: true,
 *     extractedText: string,
 *     suggestedQuery: string,
 *     detectedIntent: string,
 *     language: 'en'|'zh'|'ja',
 *     source: 'openai' | 'fallback',
 *     debug: { latencyMs }
 *   }
 *
 * Fallback: if OpenAI is unavailable (no key, disabled, 4xx/5xx), return a
 * placeholder result so the UI can still render and the user can retype.
 * The router path must never crash because of vision.
 */

import { NextRequest } from 'next/server'
import { ok, fail, rateLimited } from '@/lib/utils/api-response'
import { sanitizeInput } from '@/lib/utils/sanitize'
import { openai, openaiAvailable, env as openaiEnv } from '@/lib/ai/openai'
import { logError } from '@/lib/audit/logger'
import {
  checkRateLimit,
  extractClientIp,
  RATE_LIMIT_PRESETS,
} from '@/lib/security/rate-limit'
import { resolveIdentity } from '@/lib/auth/identity'
import { consumeQuota } from '@/lib/quota/tracker'

type Lang = 'en' | 'zh' | 'ja'

function normalizeLang(v: unknown): Lang {
  return v === 'zh' || v === 'ja' ? v : 'en'
}

const SYSTEM_PROMPT = `You are a document-vision assistant for a multilingual Japan-living support system.
The user uploads a photo (rental contract, utility bill, city-office letter, visa document, street signage, official form).
Your job:
1. OCR-extract the visible text faithfully. Preserve the original language.
2. Infer what the user most likely wants to ask ("suggested_query") — one concise question in the user's preferred language.
3. Classify the document intent in one short English phrase (e.g. "rental_contract", "utility_bill", "visa_form", "city_office_notice").
Return strict JSON with keys: extracted_text, suggested_query, detected_intent, language.`

interface VisionResult {
  extractedText: string
  suggestedQuery: string
  detectedIntent: string
  language: Lang
}

function fallbackResult(hint: string, language: Lang): VisionResult {
  const base =
    language === 'zh'
      ? '（图片识别暂不可用，请用文字描述您的问题。）'
      : language === 'ja'
        ? '（画像認識は現在ご利用いただけません。テキストでご質問ください。）'
        : '(Image recognition is currently unavailable. Please describe your question in text.)'
  return {
    extractedText: hint ? `${hint}\n\n${base}` : base,
    suggestedQuery: hint || base,
    detectedIntent: 'unknown',
    language,
  }
}

async function callVision(
  imageUrl: string,
  hint: string,
  language: Lang,
): Promise<VisionResult> {
  if (!openai || !openaiAvailable) throw new Error('openai_unavailable')

  // Use the Responses API so we stay consistent with runUnderstanding.
  const resp = await openai.responses.create({
    model: openaiEnv.OPENAI_MODEL,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: SYSTEM_PROMPT }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Preferred output language: ${language}\nUser hint: ${hint || '(none)'}\nReturn strict JSON only.`,
          },
          { type: 'input_image', image_url: imageUrl, detail: 'auto' },
        ],
      },
    ],
    text: { format: { type: 'json_object' } },
  })

  const raw = (resp as { output_text?: string }).output_text ?? ''
  if (!raw) throw new Error('empty_vision_response')
  const parsed = JSON.parse(raw) as {
    extracted_text?: string
    suggested_query?: string
    detected_intent?: string
    language?: string
  }
  return {
    extractedText: String(parsed.extracted_text || '').slice(0, 4000),
    suggestedQuery: String(parsed.suggested_query || '').slice(0, 500),
    detectedIntent: String(parsed.detected_intent || 'unknown').slice(0, 80),
    language: normalizeLang(parsed.language ?? language),
  }
}

export async function POST(req: NextRequest) {
  // Per-IP rate limit — AI-consuming endpoint, use "auth" preset (10 req/min).
  const rl = checkRateLimit(
    `vision-extract:${extractClientIp(req.headers)}`,
    RATE_LIMIT_PRESETS.auth,
  );
  if (!rl.allowed) {
    return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));
  }

  // Quota enforcement — only when OpenAI vision is actually enabled.
  if (openaiEnv.ENABLE_IMAGE_INPUT && openaiAvailable) {
    const identity = await resolveIdentity();
    const status = await consumeQuota(identity.uid, identity.isAuthenticated, 'en');
    if (status.blocked) {
      return fail("quota_exceeded", 429, "QUOTA_EXCEEDED");
    }
  }

  const startedAt = Date.now()
  let hint = ''
  let language: Lang = 'en'
  let imageUrl = ''

  try {
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      hint = sanitizeInput(String(form.get('hint') || ''), 500)
      language = normalizeLang(form.get('language'))

      if (!(file instanceof File)) {
        return fail('file is required')
      }
      const buf = Buffer.from(await file.arrayBuffer())
      const mime = file.type || 'image/png'
      imageUrl = `data:${mime};base64,${buf.toString('base64')}`
    } else {
      const body = await req.json().catch(() => ({}))
      hint = sanitizeInput(String(body.hint || ''), 500)
      language = normalizeLang(body.language)
      const base64 = String(body.imageBase64 || '')
      const mime = String(body.mimeType || 'image/png')
      if (!base64) {
        return fail('imageBase64 or multipart file is required')
      }
      imageUrl = base64.startsWith('data:')
        ? base64
        : `data:${mime};base64,${base64}`
    }

    if (!openaiEnv.ENABLE_IMAGE_INPUT || !openaiAvailable) {
      const result = fallbackResult(hint, language)
      return ok({
        ...result,
        source: 'fallback',
        debug: { latencyMs: Date.now() - startedAt, reason: 'vision_disabled' },
      })
    }

    try {
      const result = await callVision(imageUrl, hint, language)
      return ok({
        ...result,
        source: 'openai',
        debug: { latencyMs: Date.now() - startedAt },
      })
    } catch (err) {
      logError('vision_extract_openai_error', err)
      const result = fallbackResult(hint, language)
      return ok({
        ...result,
        source: 'fallback',
        debug: {
          latencyMs: Date.now() - startedAt,
          reason: err instanceof Error ? err.message : 'openai_error',
        },
      })
    }
  } catch (error) {
    logError('vision_extract_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}
