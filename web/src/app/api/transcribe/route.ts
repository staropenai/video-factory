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

import { NextRequest, NextResponse } from 'next/server'
import { openai, openaiAvailable, env as openaiEnv } from '@/lib/ai/openai'
import { logError } from '@/lib/audit/logger'

type Lang = 'en' | 'zh' | 'ja'

function normalizeLang(v: unknown): Lang {
  return v === 'zh' || v === 'ja' ? v : 'en'
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  try {
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { ok: false, error: 'multipart/form-data required' },
        { status: 400 },
      )
    }

    const form = await req.formData()
    const file = form.get('file')
    const language = normalizeLang(form.get('language'))

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: 'file is required' },
        { status: 400 },
      )
    }

    if (!openaiEnv.ENABLE_AUDIO_INPUT || !openaiAvailable || !openai) {
      return NextResponse.json({
        ok: true,
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
      return NextResponse.json({
        ok: true,
        text,
        language,
        source: 'openai',
        debug: { latencyMs: Date.now() - startedAt },
      })
    } catch (err) {
      logError('transcribe_openai_error', err)
      return NextResponse.json({
        ok: true,
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
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 500 },
    )
  }
}
