/**
 * lib/quota/__tests__/response.test.ts
 *
 * Unit tests for the unified quota response builder.
 */

import {
  buildQuotaResponse,
  deriveIdentityType,
  type QuotaResponse,
} from "../response";
import type { UsageStatus } from "../tracker";

// Mock cookies() — not available in test env
jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: () => undefined,
    })
  ),
}));

function makeStatus(overrides: Partial<UsageStatus> = {}): UsageStatus {
  return {
    uid: "test-uid",
    isAuthenticated: false,
    used: 0,
    limit: 30,
    remaining: 30,
    blocked: false,
    showUpgradeHint: false,
    resetAtText: "Resets in ~8h",
    ...overrides,
  };
}

describe("quota/response", () => {
  describe("deriveIdentityType", () => {
    it("returns 'authenticated' when user is authenticated", () => {
      expect(deriveIdentityType(true)).toBe("authenticated");
    });

    it("returns 'anonymous' when user is not authenticated", () => {
      expect(deriveIdentityType(false)).toBe("anonymous");
    });

    it("returns 'authenticated' even when contactProvided is false", () => {
      // Currently authentication overrides contactProvided
      expect(deriveIdentityType(true, false)).toBe("authenticated");
    });
  });

  describe("buildQuotaResponse", () => {
    it("returns all required fields", () => {
      const response = buildQuotaResponse(makeStatus());
      const keys: (keyof QuotaResponse)[] = [
        "identityType",
        "dailyLimit",
        "usedToday",
        "remaining",
        "resetAt",
        "resetAtText",
        "canSubmit",
        "upgradeHintEligible",
      ];
      for (const key of keys) {
        expect(response).toHaveProperty(key);
      }
    });

    it("maps status fields correctly", () => {
      const response = buildQuotaResponse(
        makeStatus({ used: 10, limit: 30 })
      );
      expect(response.dailyLimit).toBe(30);
      expect(response.usedToday).toBe(10);
      expect(response.remaining).toBe(20);
    });

    it("sets canSubmit to true when remaining > 0", () => {
      const response = buildQuotaResponse(
        makeStatus({ used: 5, limit: 30, remaining: 25 })
      );
      expect(response.canSubmit).toBe(true);
    });

    it("sets canSubmit to false when remaining is 0", () => {
      const response = buildQuotaResponse(
        makeStatus({ used: 30, limit: 30, remaining: 0 })
      );
      expect(response.canSubmit).toBe(false);
    });

    it("computes remaining from status.limit - status.used", () => {
      // Even if status.remaining is wrong, buildQuotaResponse recalculates
      const response = buildQuotaResponse(
        makeStatus({ used: 25, limit: 30, remaining: 999 })
      );
      expect(response.remaining).toBe(5);
    });

    it("remaining is never negative", () => {
      const response = buildQuotaResponse(
        makeStatus({ used: 50, limit: 30, remaining: 0 })
      );
      expect(response.remaining).toBe(0);
    });

    it("sets upgradeHintEligible when used >= 20", () => {
      expect(
        buildQuotaResponse(makeStatus({ used: 20 })).upgradeHintEligible
      ).toBe(true);
      expect(
        buildQuotaResponse(makeStatus({ used: 25 })).upgradeHintEligible
      ).toBe(true);
    });

    it("does not set upgradeHintEligible when used < 20", () => {
      expect(
        buildQuotaResponse(makeStatus({ used: 19 })).upgradeHintEligible
      ).toBe(false);
      expect(
        buildQuotaResponse(makeStatus({ used: 0 })).upgradeHintEligible
      ).toBe(false);
    });

    it("uses provided identityType over derived", () => {
      const response = buildQuotaResponse(
        makeStatus({ isAuthenticated: false }),
        "lead"
      );
      expect(response.identityType).toBe("lead");
    });

    it("derives identityType from status when not provided", () => {
      const anon = buildQuotaResponse(
        makeStatus({ isAuthenticated: false })
      );
      expect(anon.identityType).toBe("anonymous");

      const auth = buildQuotaResponse(
        makeStatus({ isAuthenticated: true })
      );
      expect(auth.identityType).toBe("authenticated");
    });

    it("resetAt is a valid ISO 8601 string", () => {
      const response = buildQuotaResponse(makeStatus());
      expect(response.resetAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
      // Should be parseable
      expect(new Date(response.resetAt).getTime()).not.toBeNaN();
    });

    it("passes through resetAtText from status", () => {
      const response = buildQuotaResponse(
        makeStatus({ resetAtText: "约 5 小时后重置" })
      );
      expect(response.resetAtText).toBe("约 5 小时后重置");
    });
  });
});
