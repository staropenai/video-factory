/**
 * lib/evidence/__tests__/trigger-detector.test.ts
 *
 * Unit tests for the trust signal trigger detector.
 * All functions under test are pure — no mocking needed.
 */

import {
  hasExplicitDoubt,
  hasHighAmountTopic,
  isRepeatedQuestion,
  detectTrustTrigger,
} from "../trigger-detector";

describe("lib/evidence/trigger-detector", () => {
  // ── hasExplicitDoubt ───────────────────────────────────────────

  describe("hasExplicitDoubt", () => {
    it("detects Japanese doubt — 本当ですか", () => {
      expect(hasExplicitDoubt("これは本当ですか？")).toBe(true);
    });

    it("detects Japanese doubt — 詐欺", () => {
      expect(hasExplicitDoubt("詐欺じゃないですか")).toBe(true);
    });

    it("detects Chinese doubt — 是真的吗", () => {
      expect(hasExplicitDoubt("这是真的吗")).toBe(true);
    });

    it("detects Chinese doubt — 骗", () => {
      expect(hasExplicitDoubt("这个中介骗人")).toBe(true);
    });

    it("detects English doubt — 'is this legit'", () => {
      expect(hasExplicitDoubt("is this legit?")).toBe(true);
    });

    it("detects English doubt — 'scam' case-insensitive", () => {
      expect(hasExplicitDoubt("Is this a SCAM?")).toBe(true);
    });

    it("returns false for neutral query", () => {
      expect(hasExplicitDoubt("How much is the deposit?")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(hasExplicitDoubt("")).toBe(false);
    });
  });

  // ── hasHighAmountTopic ─────────────────────────────────────────

  describe("hasHighAmountTopic", () => {
    it("detects Japanese — 敷金", () => {
      expect(hasHighAmountTopic("敷金はいくらですか")).toBe(true);
    });

    it("detects Japanese — 仲介手数料", () => {
      expect(hasHighAmountTopic("仲介手数料の相場は？")).toBe(true);
    });

    it("detects Chinese — 押金", () => {
      expect(hasHighAmountTopic("押金多少钱")).toBe(true);
    });

    it("detects Chinese — 违约金", () => {
      expect(hasHighAmountTopic("违约金怎么算")).toBe(true);
    });

    it("detects English — 'deposit' case-insensitive", () => {
      expect(hasHighAmountTopic("What is the Deposit amount?")).toBe(true);
    });

    it("detects English — 'key money'", () => {
      expect(hasHighAmountTopic("do I have to pay key money?")).toBe(true);
    });

    it("returns false for unrelated query", () => {
      expect(hasHighAmountTopic("Where is the nearest station?")).toBe(false);
    });
  });

  // ── isRepeatedQuestion ─────────────────────────────────────────

  describe("isRepeatedQuestion", () => {
    it("detects repeated topic with 2+ shared tokens", () => {
      expect(
        isRepeatedQuestion("deposit refund rules", [
          "what are the deposit refund policies?",
        ])
      ).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(
        isRepeatedQuestion("Deposit Refund", ["deposit refund amount"])
      ).toBe(true);
    });

    it("returns false with no previous queries", () => {
      expect(isRepeatedQuestion("deposit refund", [])).toBe(false);
    });

    it("returns false with only 1 shared token", () => {
      expect(
        isRepeatedQuestion("deposit amount", ["refund process explained"])
      ).toBe(false);
    });

    it("ignores single-char tokens", () => {
      // "a" is 1 char, should be excluded
      expect(
        isRepeatedQuestion("a b c d", ["a b c d"])
      ).toBe(false);
    });

    it("handles multiple previous queries — match in any", () => {
      expect(
        isRepeatedQuestion("deposit rules info", [
          "how is the weather?",
          "deposit rules overview",
        ])
      ).toBe(true);
    });
  });

  // ── detectTrustTrigger ─────────────────────────────────────────

  describe("detectTrustTrigger", () => {
    it("returns no trigger for neutral query", () => {
      const result = detectTrustTrigger("What time does the office open?");
      expect(result.triggered).toBe(false);
      expect(result.signalType).toBeNull();
      expect(result.suggestedEvidenceTopics).toEqual([]);
      expect(result.urgency).toBe("low");
    });

    it("prioritizes explicit_doubt over high_amount_topic", () => {
      // "敷金" = high_amount, "騙し" = explicit_doubt
      const result = detectTrustTrigger("敷金で騙されないですか");
      expect(result.triggered).toBe(true);
      expect(result.signalType).toBe("explicit_doubt");
      expect(result.urgency).toBe("high");
    });

    it("returns high_amount_topic when no doubt signal", () => {
      const result = detectTrustTrigger("初期費用の内訳を教えて");
      expect(result.triggered).toBe(true);
      expect(result.signalType).toBe("high_amount_topic");
      expect(result.urgency).toBe("medium");
      expect(result.suggestedEvidenceTopics).toContain("deposit_rules");
    });

    it("detects repeated_question", () => {
      const result = detectTrustTrigger("nearest station info", [
        "how far is the nearest station?",
      ]);
      expect(result.triggered).toBe(true);
      expect(result.signalType).toBe("repeated_question");
      expect(result.urgency).toBe("medium");
    });

    it("detects prolonged_hesitation when dwellTimeMs > 30s", () => {
      const result = detectTrustTrigger("ok", [], 35_000);
      expect(result.triggered).toBe(true);
      expect(result.signalType).toBe("prolonged_hesitation");
      expect(result.urgency).toBe("low");
    });

    it("does not trigger hesitation at exactly 30s", () => {
      const result = detectTrustTrigger("ok", [], 30_000);
      expect(result.triggered).toBe(false);
    });

    it("detects file_uploaded", () => {
      const result = detectTrustTrigger("check this contract", [], undefined, true);
      expect(result.triggered).toBe(true);
      expect(result.signalType).toBe("file_uploaded");
      expect(result.suggestedEvidenceTopics).toContain("contract_terms");
    });

    it("prioritizes explicit_doubt over file_uploaded", () => {
      const result = detectTrustTrigger("is this real?", [], undefined, true);
      expect(result.signalType).toBe("explicit_doubt");
    });

    it("prioritizes high_amount over repeated_question", () => {
      const result = detectTrustTrigger("deposit deposit amount", [
        "deposit amount info",
      ]);
      // "deposit" matches high_amount, and also repeated — high_amount wins
      expect(result.signalType).toBe("high_amount_topic");
    });
  });
});
