/**
 * lib/ai/generate-stream.ts — Streaming variant of renderFinalAnswer.
 *
 * V12 latency sprint: streams LLM tokens via an async generator so the
 * SSE endpoint can push them to the client as they arrive (TTFT < 800ms).
 *
 * Falls back to the non-streaming renderFinalAnswer if OpenAI is unavailable.
 */

import { openai, env, openaiAvailable } from "@/lib/ai/openai";
import { RENDERING_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { logError } from "@/lib/audit/logger";
import type { Language, AnswerMode } from "@/lib/ai/types";
import type { RetrievedForRender } from "@/lib/ai/generate";

export interface StreamRenderInput {
  userMessage: string;
  language: Language;
  mode: AnswerMode;
  riskLevel: "low" | "medium" | "high";
  missingInfo: string[];
  retrieved: RetrievedForRender[];
}

const LANG_NAME: Record<Language, string> = {
  en: "English",
  zh: "Simplified Chinese (中文简体)",
  ja: "Japanese (日本語)",
};

function buildUserPrompt(input: StreamRenderInput): string {
  const grounding =
    input.retrieved.length > 0
      ? input.retrieved
          .map(
            (r, i) =>
              `[Source ${i + 1}: ${r.title}]\n${r.content}`
          )
          .join("\n\n")
      : "(No retrieved sources — use general knowledge with appropriate caveats.)";

  return [
    `ROUTING DECISION (hard constraint):`,
    `  mode = ${input.mode}`,
    `  riskLevel = ${input.riskLevel}`,
    `  missingInfo = ${JSON.stringify(input.missingInfo)}`,
    ``,
    `REPLY LANGUAGE: ${LANG_NAME[input.language]}`,
    ``,
    `USER QUESTION:`,
    input.userMessage,
    ``,
    `GROUNDING MATERIAL:`,
    grounding,
  ].join("\n");
}

/**
 * Yields string tokens as they arrive from the OpenAI Responses API stream.
 * The caller (SSE route) wraps each yield into an SSE `data:` frame.
 *
 * If OpenAI is unavailable, yields the full fallback answer as a single chunk.
 */
export async function* streamRenderAnswer(
  input: StreamRenderInput
): AsyncGenerator<string, void, unknown> {
  if (!openai || !openaiAvailable) {
    // Fallback: yield the whole answer at once
    const fallbackByLang: Record<Language, string> = {
      zh: "抱歉，目前无法提供确切回答。请提供更多细节或联系人工帮助。",
      ja: "申し訳ありません、現時点で確実にお答えできる情報がありません。もう少し詳しく教えてください。",
      en: "Sorry, I don't have a verified answer for this yet. Could you share more detail?",
    };
    yield fallbackByLang[input.language] ?? fallbackByLang.en;
    return;
  }

  try {
    const stream = await openai.responses.create({
      model: env.OPENAI_MODEL,
      stream: true,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: RENDERING_SYSTEM_PROMPT }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: buildUserPrompt(input) }],
        },
      ],
    });

    for await (const event of stream) {
      // The Responses API streaming emits events with type 'response.output_text.delta'
      if (event.type === "response.output_text.delta") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const delta = (event as any).delta as string | undefined;
        if (delta) yield delta;
      }
    }
  } catch (error) {
    logError("openai_stream_error", error);
    // Yield fallback on error
    yield "Sorry, something went wrong. Please try again or contact support.";
  }
}
