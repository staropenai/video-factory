/**
 * lib/ai/__tests__/understanding-cache.test.ts
 *
 * Unit tests for the in-memory LRU understanding cache.
 */

import {
  getCachedUnderstanding,
  setCachedUnderstanding,
  __clearCacheForTests,
} from "../understanding-cache";
import type { UnderstandingResult } from "@/lib/ai/types";

function makeResult(overrides: Partial<UnderstandingResult> = {}): UnderstandingResult {
  return {
    understanding: {
      language: "en",
      intent: "question",
      category: "renting",
      subtopic: "deposit",
      riskLevel: "low",
      shouldHandoff: false,
      shouldOfficialOnly: false,
      missingInfo: [],
      searchQueries: ["deposit"],
      confidence: 0.85,
      entities: { location: null, documentType: null, deadline: null },
    },
    source: "openai",
    latencyMs: 150,
    ...overrides,
  };
}

describe("lib/ai/understanding-cache", () => {
  beforeEach(() => {
    __clearCacheForTests();
  });

  describe("setCachedUnderstanding + getCachedUnderstanding", () => {
    it("stores and retrieves a result", () => {
      const result = makeResult();
      setCachedUnderstanding("What is the deposit?", result);

      const cached = getCachedUnderstanding("What is the deposit?");
      expect(cached).toEqual(result);
    });

    it("returns null for unknown queries", () => {
      expect(getCachedUnderstanding("never seen this")).toBeNull();
    });

    it("normalizes whitespace for cache key", () => {
      const result = makeResult();
      setCachedUnderstanding("  hello   world  ", result);

      // Same logical query with different whitespace
      expect(getCachedUnderstanding("hello world")).toEqual(result);
      expect(getCachedUnderstanding("  hello   world  ")).toEqual(result);
    });

    it("trims leading/trailing whitespace", () => {
      const result = makeResult();
      setCachedUnderstanding("  deposit  ", result);

      expect(getCachedUnderstanding("deposit")).toEqual(result);
    });

    it("preserves case (case-sensitive keys)", () => {
      const result = makeResult();
      setCachedUnderstanding("Hello", result);

      // Different case = different key
      expect(getCachedUnderstanding("hello")).toBeNull();
      expect(getCachedUnderstanding("Hello")).toEqual(result);
    });
  });

  describe("TTL expiration", () => {
    it("returns null after TTL expires", () => {
      const result = makeResult();
      setCachedUnderstanding("test query", result);

      // Fast-forward past TTL (5 minutes)
      const realNow = Date.now;
      Date.now = () => realNow() + 5 * 60 * 1000 + 1;

      expect(getCachedUnderstanding("test query")).toBeNull();

      Date.now = realNow;
    });

    it("returns result within TTL window", () => {
      const result = makeResult();
      setCachedUnderstanding("test query", result);

      // Still within TTL (4 minutes)
      const realNow = Date.now;
      Date.now = () => realNow() + 4 * 60 * 1000;

      expect(getCachedUnderstanding("test query")).toEqual(result);

      Date.now = realNow;
    });
  });

  describe("source filtering", () => {
    it("only caches openai results", () => {
      const result = makeResult({ source: "openai" });
      setCachedUnderstanding("query1", result);
      expect(getCachedUnderstanding("query1")).toEqual(result);
    });

    it("does not cache fallback results", () => {
      const result = makeResult({ source: "fallback" });
      setCachedUnderstanding("query2", result);
      expect(getCachedUnderstanding("query2")).toBeNull();
    });
  });

  describe("LRU eviction", () => {
    it("evicts oldest entry when at capacity", () => {
      // Fill cache to capacity (500 entries)
      for (let i = 0; i < 500; i++) {
        setCachedUnderstanding(`query-${i}`, makeResult());
      }

      // The first entry should still be there
      expect(getCachedUnderstanding("query-0")).not.toBeNull();

      // Add one more — should evict query-0 (oldest, now moved to end by get above)
      // Actually query-0 was just accessed, so query-1 is the oldest
      setCachedUnderstanding("query-new", makeResult());

      // query-1 (the actual oldest untouched entry) should be evicted
      expect(getCachedUnderstanding("query-1")).toBeNull();

      // The new entry should be there
      expect(getCachedUnderstanding("query-new")).not.toBeNull();
    });

    it("does not evict when updating existing key", () => {
      for (let i = 0; i < 500; i++) {
        setCachedUnderstanding(`query-${i}`, makeResult());
      }

      // Update an existing key — should not trigger eviction
      const updated = makeResult({ latencyMs: 999 });
      setCachedUnderstanding("query-0", updated);

      // query-1 should still be there (no eviction needed)
      expect(getCachedUnderstanding("query-1")).not.toBeNull();
      expect(getCachedUnderstanding("query-0")).toEqual(updated);
    });
  });

  describe("LRU ordering", () => {
    it("get() refreshes entry position", () => {
      // Add entries in order
      setCachedUnderstanding("oldest", makeResult());
      setCachedUnderstanding("middle", makeResult());
      setCachedUnderstanding("newest", makeResult());

      // Access "oldest" to move it to the end
      getCachedUnderstanding("oldest");

      // Now "middle" is the actual oldest
      // Fill to capacity to force eviction
      for (let i = 0; i < 498; i++) {
        setCachedUnderstanding(`filler-${i}`, makeResult());
      }

      // One more to trigger eviction — "middle" should go first
      setCachedUnderstanding("trigger", makeResult());

      expect(getCachedUnderstanding("middle")).toBeNull();
      // "oldest" was refreshed, so it should survive
      expect(getCachedUnderstanding("oldest")).not.toBeNull();
    });
  });
});
