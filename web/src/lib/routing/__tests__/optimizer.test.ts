/**
 * lib/routing/__tests__/optimizer.test.ts
 *
 * Unit tests for the mathematical routing optimizer.
 * All functions under test are pure — no mocking needed.
 */

import {
  normalizeValue,
  computeQualityAdjustment,
  computeRouteScore,
  optimizeRoute,
  computeConfidenceBandNumeric,
  featuresFromRouterContext,
  DEFAULT_COST_MODEL,
  type RouteFeatures,
  type OptimizationWeights,
} from "../optimizer";

// ── Helpers ────────────────────────────────────────────────────────

/** Baseline features for a "typical" query. */
const BASELINE_FEATURES: RouteFeatures = {
  fSemantic: 0.7,
  fRisk: 0.3,
  fLang: 0.5,
  fTemporal: 0.8,
  fConfidence: 0.6,
  queryComplexity: 0.4,
};

const EQUAL_WEIGHTS: OptimizationWeights = {
  alpha: 0.33,
  beta: 0.33,
  gamma: 0.34,
};

describe("lib/routing/optimizer", () => {
  // ── normalizeValue ─────────────────────────────────────────────

  describe("normalizeValue", () => {
    it("normalizes mid-range value", () => {
      expect(normalizeValue(50, 0, 100)).toBe(0.5);
    });

    it("clamps below min to 0", () => {
      expect(normalizeValue(-10, 0, 100)).toBe(0);
    });

    it("clamps above max to 1", () => {
      expect(normalizeValue(150, 0, 100)).toBe(1);
    });

    it("returns 0 when min === max", () => {
      expect(normalizeValue(5, 5, 5)).toBe(0);
    });

    it("handles min at boundary", () => {
      expect(normalizeValue(0, 0, 100)).toBe(0);
    });

    it("handles max at boundary", () => {
      expect(normalizeValue(100, 0, 100)).toBe(1);
    });
  });

  // ── computeQualityAdjustment ───────────────────────────────────

  describe("computeQualityAdjustment", () => {
    it("layer1_static: quality = base × fSemantic × fTemporal", () => {
      const q = computeQualityAdjustment("layer1_static", BASELINE_FEATURES);
      const expected = DEFAULT_COST_MODEL.baseQuality.layer1_static * 0.7 * 0.8;
      expect(q).toBeCloseTo(expected, 4);
    });

    it("layer3_ai: quality = base × fConfidence × (1 - fRisk×0.5)", () => {
      const q = computeQualityAdjustment("layer3_ai", BASELINE_FEATURES);
      const expected =
        DEFAULT_COST_MODEL.baseQuality.layer3_ai * 0.6 * (1 - 0.3 * 0.5);
      expect(q).toBeCloseTo(expected, 4);
    });

    it("layer5_bridge: quality = base × (1 - fLang)", () => {
      const q = computeQualityAdjustment("layer5_bridge", BASELINE_FEATURES);
      const expected = DEFAULT_COST_MODEL.baseQuality.layer5_bridge * (1 - 0.5);
      expect(q).toBeCloseTo(expected, 4);
    });

    it("layer6_human: quality = base × 1.0", () => {
      const q = computeQualityAdjustment("layer6_human", BASELINE_FEATURES);
      expect(q).toBeCloseTo(DEFAULT_COST_MODEL.baseQuality.layer6_human, 4);
    });

    it("safety override: fRisk > 0.8 gives layer6_human +0.2 bonus", () => {
      const highRisk: RouteFeatures = { ...BASELINE_FEATURES, fRisk: 0.85 };
      const q = computeQualityAdjustment("layer6_human", highRisk);
      expect(q).toBeCloseTo(DEFAULT_COST_MODEL.baseQuality.layer6_human + 0.2, 4);
    });

    it("safety override does NOT apply to non-human routes", () => {
      const highRisk: RouteFeatures = { ...BASELINE_FEATURES, fRisk: 0.85 };
      const q = computeQualityAdjustment("layer3_ai", highRisk);
      const base =
        DEFAULT_COST_MODEL.baseQuality.layer3_ai * 0.6 * (1 - 0.85 * 0.5);
      expect(q).toBeCloseTo(base, 4);
    });

    it("high-confidence shortcut: fSemantic>0.9 & fTemporal>0.8 gives layer1 +0.1", () => {
      const strong: RouteFeatures = {
        ...BASELINE_FEATURES,
        fSemantic: 0.95,
        fTemporal: 0.85,
      };
      const base =
        DEFAULT_COST_MODEL.baseQuality.layer1_static * 0.95 * 0.85;
      const q = computeQualityAdjustment("layer1_static", strong);
      expect(q).toBeCloseTo(base + 0.1, 4);
    });

    it("shortcut does NOT apply when fSemantic <= 0.9", () => {
      const weak: RouteFeatures = {
        ...BASELINE_FEATURES,
        fSemantic: 0.9,
        fTemporal: 0.85,
      };
      const base =
        DEFAULT_COST_MODEL.baseQuality.layer1_static * 0.9 * 0.85;
      const q = computeQualityAdjustment("layer1_static", weak);
      expect(q).toBeCloseTo(base, 4);
    });
  });

  // ── computeRouteScore ──────────────────────────────────────────

  describe("computeRouteScore", () => {
    it("returns correct structure", () => {
      const score = computeRouteScore("layer3_ai", BASELINE_FEATURES);
      expect(score.route).toBe("layer3_ai");
      expect(typeof score.rawCost).toBe("number");
      expect(typeof score.rawLatency).toBe("number");
      expect(typeof score.rawQuality).toBe("number");
      expect(typeof score.objectiveValue).toBe("number");
    });

    it("layer1_static has zero raw cost", () => {
      const score = computeRouteScore("layer1_static", BASELINE_FEATURES);
      expect(score.rawCost).toBe(0);
    });

    it("layer6_human has highest raw cost", () => {
      const scores = (
        ["layer1_static", "layer3_ai", "layer5_bridge", "layer6_human"] as const
      ).map((r) => computeRouteScore(r, BASELINE_FEATURES));
      const humanCost = scores.find((s) => s.route === "layer6_human")!.rawCost;
      for (const s of scores) {
        expect(humanCost).toBeGreaterThanOrEqual(s.rawCost);
      }
    });

    it("lower objectiveValue = better route", () => {
      // With equal weights, layer1 should score well for a good semantic match
      const features: RouteFeatures = {
        ...BASELINE_FEATURES,
        fSemantic: 0.95,
        fTemporal: 0.9,
      };
      const s1 = computeRouteScore("layer1_static", features, EQUAL_WEIGHTS);
      const s6 = computeRouteScore("layer6_human", features, EQUAL_WEIGHTS);
      // layer1 should have lower (better) objective than layer6 for this query
      expect(s1.objectiveValue).toBeLessThan(s6.objectiveValue);
    });
  });

  // ── optimizeRoute ──────────────────────────────────────────────

  describe("optimizeRoute", () => {
    it("returns all 4 route scores", () => {
      const result = optimizeRoute(BASELINE_FEATURES);
      expect(result.scores).toHaveLength(4);
    });

    it("picks layer1_static for strong semantic + temporal", () => {
      const features: RouteFeatures = {
        fSemantic: 0.95,
        fRisk: 0.1,
        fLang: 0.8,
        fTemporal: 0.9,
        fConfidence: 0.9,
        queryComplexity: 0.1,
      };
      const result = optimizeRoute(features);
      expect(result.optimal).toBe("layer1_static");
      expect(result.avoidedHumanEscalation).toBe(true);
    });

    it("picks layer6_human for very high risk", () => {
      const features: RouteFeatures = {
        fSemantic: 0.3,
        fRisk: 0.95,
        fLang: 0.2,
        fTemporal: 0.4,
        fConfidence: 0.3,
        queryComplexity: 0.9,
      };
      // Heavily weight quality (gamma) so safety override dominates
      const weights: OptimizationWeights = { alpha: 0.1, beta: 0.05, gamma: 0.85 };
      const result = optimizeRoute(features, weights);
      expect(result.optimal).toBe("layer6_human");
      expect(result.avoidedHumanEscalation).toBe(false);
    });

    it("computes cost saving vs human baseline", () => {
      const features: RouteFeatures = {
        fSemantic: 0.95,
        fRisk: 0.1,
        fLang: 0.8,
        fTemporal: 0.9,
        fConfidence: 0.9,
        queryComplexity: 0.1,
      };
      const result = optimizeRoute(features);
      // layer1_static costs $0, human costs $5.0
      if (result.optimal === "layer1_static") {
        expect(result.costSavingVsBaseline).toBe(5.0);
      }
    });

    it("preserves features and weights in result", () => {
      const result = optimizeRoute(BASELINE_FEATURES, EQUAL_WEIGHTS);
      expect(result.features).toEqual(BASELINE_FEATURES);
      expect(result.weights).toEqual(EQUAL_WEIGHTS);
    });
  });

  // ── computeConfidenceBandNumeric ───────────────────────────────

  describe("computeConfidenceBandNumeric", () => {
    it("low → 0.3", () => {
      expect(computeConfidenceBandNumeric("low")).toBe(0.3);
    });

    it("medium → 0.6", () => {
      expect(computeConfidenceBandNumeric("medium")).toBe(0.6);
    });

    it("high → 0.9", () => {
      expect(computeConfidenceBandNumeric("high")).toBe(0.9);
    });
  });

  // ── featuresFromRouterContext ───────────────────────────────────

  describe("featuresFromRouterContext", () => {
    it("maps high risk string to 0.9", () => {
      const f = featuresFromRouterContext(
        { topScore: 0.8, hasStaleSource: false },
        "high",
        "medium"
      );
      expect(f.fRisk).toBe(0.9);
    });

    it("maps stale source to fTemporal 0.3", () => {
      const f = featuresFromRouterContext(
        { topScore: 0.5, hasStaleSource: true },
        "low",
        "high"
      );
      expect(f.fTemporal).toBe(0.3);
    });

    it("maps fresh source to fTemporal 0.9", () => {
      const f = featuresFromRouterContext(
        { topScore: 0.5, hasStaleSource: false },
        "low",
        "high"
      );
      expect(f.fTemporal).toBe(0.9);
    });

    it("clamps topScore to [0, 1]", () => {
      const f = featuresFromRouterContext(
        { topScore: 1.5, hasStaleSource: false },
        "low",
        "medium"
      );
      expect(f.fSemantic).toBe(1);
    });

    it("defaults unknown risk to 0.5", () => {
      const f = featuresFromRouterContext(
        { topScore: 0.5, hasStaleSource: false },
        "extreme",
        "medium"
      );
      expect(f.fRisk).toBe(0.5);
    });

    it("defaults unknown confidence band to medium", () => {
      const f = featuresFromRouterContext(
        { topScore: 0.5, hasStaleSource: false },
        "low",
        "unknown"
      );
      expect(f.fConfidence).toBe(0.6); // medium
    });

    it("computes queryComplexity from confidence and risk", () => {
      const f = featuresFromRouterContext(
        { topScore: 0.5, hasStaleSource: false },
        "high",
        "low"
      );
      // (1 - 0.3) * 0.6 + 0.9 * 0.4 = 0.42 + 0.36 = 0.78
      expect(f.queryComplexity).toBeCloseTo(0.78, 2);
    });
  });
});
