/**
 * app/api/router/__tests__/quota-gate.test.ts
 *
 * Unit tests for the extracted quota gate module.
 */

import { validateMessageLength, enforceQuota } from "../quota-gate";
import * as sessionToken from "@/lib/auth/session-token";
import * as tracker from "@/lib/quota/tracker";

// Mock dependencies
jest.mock("@/lib/auth/session-token");
jest.mock("@/lib/quota/tracker");

const mockedVerify = sessionToken.verifySessionToken as jest.MockedFunction<
  typeof sessionToken.verifySessionToken
>;
const mockedConsume = tracker.consumeQuota as jest.MockedFunction<
  typeof tracker.consumeQuota
>;

function makeIdentity(overrides = {}) {
  return {
    uid: "test-uid-123",
    isAuthenticated: false,
    isNewUid: false,
    ...overrides,
  };
}

function makeUsageStatus(overrides = {}) {
  return {
    uid: "test-uid-123",
    isAuthenticated: false,
    used: 5,
    limit: 30,
    remaining: 25,
    blocked: false,
    showUpgradeHint: false,
    resetAtText: "Resets in ~8h",
    ...overrides,
  };
}

describe("quota-gate", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("validateMessageLength", () => {
    it("passes for short messages", () => {
      const result = validateMessageLength("Hello", "req-1");
      expect(result.ok).toBe(true);
    });

    it("passes for exactly max length", () => {
      const msg = "a".repeat(2000);
      const result = validateMessageLength(msg, "req-1");
      expect(result.ok).toBe(true);
    });

    it("rejects messages over 2000 chars", () => {
      const msg = "a".repeat(2001);
      const result = validateMessageLength(msg, "req-1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(400);
      }
    });

    it("supports custom max length", () => {
      const result = validateMessageLength("abcdef", "req-1", 5);
      expect(result.ok).toBe(false);
    });

    it("passes empty string", () => {
      const result = validateMessageLength("", "req-1");
      expect(result.ok).toBe(true);
    });
  });

  describe("enforceQuota — Path A (session token)", () => {
    it("passes with a valid session token", async () => {
      mockedVerify.mockReturnValue({ valid: true });

      const result = await enforceQuota(
        "valid-token",
        makeIdentity(),
        "zh" as any,
        "req-1"
      );
      expect(result.ok).toBe(true);
      expect(mockedVerify).toHaveBeenCalledWith("valid-token", "test-uid-123");
      expect(mockedConsume).not.toHaveBeenCalled();
    });

    it("rejects with an invalid session token", async () => {
      mockedVerify.mockReturnValue({ valid: false, reason: "expired" });

      const result = await enforceQuota(
        "expired-token",
        makeIdentity(),
        "zh" as any,
        "req-1"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
      }
    });

    it("does not consume quota when token is provided", async () => {
      mockedVerify.mockReturnValue({ valid: true });

      await enforceQuota("token", makeIdentity(), "zh" as any, "req-1");
      expect(mockedConsume).not.toHaveBeenCalled();
    });
  });

  describe("enforceQuota — Path B (direct call)", () => {
    it("passes when quota is available", async () => {
      mockedConsume.mockResolvedValue(makeUsageStatus({ blocked: false }));

      const result = await enforceQuota(
        undefined,
        makeIdentity(),
        "zh" as any,
        "req-1"
      );
      expect(result.ok).toBe(true);
      expect(mockedConsume).toHaveBeenCalledWith(
        "test-uid-123",
        false,
        "zh",
        undefined
      );
    });

    it("rejects when quota is exhausted", async () => {
      mockedConsume.mockResolvedValue(
        makeUsageStatus({
          blocked: true,
          used: 30,
          limit: 30,
          remaining: 0,
        })
      );

      const result = await enforceQuota(
        undefined,
        makeIdentity(),
        "zh" as any,
        "req-1"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(429);
      }
    });

    it("does not verify session token on Path B", async () => {
      mockedConsume.mockResolvedValue(makeUsageStatus());

      await enforceQuota(undefined, makeIdentity(), "zh" as any, "req-1");
      expect(mockedVerify).not.toHaveBeenCalled();
    });
  });
});
