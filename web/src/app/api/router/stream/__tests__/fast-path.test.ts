/**
 * Tests for the Tier A/B fast path — queries that match the knowledge base
 * with high confidence return JSON immediately without calling OpenAI.
 */
import { POST } from "@/app/api/router/stream/route";
import { NextRequest } from "next/server";

// Mock OpenAI — should NOT be called for fast-path queries
const createMock = jest.fn();
jest.mock("@/lib/ai/openai", () => ({
  openai: { responses: { create: (...args: unknown[]) => createMock(...args) } },
  env: { OPENAI_MODEL: "gpt-4o-mini" },
  openaiAvailable: true,
}));

// Mock auth/identity
jest.mock("@/lib/auth/identity", () => ({
  resolveIdentity: () =>
    Promise.resolve({ uid: "test-user", isAuthenticated: false }),
}));

// Mock quota — always allow
jest.mock("@/app/api/router/quota-gate", () => ({
  enforceRateLimit: () => ({ ok: true }),
  validateMessageLength: () => ({ ok: true }),
  enforceQuota: () => Promise.resolve({ ok: true }),
}));

// Mock DB writes (must include listLiveFaqs for overlay scorer)
jest.mock("@/lib/db/tables", () => ({
  insertUserQuery: () => ({ id: "uq_test" }),
  insertHandoff: () => ({ id: "h_test" }),
  insertEvent: () => ({ id: "e_test" }),
  listLiveFaqs: () => [],
}));

// Mock monitoring (no-op)
jest.mock("@/lib/monitoring/ttft", () => ({
  recordRouterLatency: jest.fn(),
  recordTTFT: jest.fn(),
  recordTierHit: jest.fn(),
  spanRouterPhase: jest.fn(() => ({ end: jest.fn(), setTag: jest.fn() })),
}));

// Mock understanding cache
jest.mock("@/lib/ai/understanding-cache", () => ({
  getCachedUnderstanding: () => null,
  setCachedUnderstanding: () => {},
}));

// Mock security
jest.mock("@/lib/security/prompt-injection", () => ({
  checkPromptInjection: () => ({
    detected: false,
    matchedPatterns: [],
    highestSeverity: "none",
  }),
  sanitizeForLog: (s: string) => s,
}));
jest.mock("@/lib/security/event-log", () => ({
  buildSecurityEvent: () => ({}),
  classifySecuritySeverity: () => ({ eventType: "test", severity: "low" }),
  logSecurityEvent: () => {},
}));

function makeReq(message: string) {
  return new NextRequest("http://localhost/api/router/stream", {
    method: "POST",
    body: JSON.stringify({ message }),
    headers: { "Content-Type": "application/json" },
  });
}

describe("Tier A/B fast path", () => {
  beforeEach(() => {
    createMock.mockClear();
  });

  it("returns JSON immediately for Tier A query (hanko)", async () => {
    const res = await POST(makeReq("What is a hanko seal stamp?"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.tier).toBe("A");
    expect(body.data.content).toBeTruthy();
    expect(body.data.debug.fastPath).toBe(true);
    // OpenAI should NOT have been called
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns JSON immediately for Tier B query (deposit/shikikin)", async () => {
    const res = await POST(makeReq("What is shikikin deposit?"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.tier).toBe("B");
    expect(body.data.content).toBeTruthy();
    expect(body.data.debug.fastPath).toBe(true);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns JSON for Tier B troubleshooting (power outage)", async () => {
    const res = await POST(makeReq("停電 電気が来ない"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.tier).toBe("B");
    expect(body.data.debug.fastPath).toBe(true);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns JSON for Chinese query hitting Tier B (garbage)", async () => {
    const res = await POST(makeReq("垃圾分类怎么扔"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(["A", "B"]).toContain(body.data.tier);
    expect(body.data.debug.fastPath).toBe(true);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns language-appropriate content", async () => {
    const res = await POST(makeReq("敷金って何ですか？"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.language).toBe("ja");
    expect(body.data.debug.fastPath).toBe(true);
  });

  it("returns JSON for Tier B daily life (bank account)", async () => {
    const res = await POST(makeReq("How to open a bank account 銀行口座?"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.tier).toBe("B");
    expect(body.data.debug.fastPath).toBe(true);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("fast path latency is under 50ms", async () => {
    const start = Date.now();
    // Use a query proven to hit Tier A fast path (hanko + seal = 2 keyword hits)
    const res = await POST(makeReq("What is hanko seal stamp inkan?"));
    const elapsed = Date.now() - start;
    const body = await res.json();
    expect(body.data.debug.fastPath).toBe(true);
    expect(elapsed).toBeLessThan(50);
  });

  it("includes sources in fast-path response", async () => {
    const res = await POST(makeReq("What is key money reikin 礼金?"));
    const body = await res.json();
    expect(body.data.sources).toBeDefined();
    expect(body.data.sources.length).toBeGreaterThan(0);
    expect(body.data.sources[0]).toHaveProperty("id");
    expect(body.data.sources[0]).toHaveProperty("title");
  });

  it("falls through to full pipeline for complex query", async () => {
    // Mock understanding response for the fall-through path
    createMock.mockResolvedValueOnce({
      output_text: JSON.stringify({
        language: "en",
        intent: "ask_about_rights",
        category: "renting",
        subtopic: null,
        riskLevel: "low",
        missingInfo: [],
        searchQueries: ["tenant rights japan"],
        shouldOfficialOnly: false,
        shouldHandoff: false,
        confidence: 0.5,
        entities: { location: null, documentType: null, deadline: null },
      }),
    });
    // Mock the streaming response for Tier C
    createMock.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        yield { type: "response.output_text.delta", delta: "Here is" };
        yield { type: "response.output_text.delta", delta: " your answer." };
      },
    });

    const res = await POST(
      makeReq(
        "What are my specific legal rights as a foreign tenant if landlord ignores repeated repair requests and threatens eviction?"
      )
    );
    // Should be SSE stream (Tier C) — OpenAI WAS called
    expect(createMock).toHaveBeenCalled();
  });
});
