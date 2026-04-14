/**
 * lib/quota/__tests__/tracker.test.ts
 *
 * Unit tests for the quota tracker.
 *
 * Every test uses a globally-unique uid via an atomic counter,
 * so tests never share state and never need store clearing.
 */

import {
  consumeQuota,
  getUsageStatus,
  QUOTA_ANONYMOUS,
  QUOTA_AUTHENTICATED,
  UPGRADE_HINT_THRESHOLD,
} from "../tracker";

// Mock cookies() — not available in test env
jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: () => undefined,
    })
  ),
}));

let _counter = 0;
function uid(label = "t"): string {
  return `test-${label}-${++_counter}-${Date.now()}`;
}

describe("quota/tracker", () => {

  describe("anonymous user (30/day)", () => {
    it("starts at 0 used, 30 remaining", async () => {
      const id = uid("fresh");
      const s = await getUsageStatus(id, false, "en");
      expect(s.used).toBe(0);
      expect(s.limit).toBe(QUOTA_ANONYMOUS);
      expect(s.remaining).toBe(QUOTA_ANONYMOUS);
      expect(s.blocked).toBe(false);
      expect(s.showUpgradeHint).toBe(false);
    });

    it("increments correctly on each call", async () => {
      const id = uid("incr");
      for (let i = 1; i <= 5; i++) {
        const s = await consumeQuota(id, false, "en");
        expect(s.used).toBe(i);
        expect(s.remaining).toBe(QUOTA_ANONYMOUS - i);
        expect(s.blocked).toBe(false);
      }
    });

    it("does NOT show upgrade hint before threshold", async () => {
      const id = uid("hint-before");
      for (let i = 0; i < UPGRADE_HINT_THRESHOLD - 1; i++) {
        const s = await consumeQuota(id, false, "en");
        expect(s.showUpgradeHint).toBe(false);
      }
    });

    it("shows upgrade hint exactly at threshold", async () => {
      const id = uid("hint-at");
      for (let i = 0; i < UPGRADE_HINT_THRESHOLD - 1; i++) {
        await consumeQuota(id, false, "en");
      }
      const s = await consumeQuota(id, false, "en");
      expect(s.showUpgradeHint).toBe(true);
      expect(s.used).toBe(UPGRADE_HINT_THRESHOLD);
    });

    it("blocks at the anonymous limit", async () => {
      const id = uid("anon-block");
      for (let i = 0; i < QUOTA_ANONYMOUS; i++) {
        await consumeQuota(id, false, "en");
      }
      // 31st call: rejected
      const s = await consumeQuota(id, false, "en");
      expect(s.blocked).toBe(true);
      expect(s.remaining).toBe(0);
    });

    it("does NOT increment used count past the limit", async () => {
      const id = uid("no-overcount");
      for (let i = 0; i < QUOTA_ANONYMOUS; i++) {
        await consumeQuota(id, false, "en");
      }
      const c1 = await consumeQuota(id, false, "en");
      const c2 = await consumeQuota(id, false, "en");
      expect(c1.used).toBe(QUOTA_ANONYMOUS);
      expect(c2.used).toBe(QUOTA_ANONYMOUS);
    });

    it("getUsageStatus does NOT mutate state", async () => {
      const id = uid("read-only");
      await consumeQuota(id, false, "en");
      await consumeQuota(id, false, "en");
      const before = await getUsageStatus(id, false, "en");
      await getUsageStatus(id, false, "en");
      await getUsageStatus(id, false, "en");
      const after = await getUsageStatus(id, false, "en");
      expect(after.used).toBe(before.used);
    });
  });

  describe("authenticated user (50/day)", () => {
    it("gets the higher limit on first check", async () => {
      const id = uid("auth-fresh");
      const s = await getUsageStatus(id, true, "en");
      expect(s.limit).toBe(QUOTA_AUTHENTICATED);
      expect(s.remaining).toBe(QUOTA_AUTHENTICATED);
    });

    it("allows all 50 calls without blocking", async () => {
      const id = uid("auth-50");
      for (let i = 0; i < QUOTA_AUTHENTICATED; i++) {
        const s = await consumeQuota(id, true, "en");
        expect(s.blocked).toBe(false);
      }
    });

    it("blocks on the 51st call", async () => {
      const id = uid("auth-block");
      for (let i = 0; i < QUOTA_AUTHENTICATED; i++) {
        await consumeQuota(id, true, "en");
      }
      const final = await consumeQuota(id, true, "en");
      expect(final.blocked).toBe(true);
      expect(final.used).toBe(QUOTA_AUTHENTICATED);
    });

    it("does NOT block at the anonymous limit (30)", async () => {
      const id = uid("auth-not-30");
      for (let i = 0; i < QUOTA_ANONYMOUS; i++) {
        await consumeQuota(id, true, "en");
      }
      const s = await consumeQuota(id, true, "en");
      expect(s.blocked).toBe(false);
      expect(s.used).toBe(QUOTA_ANONYMOUS + 1);
    });
  });

  describe("resetAtText", () => {
    it("returns non-empty string for all supported languages", async () => {
      const id = uid("reset-text");
      for (const lang of ["zh", "en", "ja", "ko", "vi", "th"]) {
        const s = await getUsageStatus(id, false, lang);
        expect(typeof s.resetAtText).toBe("string");
        expect(s.resetAtText.length).toBeGreaterThan(0);
      }
    });

    it("falls back gracefully for unknown language codes", async () => {
      const id = uid("reset-fallback");
      const s = await getUsageStatus(id, false, "xx-unknown");
      expect(typeof s.resetAtText).toBe("string");
      expect(s.resetAtText.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("two different uids are completely independent", async () => {
      const a = uid("edge-a");
      const b = uid("edge-b");
      for (let i = 0; i < QUOTA_ANONYMOUS; i++) {
        await consumeQuota(a, false, "en");
      }
      const bStatus = await getUsageStatus(b, false, "en");
      expect(bStatus.used).toBe(0);
      expect(bStatus.blocked).toBe(false);
    });

    it("remaining is never negative", async () => {
      const id = uid("no-negative");
      for (let i = 0; i < QUOTA_ANONYMOUS + 10; i++) {
        const s = await consumeQuota(id, false, "en");
        expect(s.remaining).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
