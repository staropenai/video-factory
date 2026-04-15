/**
 * OpenAI client + env config — single source of truth for the AI layer.
 *
 * Implements the env contract from openai_router_production_design.md §4.
 *
 * - Server-side only. Never imported from client components.
 * - If OPENAI_API_KEY is missing OR ENABLE_OPENAI=false, `openai` is null and
 *   the pipeline degrades to deterministic fallback (see fallback.ts).
 */

import OpenAI from 'openai'

export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  OPENAI_TRANSCRIBE_MODEL:
    process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
  OPENAI_TIMEOUT_MS: Number(process.env.OPENAI_TIMEOUT_MS || 15000),
  OPENAI_MAX_RETRIES: Number(process.env.OPENAI_MAX_RETRIES || 1),
  ENABLE_OPENAI: process.env.ENABLE_OPENAI !== 'false',
  ENABLE_IMAGE_INPUT: process.env.ENABLE_IMAGE_INPUT === 'true',
  ENABLE_AUDIO_INPUT: process.env.ENABLE_AUDIO_INPUT === 'true',
  LOG_PII: process.env.LOG_PII === 'true',
} as const

export const openaiAvailable: boolean = Boolean(env.OPENAI_API_KEY) && env.ENABLE_OPENAI

export const openai: OpenAI | null = openaiAvailable
  ? new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      timeout: env.OPENAI_TIMEOUT_MS,
      maxRetries: env.OPENAI_MAX_RETRIES,
    })
  : null
