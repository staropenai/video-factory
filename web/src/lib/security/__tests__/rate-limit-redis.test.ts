/**
 * Tests for Redis-backed rate limiting.
 * Tests both the async Redis path and the in-memory fallback.
 */

// Mock Redis client
const mockIncr = jest.fn();
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
      ? { pipeline: mockPipeline }
      : null,
}));

import {
  checkRateLimit,
  checkRateLimitAsync,
  __clearStoreForTests,
  RATE_LIMIT_PRESETS,
} from "../rate-limit";

describe("Rate limit — in-memory fallback", () => {
  beforeEach(() => {
    __clearStoreForTests();
    mockRedisAvailable = false;
  });

  it("allows requests under limit", () => {
    const result = checkRateLimit("ip-1", { windowMs: 60_000, maxRequests: 5 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks after exceeding limit", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("ip-2", { windowMs: 60_000, maxRequests: 5 });
    }
    const result = checkRateLimit("ip-2", { windowMs: 60_000, maxRequests: 5 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("different keys are independent", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("ip-3a", { windowMs: 60_000, maxRequests: 5 });
    }
    const result = checkRateLimit("ip-3b", { windowMs: 60_000, maxRequests: 5 });
    expect(result.allowed).toBe(true);
  });

  it("uses preset configurations", () => {
    const result = checkRateLimit("ip-4", RATE_LIMIT_PRESETS.auth);
    expect(result.limit).toBe(10);
  });
});

describe("Rate limit — async Redis path", () => {
  beforeEach(() => {
    __clearStoreForTests();
    mockRedisAvailable = true;
    mockPipeline.mockClear();
    mockIncr.mockClear();
    mockExpire.mockClear();
    mockExec.mockClear();
  });

  it("uses Redis when available", async () => {
    mockExec.mockResolvedValue([3, true]);
    const result = await checkRateLimitAsync("ip-5", {
      windowMs: 60_000,
      maxRequests: 10,
    });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(7);
    expect(mockPipeline).toHaveBeenCalled();
  });

  it("blocks when Redis count exceeds limit", async () => {
    mockExec.mockResolvedValue([11, true]);
    const result = await checkRateLimitAsync("ip-6", {
      windowMs: 60_000,
      maxRequests: 10,
    });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("falls back to in-memory when Redis errors", async () => {
    mockExec.mockRejectedValue(new Error("Redis connection failed"));
    const result = await checkRateLimitAsync("ip-7", {
      windowMs: 60_000,
      maxRequests: 10,
    });
    // Should still work via in-memory fallback
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("falls back to in-memory when Redis is unavailable", async () => {
    mockRedisAvailable = false;
    const result = await checkRateLimitAsync("ip-8", {
      windowMs: 60_000,
      maxRequests: 5,
    });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("sends correct TTL to Redis", async () => {
    mockExec.mockResolvedValue([1, true]);
    await checkRateLimitAsync("ip-9", { windowMs: 60_000, maxRequests: 10 });
    // expire should be called with TTL = ceil(60000/1000) + 1 = 61
    expect(mockExpire).toHaveBeenCalledWith(expect.any(String), 61);
  });
});
