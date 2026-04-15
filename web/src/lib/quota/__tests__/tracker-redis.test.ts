/**
 * Tests for Redis-backed quota tracker.
 * Validates dual-mode behavior: Redis when available, in-memory fallback.
 */

// Mock next/headers (cookies)
jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: () => ({ value: "test-uid-123" }),
      set: jest.fn(),
    })
  ),
}));

// Mock Redis client with controllable behavior
const mockGet = jest.fn();
const mockIncr = jest.fn();
const mockDecr = jest.fn();
const mockExpire = jest.fn();
const mockExec = jest.fn();
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
          pipeline: mockPipeline,
        }
      : null,
}));

import {
  consumeQuota,
  getUsageStatus,
  __clearStoreForTests,
  QUOTA_ANONYMOUS,
  QUOTA_AUTHENTICATED,
  UPGRADE_HINT_THRESHOLD,
} from "../tracker";

describe("Quota tracker — in-memory fallback", () => {
  beforeEach(() => {
    __clearStoreForTests();
    mockRedisAvailable = false;
  });

  it("allows first call with full remaining quota", async () => {
    const result = await consumeQuota("uid-1", false, "en");
    expect(result.blocked).toBe(false);
    expect(result.used).toBe(1);
    expect(result.remaining).toBe(QUOTA_ANONYMOUS - 1);
  });

  it("blocks after exceeding daily limit", async () => {
    for (let i = 0; i < QUOTA_ANONYMOUS; i++) {
      await consumeQuota("uid-2", false, "en");
    }
    const result = await consumeQuota("uid-2", false, "en");
    expect(result.blocked).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("uses authenticated limit when isAuthenticated=true", async () => {
    const result = await consumeQuota("uid-3", true, "en");
    expect(result.limit).toBe(QUOTA_AUTHENTICATED);
    expect(result.remaining).toBe(QUOTA_AUTHENTICATED - 1);
  });

  it("shows upgrade hint at threshold", async () => {
    for (let i = 0; i < UPGRADE_HINT_THRESHOLD; i++) {
      await consumeQuota("uid-4", false, "en");
    }
    const result = await getUsageStatus("uid-4", false, "en");
    expect(result.showUpgradeHint).toBe(true);
  });

  it("getUsageStatus does NOT increment counter", async () => {
    await consumeQuota("uid-5", false, "en");
    const s1 = await getUsageStatus("uid-5", false, "en");
    const s2 = await getUsageStatus("uid-5", false, "en");
    expect(s1.used).toBe(1);
    expect(s2.used).toBe(1);
  });

  it("different uids are independent", async () => {
    await consumeQuota("uid-6a", false, "en");
    await consumeQuota("uid-6a", false, "en");
    const result = await consumeQuota("uid-6b", false, "en");
    expect(result.used).toBe(1);
  });

  it("includes localized resetAtText", async () => {
    const resultZh = await consumeQuota("uid-7", false, "zh");
    expect(resultZh.resetAtText).toContain("重置");

    __clearStoreForTests();
    const resultEn = await consumeQuota("uid-8", false, "en");
    expect(resultEn.resetAtText).toContain("Resets");

    __clearStoreForTests();
    const resultJa = await consumeQuota("uid-9", false, "ja");
    expect(resultJa.resetAtText).toContain("リセット");
  });
});

describe("Quota tracker — Redis path", () => {
  beforeEach(() => {
    __clearStoreForTests();
    mockRedisAvailable = true;
    mockGet.mockClear();
    mockIncr.mockClear();
    mockDecr.mockClear();
    mockExpire.mockClear();
    mockExec.mockClear();
    mockPipeline.mockClear();
  });

  it("consumes quota via Redis INCR", async () => {
    mockExec.mockResolvedValue([5, true]);
    const result = await consumeQuota("uid-r1", false, "en");
    expect(result.blocked).toBe(false);
    expect(result.used).toBe(5);
    expect(result.remaining).toBe(QUOTA_ANONYMOUS - 5);
    expect(mockPipeline).toHaveBeenCalled();
  });

  it("blocks and rolls back when Redis count exceeds limit", async () => {
    mockExec.mockResolvedValue([QUOTA_ANONYMOUS + 1, true]);
    mockDecr.mockResolvedValue(QUOTA_ANONYMOUS);
    const result = await consumeQuota("uid-r2", false, "en");
    expect(result.blocked).toBe(true);
    expect(result.used).toBe(QUOTA_ANONYMOUS); // the count before our failed increment
    expect(mockDecr).toHaveBeenCalled();
  });

  it("falls back to in-memory when Redis errors", async () => {
    mockExec.mockRejectedValue(new Error("Redis timeout"));
    const result = await consumeQuota("uid-r3", false, "en");
    // Should still work via in-memory
    expect(result.blocked).toBe(false);
    expect(result.used).toBe(1);
  });

  it("getUsageStatus reads from Redis", async () => {
    mockGet.mockResolvedValue(15);
    const result = await getUsageStatus("uid-r4", false, "en");
    expect(result.used).toBe(15);
    expect(result.remaining).toBe(QUOTA_ANONYMOUS - 15);
    expect(mockGet).toHaveBeenCalled();
  });

  it("getUsageStatus falls back to in-memory on Redis error", async () => {
    mockGet.mockRejectedValue(new Error("Redis down"));
    const result = await getUsageStatus("uid-r5", false, "en");
    // In-memory: fresh store, so used=0
    expect(result.used).toBe(0);
    expect(result.remaining).toBe(QUOTA_ANONYMOUS);
  });

  it("uses authenticated limit in Redis path", async () => {
    mockExec.mockResolvedValue([10, true]);
    const result = await consumeQuota("uid-r6", true, "en");
    expect(result.limit).toBe(QUOTA_AUTHENTICATED);
    expect(result.remaining).toBe(QUOTA_AUTHENTICATED - 10);
  });
});
