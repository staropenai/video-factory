/**
 * V5 T4: Idempotency key tests for quota consumption.
 *
 * Validates that:
 *   1. Same idempotency key → quota consumed only once
 *   2. Different keys → independent consumption
 *   3. No key provided → normal (non-idempotent) behavior
 *   4. Redis unavailable → idempotency check skipped gracefully
 */

// Mock next/headers (cookies)
jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: () => ({ value: "test-uid-idem" }),
      set: jest.fn(),
    })
  ),
}));

// Mock Redis client with idempotency support
const mockGet = jest.fn();
const mockIncr = jest.fn();
const mockDecr = jest.fn();
const mockExpire = jest.fn();
const mockExec = jest.fn();
const mockSet = jest.fn();
const mockPipeline = jest.fn(() => ({
  incr: mockIncr,
  expire: mockExpire,
  exec: mockExec,
}));

let mockRedisAvailable = false;

jest.mock("@/lib/redis/client", () => ({
  getRedis: () =>
    mockRedisAvailable
      ? {
          get: mockGet,
          incr: mockIncr,
          decr: mockDecr,
          set: mockSet,
          pipeline: mockPipeline,
        }
      : null,
}));

import {
  consumeQuota,
  __clearStoreForTests,
  QUOTA_ANONYMOUS,
} from "../tracker";

describe("Quota idempotency — Redis path", () => {
  beforeEach(() => {
    __clearStoreForTests();
    mockRedisAvailable = true;
    mockGet.mockClear();
    mockIncr.mockClear();
    mockDecr.mockClear();
    mockExpire.mockClear();
    mockExec.mockClear();
    mockPipeline.mockClear();
    mockSet.mockClear();
  });

  it("first call with idempotency key consumes quota", async () => {
    // SET NX returns "OK" for new key
    mockSet.mockResolvedValue("OK");
    // INCR pipeline returns count=1
    mockExec.mockResolvedValue([1, true]);

    const result = await consumeQuota("uid-idem-1", false, "en", "key-abc-1");
    expect(result.blocked).toBe(false);
    expect(result.used).toBe(1);
    expect(mockSet).toHaveBeenCalledWith(
      "idem:key-abc-1",
      "1",
      expect.objectContaining({ nx: true, ex: 86400 })
    );
  });

  it("duplicate idempotency key returns status without incrementing", async () => {
    // SET NX returns null for duplicate key
    mockSet.mockResolvedValue(null);
    // getUsageStatus reads from Redis
    mockGet.mockResolvedValue(5);

    const result = await consumeQuota("uid-idem-2", false, "en", "key-abc-2");
    // Should NOT have called pipeline (no INCR)
    expect(mockPipeline).not.toHaveBeenCalled();
    // Should return current usage status
    expect(result.used).toBe(5);
    expect(result.blocked).toBe(false);
  });

  it("different idempotency keys consume independently", async () => {
    mockSet.mockResolvedValue("OK"); // Both are "new"
    mockExec.mockResolvedValueOnce([1, true]).mockResolvedValueOnce([2, true]);

    const r1 = await consumeQuota("uid-idem-3", false, "en", "key-x");
    const r2 = await consumeQuota("uid-idem-3", false, "en", "key-y");
    expect(r1.used).toBe(1);
    expect(r2.used).toBe(2);
  });

  it("no idempotency key → normal consumption", async () => {
    mockExec.mockResolvedValue([3, true]);

    const result = await consumeQuota("uid-idem-4", false, "en");
    // No SET call for idempotency
    expect(mockSet).not.toHaveBeenCalled();
    expect(result.used).toBe(3);
  });
});

describe("Quota idempotency — fallback when Redis unavailable", () => {
  beforeEach(() => {
    __clearStoreForTests();
    mockRedisAvailable = false;
    mockSet.mockClear();
  });

  it("idempotency key is ignored when Redis is down", async () => {
    const r1 = await consumeQuota("uid-idem-5", false, "en", "key-no-redis");
    const r2 = await consumeQuota("uid-idem-5", false, "en", "key-no-redis");
    // Both consume (no idempotency without Redis)
    expect(r1.used).toBe(1);
    expect(r2.used).toBe(2);
  });
});

describe("Quota idempotency — Redis error handling", () => {
  beforeEach(() => {
    __clearStoreForTests();
    mockRedisAvailable = true;
    mockSet.mockClear();
    mockExec.mockClear();
    mockPipeline.mockClear();
  });

  it("Redis SET error → falls through to normal consumption", async () => {
    mockSet.mockRejectedValue(new Error("Redis SET failed"));
    mockExec.mockResolvedValue([1, true]);

    const result = await consumeQuota("uid-idem-6", false, "en", "key-error");
    // Should still work via normal path
    expect(result.blocked).toBe(false);
    expect(result.used).toBe(1);
  });
});
