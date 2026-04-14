/**
 * Tests for Redis client module.
 * Verifies singleton behavior and fallback when env vars are missing.
 */

// Mock @upstash/redis
jest.mock("@upstash/redis", () => ({
  Redis: jest.fn().mockImplementation(({ url, token }) => ({
    url,
    token,
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    pipeline: jest.fn(() => ({
      incr: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn().mockResolvedValue([1, true]),
    })),
  })),
}));

import { getRedis, isRedisAvailable, __resetForTests } from "../client";

describe("Redis client", () => {
  const ORIGINAL_URL = process.env.UPSTASH_REDIS_REST_URL;
  const ORIGINAL_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  afterEach(() => {
    __resetForTests();
    if (ORIGINAL_URL !== undefined) {
      process.env.UPSTASH_REDIS_REST_URL = ORIGINAL_URL;
    } else {
      delete process.env.UPSTASH_REDIS_REST_URL;
    }
    if (ORIGINAL_TOKEN !== undefined) {
      process.env.UPSTASH_REDIS_REST_TOKEN = ORIGINAL_TOKEN;
    } else {
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    }
  });

  it("returns null when env vars are not set", () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(getRedis()).toBeNull();
    expect(isRedisAvailable()).toBe(false);
  });

  it("returns null when only URL is set", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(getRedis()).toBeNull();
  });

  it("returns null when only token is set", () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    expect(getRedis()).toBeNull();
  });

  it("creates Redis client when both env vars are set", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    const client = getRedis();
    expect(client).not.toBeNull();
    expect(isRedisAvailable()).toBe(true);
  });

  it("returns same singleton on repeated calls", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    const client1 = getRedis();
    const client2 = getRedis();
    expect(client1).toBe(client2);
  });

  it("__resetForTests allows re-initialization", () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(getRedis()).toBeNull();

    __resetForTests();
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    expect(getRedis()).not.toBeNull();
  });
});
