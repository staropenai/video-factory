/**
 * AI Response Rendering Layer — OpenAI Responses API.
 *
 * Implements openai_router_production_design.md §3.1, §9, §17.
 *
 * Called AFTER retrieval and the deterministic routing decision. Produces a
 * single same-language answer string. The decision (mode + missingInfo +
 * allowedSources) is passed in as a hard constraint — this layer cannot
 * loosen it.
 *
 * Falls back to a small templated answer if OpenAI is unavailable.
 */

import { openai, env, openaiAvailable } from '@/lib/ai/openai'
import { RENDERING_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { logError } from '@/lib/audit/logger'
import type { AnswerMode, Language, RenderResult } from '@/lib/ai/types'
import type { FaqEntry } from '@/lib/knowledge/seed'

export type RetrievedForRender = {
  id: string
  title: string
  content: string
  sourceUrl?: string
}

export type RenderInput = {
  userMessage: string
  language: Language
  mode: AnswerMode
  riskLevel: 'low' | 'medium' | 'high'
  missingInfo: string[]
  retrieved: RetrievedForRender[]
}

const LANG_NAME: Record<Language, string> = {
  en: 'English',
  zh: 'Simplified Chinese (中文简体)',
  ja: 'Japanese (日本語)',
}

/**
 * Build a structured user prompt that gives the model: the routing decision
 * (as a hard constraint), the user's message, the language requirement, and
 * the retrieved grounding material.
 */
function buildUserPrompt(input: RenderInput): string {
  const grounding =
    input.retrieved.length > 0
      ? input.retrieved
          .slice(0, 3)
          .map(
            (r, i) =>
              `[SOURCE ${i + 1}] id=${r.id}\ntitle: ${r.title}\ncontent: ${r.content}${
                r.sourceUrl ? `\nurl: ${r.sourceUrl}` : ''
              }`,
          )
          .join('\n\n')
      : '(no retrieval results — you must rely on mode guidance only)'

  const missing =
    input.missingInfo.length > 0
      ? input.missingInfo.map((m) => `- ${m}`).join('\n')
      : '(none)'

  return `User message (language=${input.language}, mode=${input.mode}, risk=${input.riskLevel}):
"""${input.userMessage}"""

Missing info you should ask about (only used if mode=clarify):
${missing}

Grounding material (use ONLY these facts when mode=normal):
${grounding}

Write the final answer in ${LANG_NAME[input.language]}. Plain text. Obey the routing mode.`
}

/**
 * Map a matched FaqEntry to the render-friendly shape used by both the OpenAI
 * call and the deterministic fallback.
 */
export function faqToRetrieved(faq: FaqEntry, lang: Language): RetrievedForRender {
  const lines = [
    `${faq.standard_answer[lang]}`,
    `Confirm first: ${faq.next_step_confirm[lang]}`,
    `Prepare: ${faq.next_step_prepare[lang]}`,
    `Contact: ${faq.next_step_contact[lang]}`,
  ]
  if (faq.next_step_warning) lines.push(`Warning: ${faq.next_step_warning[lang]}`)
  return {
    id: faq.id,
    title: faq.representative_title[lang],
    content: lines.join('\n'),
  }
}

/**
 * Last-resort templated answer in the user's language. Used when OpenAI is
 * unreachable. Mirrors the four routing modes; intentionally short.
 */
function fallbackRender(input: RenderInput): string {
  const top = input.retrieved[0]
  const lang = input.language

  if (input.mode === 'handoff') {
    if (lang === 'zh')
      return '这件事看起来需要专业人士帮你判断。先不要在压力下签字、付款或同意任何条件。请尽快联系免费法律咨询、消费者热线或所在自治体的相谈窗口。'
    if (lang === 'ja')
      return '今は無理にサインや支払いに応じないでください。無料法律相談や消費生活センター、自治体の相談窓口に早めに連絡してください。'
    return "This needs a human you can trust. Don't sign, pay, or agree to anything under pressure. Contact a free legal consultation service, a consumer hotline, or your city's residents' help desk as soon as you can."
  }

  if (input.mode === 'official_only') {
    if (lang === 'zh')
      return '这类问题（签证 / 税务 / 法律 / 政府手续）每个人的情况不同，最终结论必须以官方为准。建议你直接联系所在自治体、入管或税务署确认。'
    if (lang === 'ja')
      return 'このような手続き（ビザ・税・法律・行政）はケースごとに条件が異なります。必ず役所・入管・税務署など公式の窓口で確認してください。'
    return 'This kind of question (visa / tax / legal / government procedure) varies case by case, and the final answer must come from the official source. Please confirm directly with your city office, immigration, or the tax office.'
  }

  if (input.mode === 'clarify') {
    const ask =
      input.missingInfo.length > 0
        ? input.missingInfo.slice(0, 3).join(' / ')
        : ''
    if (lang === 'zh')
      return `想准确帮你，需要再了解几点：${ask || '所在城市、目前状态、希望什么时候解决'}。可以补充一下吗？`
    if (lang === 'ja')
      return `正確にお答えするために、もう少し教えてください：${ask || 'お住まいの市区町村、現在の状況、いつまでに解決したいか'}。`
    return `To help precisely, I need a little more: ${ask || 'your city, your current status, and your timeline'}. Could you add that?`
  }

  // mode === 'normal'
  if (top) {
    if (lang === 'zh') return `根据我们已有的信息：${top.content}`
    if (lang === 'ja') return `こちらの情報を参考にしてください：${top.content}`
    return `Based on what we have on file: ${top.content}`
  }
  if (lang === 'zh') return '抱歉，目前没有足够的资料给你确切答案。可以再补充一些细节吗？'
  if (lang === 'ja') return '申し訳ありません、現時点で確実にお答えできる情報がありません。もう少し詳しく教えてください。'
  return "Sorry, I don't have a verified answer for this yet. Could you share a bit more detail?"
}

export async function renderFinalAnswer(input: RenderInput): Promise<RenderResult> {
  const started = Date.now()

  if (!openai || !openaiAvailable) {
    return {
      answer: fallbackRender(input),
      source: 'fallback',
      latencyMs: Date.now() - started,
      error: 'OPENAI_UNAVAILABLE',
    }
  }

  try {
    const response = await openai.responses.create({
      model: env.OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: RENDERING_SYSTEM_PROMPT }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: buildUserPrompt(input) }],
        },
      ],
    })

    const text = (response as { output_text?: string }).output_text?.trim()
    if (!text) throw new Error('OpenAI response missing output_text')

    return {
      answer: text,
      source: 'openai',
      latencyMs: Date.now() - started,
      model: env.OPENAI_MODEL,
    }
  } catch (error) {
    logError('openai_render_error', error)
    return {
      answer: fallbackRender(input),
      source: 'fallback',
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'unknown OpenAI error',
    }
  }
}
