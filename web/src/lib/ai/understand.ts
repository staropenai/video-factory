/**
 * AI Understanding Layer — OpenAI Responses API.
 *
 * Implements openai_router_production_design.md §3.1, §6, §15.
 *
 * One call per request. Strict JSON schema. Never answers the user — only
 * parses the query into a structured object the rest of the pipeline consumes.
 *
 * On any failure (no key, timeout, 429/5xx, JSON parse error after retries)
 * we degrade to classifyFallback() so the router still responds.
 */

import { openai, env, openaiAvailable } from '@/lib/ai/openai'
import { UNDERSTANDING_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { classifyFallback } from '@/lib/ai/fallback'
import { logError } from '@/lib/audit/logger'
import type { AIUnderstandingResult, UnderstandingResult } from '@/lib/ai/types'

/**
 * JSON Schema for OpenAI Responses API `text.format.json_schema`.
 *
 * `strict: true` means OpenAI guarantees the model output validates against
 * this schema (or it errors). Every property must appear in `required` and
 * `additionalProperties` must be false.
 */
const UNDERSTANDING_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    language: { type: 'string', enum: ['zh', 'ja', 'en'] },
    intent: { type: 'string' },
    category: {
      type: 'string',
      enum: [
        'renting',
        'home_buying',
        'visa',
        'daily_life',
        'legal',
        'tax',
        'billing',
        'contract',
        'other',
      ],
    },
    subtopic: { type: ['string', 'null'] },
    riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
    missingInfo: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 3,
    },
    searchQueries: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 5,
    },
    shouldOfficialOnly: { type: 'boolean' },
    shouldHandoff: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    entities: {
      type: 'object',
      additionalProperties: false,
      properties: {
        location: { type: ['string', 'null'] },
        documentType: { type: ['string', 'null'] },
        deadline: { type: ['string', 'null'] },
      },
      required: ['location', 'documentType', 'deadline'],
    },
  },
  required: [
    'language',
    'intent',
    'category',
    'subtopic',
    'riskLevel',
    'missingInfo',
    'searchQueries',
    'shouldOfficialOnly',
    'shouldHandoff',
    'confidence',
    'entities',
  ],
} as const

export async function runUnderstanding(message: string): Promise<UnderstandingResult> {
  const started = Date.now()

  if (!openai || !openaiAvailable) {
    return {
      understanding: classifyFallback(message),
      source: 'fallback',
      latencyMs: Date.now() - started,
      error: 'OPENAI_UNAVAILABLE: missing OPENAI_API_KEY or ENABLE_OPENAI=false',
    }
  }

  try {
    // OpenAI Responses API — structured JSON output via json_schema.
    // See openai_router_production_design.md §15.
    const response = await openai.responses.create({
      model: env.OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: UNDERSTANDING_SYSTEM_PROMPT }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: message.slice(0, 1500) }],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'router_understanding',
          strict: true,
          schema: UNDERSTANDING_JSON_SCHEMA,
        },
      },
    })

    const jsonText = (response as { output_text?: string }).output_text
    if (!jsonText) throw new Error('OpenAI response missing output_text')
    const parsed = JSON.parse(jsonText) as AIUnderstandingResult

    return {
      understanding: parsed,
      source: 'openai',
      latencyMs: Date.now() - started,
      model: env.OPENAI_MODEL,
    }
  } catch (error) {
    logError('openai_understand_error', error)
    return {
      understanding: classifyFallback(message),
      source: 'fallback',
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'unknown OpenAI error',
    }
  }
}
