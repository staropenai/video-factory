/**
 * POST /api/transcribe — audio → text via OpenAI transcription.
 *
 * Phase 2 voice MVP (§5 / §6.1 of the CEO iteration plan). The frontend
 * records a short clip (webm/mp4/m4a/wav/mp3) and POSTs it here. We run
 * the configured transcription model (default `gpt-4o-mini-transcribe`)
 * and return plain text the user can feed into /api/router.
 *
 * Request (multipart/form-data):
 *   file: File
 *   language?: 'en'|'zh'|'ja'   — optional hint
 *
 * Response:
 *   {
 *     ok: true,
 *     text: string,
 *     language: 'en'|'zh'|'ja',
 *     source: 'openai' | 'fallback',
 *     debug: { latencyMs }
 *   }
 *
 * Fallback: if audio is disabled or OpenAI errors, return empty text and
 * source='fallback' so the UI can prompt the user to type instead. Never
 * crash.
 */

import { NextRequest } from 'next/server'
import { ok, fail, rateLimited } from '@/lib/utils/api-response'
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

export async function POST(req: NextRequest) {
  // Per-IP rate limit — AI-consuming endpoint, use "auth" preset (10 req/min).
  const rl = checkRateLimit(
    `transcribe:${extractClientIp(req.headers)}`,
    RATE_LIMIT_PRESETS.auth,
  );
  if (!rl.allowed) {
    return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));
  }

  // Quota enforcement — only when OpenAI audio is actually enabled.
  if (openaiEnv.ENABLE_AUDIO_INPUT && openaiAvailable && openai) {
    const identity = await resolveIdentity();
    const status = await consumeQuota(identity.uid, identity.isAuthenticated, 'en');
    if (status.blocked) {
      return fail("quota_exceeded", 429, "QUOTA_EXCEEDED");
    }
  }

  const startedAt = Date.now()
  try {
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return fail('multipart/form-data required')
    }

    const form = await req.formData()
    const file = form.get('file')
    const language = normalizeLang(form.get('language'))

    if (!(file instanceof File)) {
      return fail('file is required')
    }

    if (!openaiEnv.ENABLE_AUDIO_INPUT || !openaiAvailable || !openai) {
      return ok({
        text: '',
        language,
        source: 'fallback',
        debug: {
          latencyMs: Date.now() - startedAt,
          reason: 'audio_disabled',
        },
      })
    }

    try {
      const resp = await openai.audio.transcriptions.create({
        file,
        model: openaiEnv.OPENAI_TRANSCRIBE_MODEL,
        // OpenAI expects ISO 639-1. Our Lang already fits.
        language,
      })
      const text = String((resp as { text?: string }).text || '').trim()
      return ok({
        text,
        language,
        source: 'openai',
        debug: { latencyMs: Date.now() - startedAt },
      })
    } catch (err) {
      logError('transcribe_openai_error', err)
      return ok({
        text: '',
        language,
        source: 'fallback',
        debug: {
          latencyMs: Date.now() - startedAt,
          reason: err instanceof Error ? err.message : 'openai_error',
        },
      })
    }
  } catch (error) {
    logError('transcribe_error', error)
    return fail(error instanceof Error ? error.message : 'Internal error', 500)
  }
}
