/**
 * app/api/router/stream/__tests__/route.test.ts
 *
 * Integration tests for POST /api/router/stream (V12 SSE endpoint).
 *
 * Tests the three response paths:
 *   1. Tier A/B shortcut → JSON
 *   2. Handoff/escalation → JSON
 *   3. Tier C → SSE stream
 *   +  Error handling & input validation
 */

import { NextRequest } from "next/server";
import { __clearStoreForTests } from "@/lib/security/rate-limit";

// ── Mocks ─────────────────────────────────────────────────────────────

jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: () => undefined,
    })
  ),
}));

// Understanding mock
const mockUnderstanding = {
  understanding: {
    intent: "question",
    language: "en" as const,
    riskLevel: "low" as const,
    shouldHandoff: false,
    shouldOfficialOnly: false,
    missingInfo: [],
    searchQueries: [],
  },
};
jest.mock("@/lib/ai/understand", () => ({
  runUnderstanding: jest.fn(() => Promise.resolve(mockUnderstanding)),
}));

jest.mock("@/lib/ai/understanding-cache", () => ({
  getCachedUnderstanding: jest.fn(() => null),
  setCachedUnderstanding: jest.fn(),
}));

// Retrieval mock — configurable per test
let mockRetrievalResult = {
  matches: [] as Array<Record<string, unknown>>,
  summary: {
    shortcut: "none" as string,
    topScore: 0,
  },
};
jest.mock("@/lib/knowledge/retrieve", () => ({
  retrieveFromLocal: jest.fn(() => mockRetrievalResult),
  retrieveFromLocalMulti: jest.fn(() => mockRetrievalResult),
}));

// Route decision mock — configurable per test
let mockDecision = {
  answerMode: "direct_answer" as string,
  riskLevel: "low" as string,
  confidenceBand: "high" as string,
  shouldEscalate: false,
  decisionReason: "test",
  selectedRuleKeys: ["test-rule"],
};
jest.mock("@/lib/router/decide", () => ({
  decideRoute: jest.fn(() => mockDecision),
}));

jest.mock("@/lib/validation/guardrails", () => ({
  validateDecision: jest.fn((d: unknown) => d),
}));

// Stream generator mock
const mockStreamTokens = jest.fn();
jest.mock("@/lib/ai/generate-stream", () => ({
  streamRenderAnswer: jest.fn((...args: unknown[]) => mockStreamTokens(...args)),
}));

jest.mock("@/lib/ai/generate", () => ({
  faqToRetrieved: jest.fn((m: Record<string, unknown>, lang: string) => ({
    title: (m.representative_title as Record<string, string>)?.[lang] ?? "",
    content: (m.standard_answer as Record<string, string>)?.[lang] ?? "",
  })),
}));

// Audit mocks (all no-ops)
jest.mock("@/lib/audit/logger", () => ({
  logRouterDecision: jest.fn(),
  logError: jest.fn(),
}));

jest.mock("@/lib/db/tables", () => ({
  insertUserQuery: jest.fn(() => ({ id: "test-query-id" })),
  insertHandoff: jest.fn(),
  insertEvent: jest.fn(),
}));

jest.mock("@/lib/security/prompt-injection", () => ({
  checkPromptInjection: jest.fn(() => ({
    detected: false,
    highestSeverity: "none",
    matchedPatterns: [],
  })),
  sanitizeForLog: jest.fn((s: string) => s),
}));

jest.mock("@/lib/security/event-log", () => ({
  buildSecurityEvent: jest.fn(),
  classifySecuritySeverity: jest.fn(),
  logSecurityEvent: jest.fn(),
}));

jest.mock("@/lib/auth/identity", () => ({
  resolveIdentity: jest.fn(() => Promise.resolve({
    uid: "test-uid",
    isAuthenticated: false,
    isNewUid: false,
  })),
}));

jest.mock("@/lib/utils/dev-log", () => ({
  devLogJson: jest.fn(),
}));

jest.mock("@/app/api/router/quota-gate", () => ({
  validateMessageLength: jest.fn(() => ({ ok: true })),
  enforceQuota: jest.fn(() => Promise.resolve({ ok: true })),
  enforceRateLimit: jest.fn(() => ({ ok: true })),
}));

jest.mock("@/lib/security/rate-limit", () => ({
  extractClientIp: jest.fn(() => "127.0.0.1"),
  __clearStoreForTests: jest.fn(),
}));

// Import route handler after all mocks
import { POST } from "../route";

// ── Helpers ───────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/router/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Unwrap standardized response: { success, data } → data */
async function unwrapJson(res: Response) {
  const json = await res.json();
  return json.data ?? json;
}

/** Read an SSE Response body into parsed events. */
async function readSSE(response: Response): Promise<Array<Record<string, unknown>>> {
  const text = await response.text();
  const events: Array<Record<string, unknown>> = [];
  for (const frame of text.split("\n\n")) {
    const line = frame.trim();
    if (!line.startsWith("data: ")) continue;
    try {
      events.push(JSON.parse(line.slice(6)));
    } catch {
      // skip
    }
  }
  return events;
}

function makeFaqMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "faq-deposit",
    category: "rent_prep",
    subtopic: "deposit",
    representative_title: { en: "About deposits", ja: "敷金について", zh: "关于押金" },
    standard_answer: { en: "Deposit is 1-2 months.", ja: "敷金は1〜2ヶ月分です。", zh: "押金为1-2个月。" },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("POST /api/router/stream", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to defaults
    mockRetrievalResult = {
      matches: [],
      summary: { shortcut: "none", topScore: 0 },
    };
    mockDecision = {
      answerMode: "direct_answer",
      riskLevel: "low",
      confidenceBand: "high",
      shouldEscalate: false,
      decisionReason: "test",
      selectedRuleKeys: ["test-rule"],
    };
  });

  // ── Input validation ──────────────────────────────────────────────

  describe("input validation", () => {
    it("rejects empty message", async () => {
      const res = await POST(makeRequest({ message: "" }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("message is required");
    });

    it("rejects missing message field", async () => {
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(400);
    });

    it("trims whitespace-only messages", async () => {
      const res = await POST(makeRequest({ message: "   " }));
      expect(res.status).toBe(400);
    });
  });

  // ── Tier A/B shortcut path ────────────────────────────────────────

  describe("Tier A/B shortcut → JSON", () => {
    beforeEach(() => {
      const match = makeFaqMatch();
      mockRetrievalResult = {
        matches: [match],
        summary: { shortcut: "tier_a_shortcut", topScore: 0.95 },
      };
      mockDecision = {
        answerMode: "direct_answer",
        riskLevel: "low",
        confidenceBand: "high",
        shouldEscalate: false,
        decisionReason: "exact match",
        selectedRuleKeys: ["exact-match"],
      };
    });

    it("returns JSON with content-type application/json", async () => {
      const res = await POST(makeRequest({ message: "What is the deposit?" }));
      expect(res.headers.get("content-type")).toContain("application/json");
    });

    it("returns tier A for tier_a_shortcut", async () => {
      const res = await POST(makeRequest({ message: "deposit" }));
      const data = await unwrapJson(res);
      expect(data.tier).toBe("A");
      expect(data.content).toBe("Deposit is 1-2 months.");
      expect(data.source).toBe("knowledge_base");
    });

    it("returns tier B for tier_b_shortcut", async () => {
      mockRetrievalResult.summary.shortcut = "tier_b_shortcut";
      const res = await POST(makeRequest({ message: "deposit" }));
      const data = await unwrapJson(res);
      expect(data.tier).toBe("B");
    });

    it("includes sources array", async () => {
      const res = await POST(makeRequest({ message: "deposit" }));
      const data = await unwrapJson(res);
      expect(data.sources).toHaveLength(1);
      expect(data.sources[0].id).toBe("faq-deposit");
    });

    it("includes debug metadata", async () => {
      const res = await POST(makeRequest({ message: "deposit" }));
      const data = await unwrapJson(res);
      expect(data.debug).toBeDefined();
      expect(data.debug.requestId).toBeDefined();
      expect(typeof data.debug.latencyMs).toBe("number");
    });
  });

  // ── Handoff / escalation ──────────────────────────────────────────

  describe("handoff/escalation → JSON", () => {
    beforeEach(() => {
      mockDecision = {
        answerMode: "handoff",
        riskLevel: "high",
        confidenceBand: "low",
        shouldEscalate: true,
        decisionReason: "Legal question",
        selectedRuleKeys: ["legal-handoff"],
      };
    });

    it("returns JSON with handoff flag", async () => {
      const res = await POST(makeRequest({ message: "I need a lawyer." }));
      const data = await unwrapJson(res);

      expect(data.handoff).toBe(true);
      expect(data.tier).toBe("L6");
      expect(data.content).toBeNull();
    });

    it("includes escalation reason", async () => {
      const res = await POST(makeRequest({ message: "Sue my landlord" }));
      const data = await unwrapJson(res);
      expect(data.reason).toContain("Legal question");
    });

    it("returns JSON content type, not SSE", async () => {
      const res = await POST(makeRequest({ message: "legal help" }));
      expect(res.headers.get("content-type")).toContain("application/json");
    });
  });

  // ── Tier C SSE streaming ──────────────────────────────────────────

  describe("Tier C → SSE stream", () => {
    beforeEach(() => {
      // No shortcut, no escalation → falls through to Tier C
      mockRetrievalResult = {
        matches: [],
        summary: { shortcut: "none", topScore: 0 },
      };
      mockDecision = {
        answerMode: "direct_answer",
        riskLevel: "low",
        confidenceBand: "medium",
        shouldEscalate: false,
        decisionReason: "no match",
        selectedRuleKeys: [],
      };
    });

    it("returns SSE content type with correct headers", async () => {
      mockStreamTokens.mockImplementation(async function* () {
        yield "Hello";
      });

      const res = await POST(makeRequest({ message: "Something complex" }));

      expect(res.headers.get("content-type")).toBe("text/event-stream");
      expect(res.headers.get("cache-control")).toBe("no-cache");
      expect(res.headers.get("x-accel-buffering")).toBe("no");
    });

    it("streams thinking → token → done events", async () => {
      mockStreamTokens.mockImplementation(async function* () {
        yield "Hello";
        yield " world";
      });

      const res = await POST(makeRequest({ message: "Tell me about Japan" }));
      const events = await readSSE(res);

      // First event: thinking
      expect(events[0]).toEqual({ type: "thinking" });

      // Token events
      const tokens = events.filter((e) => e.type === "token");
      expect(tokens).toHaveLength(2);
      expect(tokens[0].text).toBe("Hello");
      expect(tokens[1].text).toBe(" world");

      // Done event
      const done = events.find((e) => e.type === "done");
      expect(done).toBeDefined();
      expect(done!.tier).toBe("C");
    });

    it("includes sources and language in done event", async () => {
      mockStreamTokens.mockImplementation(async function* () {
        yield "Answer";
      });

      const res = await POST(makeRequest({ message: "Question" }));
      const events = await readSSE(res);
      const done = events.find((e) => e.type === "done");

      expect(done!.language).toBeDefined();
      expect(done!.sources).toBeDefined();
      expect(done!.debug).toBeDefined();
    });

    it("sends error event when stream generator throws", async () => {
      mockStreamTokens.mockImplementation(async function* () {
        yield "partial";
        throw new Error("OpenAI timeout");
      });

      const res = await POST(makeRequest({ message: "question" }));
      const events = await readSSE(res);

      const errorEvent = events.find((e) => e.type === "error");
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.message).toBe("Service temporarily unavailable");
    });

    it("handles empty stream (no tokens yielded)", async () => {
      mockStreamTokens.mockImplementation(async function* () {
        // yields nothing
      });

      const res = await POST(makeRequest({ message: "silence" }));
      const events = await readSSE(res);

      expect(events[0].type).toBe("thinking");
      const done = events.find((e) => e.type === "done");
      expect(done).toBeDefined();
    });
  });

  // ── Reconciliation ────────────────────────────────────────────────

  describe("decision reconciliation", () => {
    it("escalates to handoff when AI forces it", async () => {
      // AI understanding says shouldHandoff=true
      const { runUnderstanding } = require("@/lib/ai/understand");
      (runUnderstanding as jest.Mock).mockResolvedValueOnce({
        understanding: {
          intent: "complaint",
          language: "en",
          riskLevel: "high",
          shouldHandoff: true,
          shouldOfficialOnly: false,
          missingInfo: [],
          searchQueries: [],
        },
      });

      // Rule engine says direct_answer, but AI overrides
      mockDecision = {
        answerMode: "direct_answer",
        riskLevel: "low",
        confidenceBand: "high",
        shouldEscalate: false,
        decisionReason: "rule match",
        selectedRuleKeys: [],
      };

      const res = await POST(makeRequest({ message: "I want to sue" }));
      const data = await unwrapJson(res);

      // Should be escalated due to AI override
      expect(data.handoff).toBe(true);
      expect(data.tier).toBe("L6");
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("accepts queryText as an alias for message", async () => {
      mockStreamTokens.mockImplementation(async function* () {
        yield "ok";
      });

      const res = await POST(
        makeRequest({ queryText: "Hello from queryText" })
      );
      // Should not be a 400 (empty message)
      expect(res.status).not.toBe(400);
    });

    it("detects Japanese in message for language fallback", async () => {
      const match = makeFaqMatch();
      mockRetrievalResult = {
        matches: [match],
        summary: { shortcut: "tier_a_shortcut", topScore: 0.95 },
      };
      mockDecision.answerMode = "direct_answer";

      // Trigger understanding that returns 'ja'
      const { runUnderstanding } = require("@/lib/ai/understand");
      (runUnderstanding as jest.Mock).mockResolvedValueOnce({
        understanding: {
          ...mockUnderstanding.understanding,
          language: "ja",
        },
      });

      const res = await POST(makeRequest({ message: "敷金はいくらですか？" }));
      const data = await unwrapJson(res);
      expect(data.language).toBe("ja");
    });

    it("handles sessionId propagation", async () => {
      mockStreamTokens.mockImplementation(async function* () {
        yield "ok";
      });

      const res = await POST(
        makeRequest({ message: "test", sessionId: "sess-123" })
      );
      // Should process normally with sessionId
      expect(res.status).not.toBe(400);
    });
  });
});
