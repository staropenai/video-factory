/**
 * lib/ai/__tests__/generate-stream.test.ts
 *
 * Unit tests for the V12 streaming async generator.
 */

import type { StreamRenderInput } from "../generate-stream";

// ── Mocks ─────────────────────────────────────────────────────────────
const mockCreate = jest.fn();

jest.mock("@/lib/ai/openai", () => ({
  openai: { responses: { create: (...args: unknown[]) => mockCreate(...args) } },
  openaiAvailable: true,
  env: { OPENAI_MODEL: "gpt-4o-mini" },
}));

jest.mock("@/lib/ai/prompts", () => ({
  RENDERING_SYSTEM_PROMPT: "You are a helpful assistant.",
}));

jest.mock("@/lib/audit/logger", () => ({
  logError: jest.fn(),
}));

// Import after mocks are wired
import { streamRenderAnswer } from "../generate-stream";
import { logError } from "@/lib/audit/logger";

// ── Helpers ───────────────────────────────────────────────────────────
function makeInput(overrides: Partial<StreamRenderInput> = {}): StreamRenderInput {
  return {
    userMessage: "What is the deposit amount?",
    language: "en",
    mode: "normal",
    riskLevel: "low",
    missingInfo: [],
    retrieved: [],
    ...overrides,
  };
}

/** Simulate an OpenAI Responses API stream with given deltas. */
function fakeStream(deltas: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const d of deltas) {
        yield { type: "response.output_text.delta", delta: d };
      }
    },
  };
}

/** Collect all tokens from the async generator. */
async function collectTokens(gen: AsyncGenerator<string>): Promise<string[]> {
  const tokens: string[] = [];
  for await (const t of gen) tokens.push(t);
  return tokens;
}

// ── Tests ─────────────────────────────────────────────────────────────
describe("lib/ai/generate-stream", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("streamRenderAnswer — normal streaming", () => {
    it("yields tokens from the OpenAI stream", async () => {
      mockCreate.mockResolvedValue(fakeStream(["Hello", " world", "!"]));

      const tokens = await collectTokens(streamRenderAnswer(makeInput()));
      expect(tokens).toEqual(["Hello", " world", "!"]);
    });

    it("concatenated tokens form the complete answer", async () => {
      const deltas = ["The", " deposit", " is", " 2", " months."];
      mockCreate.mockResolvedValue(fakeStream(deltas));

      const tokens = await collectTokens(streamRenderAnswer(makeInput()));
      expect(tokens.join("")).toBe("The deposit is 2 months.");
    });

    it("skips non-delta events", async () => {
      const stream = {
        async *[Symbol.asyncIterator]() {
          yield { type: "response.created" };
          yield { type: "response.output_text.delta", delta: "token" };
          yield { type: "response.completed" };
        },
      };
      mockCreate.mockResolvedValue(stream);

      const tokens = await collectTokens(streamRenderAnswer(makeInput()));
      expect(tokens).toEqual(["token"]);
    });

    it("skips delta events with undefined delta", async () => {
      const stream = {
        async *[Symbol.asyncIterator]() {
          yield { type: "response.output_text.delta", delta: undefined };
          yield { type: "response.output_text.delta", delta: "ok" };
        },
      };
      mockCreate.mockResolvedValue(stream);

      const tokens = await collectTokens(streamRenderAnswer(makeInput()));
      expect(tokens).toEqual(["ok"]);
    });

    it("yields empty result for empty stream", async () => {
      mockCreate.mockResolvedValue(fakeStream([]));

      const tokens = await collectTokens(streamRenderAnswer(makeInput()));
      expect(tokens).toEqual([]);
    });

    it("passes model and system prompt to OpenAI", async () => {
      mockCreate.mockResolvedValue(fakeStream(["hi"]));

      await collectTokens(streamRenderAnswer(makeInput()));

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe("gpt-4o-mini");
      expect(callArgs.stream).toBe(true);
      expect(callArgs.input[0].role).toBe("system");
      expect(callArgs.input[1].role).toBe("user");
    });
  });

  describe("streamRenderAnswer — error handling", () => {
    it("yields fallback and logs error when OpenAI throws", async () => {
      mockCreate.mockRejectedValue(new Error("API rate limited"));

      const tokens = await collectTokens(streamRenderAnswer(makeInput()));

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toContain("Sorry");
      expect(logError).toHaveBeenCalledWith("openai_stream_error", expect.any(Error));
    });

    it("yields language-appropriate fallback on error for English", async () => {
      mockCreate.mockRejectedValue(new Error("fail"));

      const tokens = await collectTokens(streamRenderAnswer(makeInput({ language: "en" })));
      expect(tokens[0]).toContain("Sorry");
    });
  });

  describe("streamRenderAnswer — fallback when OpenAI unavailable", () => {
    it("yields single-chunk fallback in Chinese", async () => {
      // Re-mock openai module to simulate unavailable
      jest.resetModules();
      jest.doMock("@/lib/ai/openai", () => ({
        openai: null,
        openaiAvailable: false,
        env: { OPENAI_MODEL: "gpt-4o-mini" },
      }));
      jest.doMock("@/lib/ai/prompts", () => ({
        RENDERING_SYSTEM_PROMPT: "test",
      }));
      jest.doMock("@/lib/audit/logger", () => ({
        logError: jest.fn(),
      }));

      const { streamRenderAnswer: streamFn } = await import("../generate-stream");

      const tokens = await collectTokens(streamFn(makeInput({ language: "zh" })));
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toContain("抱歉");
    });

    it("yields single-chunk fallback in Japanese", async () => {
      jest.resetModules();
      jest.doMock("@/lib/ai/openai", () => ({
        openai: null,
        openaiAvailable: false,
        env: { OPENAI_MODEL: "gpt-4o-mini" },
      }));
      jest.doMock("@/lib/ai/prompts", () => ({
        RENDERING_SYSTEM_PROMPT: "test",
      }));
      jest.doMock("@/lib/audit/logger", () => ({
        logError: jest.fn(),
      }));

      const { streamRenderAnswer: streamFn } = await import("../generate-stream");

      const tokens = await collectTokens(streamFn(makeInput({ language: "ja" })));
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toContain("申し訳");
    });
  });

  describe("prompt construction", () => {
    it("includes retrieved sources in user prompt", async () => {
      mockCreate.mockResolvedValue(fakeStream(["ok"]));

      await collectTokens(
        streamRenderAnswer(
          makeInput({
            retrieved: [
              { id: "faq-1", title: "Deposit FAQ", content: "Deposit is 2 months." },
              { id: "faq-2", title: "Move-in FAQ", content: "Move-in costs vary." },
            ],
          })
        )
      );

      const userPromptContent = mockCreate.mock.calls[0][0].input[1].content[0].text;
      expect(userPromptContent).toContain("Source 1: Deposit FAQ");
      expect(userPromptContent).toContain("Source 2: Move-in FAQ");
      expect(userPromptContent).toContain("Deposit is 2 months.");
    });

    it("includes routing decision constraints", async () => {
      mockCreate.mockResolvedValue(fakeStream(["ok"]));

      await collectTokens(
        streamRenderAnswer(
          makeInput({ mode: "official_only", riskLevel: "high" })
        )
      );

      const userPromptContent = mockCreate.mock.calls[0][0].input[1].content[0].text;
      expect(userPromptContent).toContain("mode = official_only");
      expect(userPromptContent).toContain("riskLevel = high");
    });

    it("includes language directive", async () => {
      mockCreate.mockResolvedValue(fakeStream(["ok"]));

      await collectTokens(streamRenderAnswer(makeInput({ language: "ja" })));

      const userPromptContent = mockCreate.mock.calls[0][0].input[1].content[0].text;
      expect(userPromptContent).toContain("Japanese");
    });
  });
});
