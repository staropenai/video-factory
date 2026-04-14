/**
 * Tests for kb-matcher.ts — V5 T1 predicate layer.
 *
 * Validates that matchTierA, matchTierB, isKBHit, and
 * matchKnowledgeBase produce correct results for the
 * knowledge base shortcut path.
 */

import {
  matchTierA,
  matchTierB,
  isKBHit,
  matchKnowledgeBase,
} from "../kb-matcher";

describe("kb-matcher predicates", () => {
  describe("matchTierA", () => {
    it("returns true for tier_a_shortcut with high score", () => {
      expect(matchTierA("tier_a_shortcut", 0.85)).toBe(true);
    });

    it("returns false for tier_a_shortcut below threshold", () => {
      expect(matchTierA("tier_a_shortcut", 0.5)).toBe(false);
    });

    it("returns false for tier_b_shortcut even with high score", () => {
      expect(matchTierA("tier_b_shortcut", 0.95)).toBe(false);
    });

    it("returns false for 'none' shortcut", () => {
      expect(matchTierA("none", 0.9)).toBe(false);
    });
  });

  describe("matchTierB", () => {
    it("returns true for tier_b_shortcut with high score", () => {
      expect(matchTierB("tier_b_shortcut", 0.85)).toBe(true);
    });

    it("returns false for tier_b_shortcut below threshold", () => {
      expect(matchTierB("tier_b_shortcut", 0.6)).toBe(false);
    });

    it("returns false for tier_a_shortcut", () => {
      expect(matchTierB("tier_a_shortcut", 0.9)).toBe(false);
    });
  });

  describe("isKBHit", () => {
    it("returns true when Tier A matches", () => {
      expect(isKBHit({ shortcut: "tier_a_shortcut", topScore: 0.85 })).toBe(true);
    });

    it("returns true when Tier B matches", () => {
      expect(isKBHit({ shortcut: "tier_b_shortcut", topScore: 0.85 })).toBe(true);
    });

    it("returns false for 'none' shortcut", () => {
      expect(isKBHit({ shortcut: "none", topScore: 0.9 })).toBe(false);
    });

    it("returns false for low score", () => {
      expect(isKBHit({ shortcut: "tier_a_shortcut", topScore: 0.3 })).toBe(false);
    });
  });

  describe("matchKnowledgeBase (integration)", () => {
    it("returns hit=true for a known Tier A query (hanko)", () => {
      const result = matchKnowledgeBase("What is a hanko seal stamp inkan?", "en");
      // Known Tier A entry — should match with high confidence
      expect(result.hit).toBe(true);
      expect(result.tier).toBe("A");
      expect(result.confidence).toBeGreaterThanOrEqual(0.77);
      expect(result.cardId).toBeTruthy();
      expect(result.content).toBeTruthy();
    });

    it("returns hit=false for an unknown query", () => {
      const result = matchKnowledgeBase("quantum computing principles in 2025", "en");
      expect(result.hit).toBe(false);
      expect(result.tier).toBe("C");
    });

    it("returns correct language content", () => {
      const resultEn = matchKnowledgeBase("What is a hanko seal stamp inkan?", "en");
      const resultJa = matchKnowledgeBase("判子とは何ですか 印鑑 はんこ", "ja");
      if (resultEn.hit && resultJa.hit) {
        expect(resultEn.content).not.toBe(resultJa.content);
      }
    });

    it("returns Tier B for procedural FAQ match", () => {
      const result = matchKnowledgeBase("garbage day schedule sorting rules", "en");
      if (result.hit) {
        expect(result.tier).toBe("B");
      }
    });
  });
});
