/**
 * lib/patent/__tests__/confidence-decay.test.ts
 *
 * Unit tests for the evidence confidence temporal decay system.
 * Tests cover the three decay functions, batch processing, filtering,
 * text entropy, and trigger score computation.
 *
 * All functions under test are pure — only mock the DB import.
 */

// Mock db/tables to avoid file-system I/O
jest.mock("@/lib/db/tables", () => ({
  listEvidence: jest.fn(() => []),
}));

import {
  computeDecayMultiplier,
  computeCurrentConfidence,
  computeBatchConfidence,
  filterActiveEvidence,
  computeTextEntropy,
  computeTriggerScore,
  type DecayParams,
  type TriggerScoreInput,
  type TriggerScoreParams,
} from "../confidence-decay";
import type { EvidenceRecord } from "@/lib/db/tables";

// ── Helpers ────────────────────────────────────────────────────────

function makeEvidence(
  overrides: Partial<EvidenceRecord> & { id: string }
): EvidenceRecord {
  return {
    type: "official_brochure",
    topicTags: [],
    location: null,
    dateCollected: "2025-01-01T00:00:00Z",
    contentSummary: "test",
    sourceUrl: null,
    filePath: null,
    confidenceLevel: "verified",
    expiryDate: null,
    linkedCardIds: [],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    status: "active",
    ...overrides,
  };
}

describe("lib/patent/confidence-decay", () => {
  // ── computeDecayMultiplier ─────────────────────────────────────

  describe("computeDecayMultiplier", () => {
    it("returns 1.0 for 0 days elapsed", () => {
      const params: DecayParams = { type: "linear", linearRatePerDay: 0.01 };
      expect(computeDecayMultiplier(0, params)).toBe(1.0);
    });

    it("returns 1.0 for negative days", () => {
      const params: DecayParams = { type: "exponential", halfLifeDays: 180 };
      expect(computeDecayMultiplier(-5, params)).toBe(1.0);
    });

    // Linear
    it("linear: decays linearly over time", () => {
      const params: DecayParams = { type: "linear", linearRatePerDay: 0.01 };
      expect(computeDecayMultiplier(50, params)).toBeCloseTo(0.5, 4);
    });

    it("linear: clamps to 0 when fully decayed", () => {
      const params: DecayParams = { type: "linear", linearRatePerDay: 0.01 };
      expect(computeDecayMultiplier(200, params)).toBe(0);
    });

    // Exponential
    it("exponential: halves at half-life", () => {
      const params: DecayParams = { type: "exponential", halfLifeDays: 180 };
      expect(computeDecayMultiplier(180, params)).toBeCloseTo(0.5, 4);
    });

    it("exponential: quarters at 2× half-life", () => {
      const params: DecayParams = { type: "exponential", halfLifeDays: 90 };
      expect(computeDecayMultiplier(180, params)).toBeCloseTo(0.25, 4);
    });

    // Step
    it("step: returns 1.0 before expiry", () => {
      const params: DecayParams = { type: "step", stepExpiryDays: 365 };
      expect(computeDecayMultiplier(364, params)).toBe(1.0);
    });

    it("step: returns 0.0 at expiry", () => {
      const params: DecayParams = { type: "step", stepExpiryDays: 365 };
      expect(computeDecayMultiplier(365, params)).toBe(0.0);
    });

    it("step: returns 0.0 after expiry", () => {
      const params: DecayParams = { type: "step", stepExpiryDays: 365 };
      expect(computeDecayMultiplier(500, params)).toBe(0.0);
    });

    // Default
    it("returns 1.0 for unknown decay type", () => {
      const params = { type: "unknown" as DecayParams["type"] };
      expect(computeDecayMultiplier(100, params)).toBe(1.0);
    });
  });

  // ── computeCurrentConfidence ───────────────────────────────────

  describe("computeCurrentConfidence", () => {
    const asOf = new Date("2025-07-01T00:00:00Z");

    it("computes confidence for 'official' evidence (base 1.0)", () => {
      const ev = makeEvidence({
        id: "ev1",
        confidenceLevel: "official",
        dateCollected: "2025-01-01T00:00:00Z",
      });
      const params: DecayParams = { type: "exponential", halfLifeDays: 180 };
      const result = computeCurrentConfidence(ev, params, 0.3, asOf);

      expect(result.evidenceId).toBe("ev1");
      expect(result.confidenceBase).toBe(1.0);
      // ~181 days elapsed, should be close to half-life
      expect(result.confidenceCurrent).toBeCloseTo(0.5, 1);
      expect(result.decayType).toBe("exponential");
      expect(result.needsUpdate).toBe(false); // 0.5 > 0.3 threshold
    });

    it("computes confidence for 'unverified' evidence (base 0.5)", () => {
      const ev = makeEvidence({
        id: "ev2",
        confidenceLevel: "unverified",
        dateCollected: "2025-01-01T00:00:00Z",
      });
      const params: DecayParams = { type: "exponential", halfLifeDays: 180 };
      const result = computeCurrentConfidence(ev, params, 0.3, asOf);

      expect(result.confidenceBase).toBe(0.5);
      // 0.5 × ~0.5 = ~0.25, which is < 0.3 threshold
      expect(result.needsUpdate).toBe(true);
    });

    it("marks evidence as needsUpdate when below threshold", () => {
      const ev = makeEvidence({
        id: "ev3",
        confidenceLevel: "verified",
        dateCollected: "2024-01-01T00:00:00Z", // 18 months ago
      });
      const params: DecayParams = { type: "linear", linearRatePerDay: 0.002 };
      const result = computeCurrentConfidence(ev, params, 0.5, asOf);

      // ~547 days × 0.002 = 1.094 reduction → multiplier clamped to 0
      expect(result.confidenceCurrent).toBe(0);
      expect(result.needsUpdate).toBe(true);
    });

    it("handles invalid dateCollected (NaN) — treats as 0 days", () => {
      const ev = makeEvidence({
        id: "ev4",
        dateCollected: "not-a-date",
      });
      const params: DecayParams = { type: "exponential", halfLifeDays: 180 };
      const result = computeCurrentConfidence(ev, params, 0.3, asOf);

      // 0 days → multiplier = 1.0
      expect(result.decayMultiplier).toBe(1.0);
      expect(result.confidenceCurrent).toBe(0.75); // verified base
    });

    it("rounds daysSinceCollection to 1 decimal", () => {
      const ev = makeEvidence({ id: "ev5", dateCollected: "2025-06-29T12:00:00Z" });
      const result = computeCurrentConfidence(
        ev,
        { type: "step", stepExpiryDays: 365 },
        0.3,
        new Date("2025-07-01T00:00:00Z")
      );
      expect(result.daysSinceCollection).toBe(1.5);
    });
  });

  // ── computeBatchConfidence ─────────────────────────────────────

  describe("computeBatchConfidence", () => {
    it("returns results sorted by confidenceCurrent descending", () => {
      const records = [
        makeEvidence({ id: "old", dateCollected: "2024-01-01T00:00:00Z", confidenceLevel: "unverified" }),
        makeEvidence({ id: "new", dateCollected: "2025-06-01T00:00:00Z", confidenceLevel: "official" }),
        makeEvidence({ id: "mid", dateCollected: "2025-03-01T00:00:00Z", confidenceLevel: "verified" }),
      ];
      const params: DecayParams = { type: "exponential", halfLifeDays: 180 };
      const results = computeBatchConfidence(
        records,
        params,
        0.1,
        new Date("2025-07-01T00:00:00Z")
      );

      expect(results).toHaveLength(3);
      // Should be sorted descending by confidence
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].confidenceCurrent).toBeGreaterThanOrEqual(
          results[i].confidenceCurrent
        );
      }
    });

    it("handles empty input", () => {
      expect(computeBatchConfidence([])).toEqual([]);
    });
  });

  // ── filterActiveEvidence ───────────────────────────────────────

  describe("filterActiveEvidence", () => {
    it("separates active from needsUpdate", () => {
      const records = [
        makeEvidence({ id: "fresh", dateCollected: "2025-06-15T00:00:00Z", confidenceLevel: "official" }),
        makeEvidence({ id: "stale", dateCollected: "2023-01-01T00:00:00Z", confidenceLevel: "unverified" }),
      ];
      const params: DecayParams = { type: "exponential", halfLifeDays: 180 };
      const asOf = new Date("2025-07-01T00:00:00Z");
      const { active, needsUpdate } = filterActiveEvidence(records, params, 0.3, asOf);

      expect(active.length).toBeGreaterThanOrEqual(1);
      expect(active.some((r) => r.evidenceId === "fresh")).toBe(true);
      expect(needsUpdate.some((r) => r.evidenceId === "stale")).toBe(true);
    });
  });

  // ── computeTextEntropy ─────────────────────────────────────────

  describe("computeTextEntropy", () => {
    it("returns 0 for empty string", () => {
      expect(computeTextEntropy("")).toBe(0);
    });

    it("returns 0 for single repeated character", () => {
      expect(computeTextEntropy("aaaa")).toBe(0);
    });

    it("returns 1.0 for two equally distributed characters", () => {
      // "ab" → H = 1.0 bit
      expect(computeTextEntropy("ab")).toBeCloseTo(1.0, 4);
    });

    it("returns higher entropy for more diverse text", () => {
      const low = computeTextEntropy("aabb");
      const high = computeTextEntropy("abcd");
      expect(high).toBeGreaterThan(low);
    });

    it("handles CJK text", () => {
      const entropy = computeTextEntropy("敷金礼金仲介手数料");
      expect(entropy).toBeGreaterThan(0);
    });
  });

  // ── computeTriggerScore ────────────────────────────────────────

  describe("computeTriggerScore", () => {
    const params: TriggerScoreParams = {
      w1: 0.5,
      w2: 0.3,
      w3: 0.2,
      theta: 0.6,
    };

    it("returns score and shouldInject", () => {
      const input: TriggerScoreInput = {
        textEntropy: 3.0,
        dwellNormalized: 0.5,
        clickPatternScore: 0.3,
      };
      const result = computeTriggerScore(input, params);
      expect(typeof result.score).toBe("number");
      expect(typeof result.shouldInject).toBe("boolean");
    });

    it("triggers injection when score > theta", () => {
      const input: TriggerScoreInput = {
        textEntropy: 4.0,    // normalized to ~0.89
        dwellNormalized: 0.9,
        clickPatternScore: 0.8,
      };
      const result = computeTriggerScore(input, params);
      // 0.5 * 0.89 + 0.3 * 0.9 + 0.2 * 0.8 ≈ 0.445 + 0.27 + 0.16 = 0.875
      expect(result.shouldInject).toBe(true);
      expect(result.score).toBeGreaterThan(0.6);
    });

    it("does not trigger when all signals are low", () => {
      const input: TriggerScoreInput = {
        textEntropy: 0.5,
        dwellNormalized: 0.1,
        clickPatternScore: 0.1,
      };
      const result = computeTriggerScore(input, params);
      expect(result.shouldInject).toBe(false);
    });

    it("normalizes entropy by dividing by 4.5", () => {
      const input: TriggerScoreInput = {
        textEntropy: 4.5,
        dwellNormalized: 0,
        clickPatternScore: 0,
      };
      const result = computeTriggerScore(input, params);
      // 0.5 * 1.0 + 0 + 0 = 0.5
      expect(result.score).toBeCloseTo(0.5, 3);
    });

    it("clamps entropy normalization to 1.0", () => {
      const input: TriggerScoreInput = {
        textEntropy: 10.0, // way above 4.5
        dwellNormalized: 0,
        clickPatternScore: 0,
      };
      const result = computeTriggerScore(input, params);
      // Should be capped: 0.5 * 1.0 = 0.5
      expect(result.score).toBeCloseTo(0.5, 3);
    });

    it("rounds score to 4 decimal places", () => {
      const input: TriggerScoreInput = {
        textEntropy: 3.33333,
        dwellNormalized: 0.33333,
        clickPatternScore: 0.33333,
      };
      const result = computeTriggerScore(input, params);
      const scoreStr = result.score.toString();
      const decimals = scoreStr.split(".")[1] ?? "";
      expect(decimals.length).toBeLessThanOrEqual(4);
    });
  });
});
