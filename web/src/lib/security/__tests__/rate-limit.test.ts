/**
 * lib/security/__tests__/rate-limit.test.ts
 *
 * Unit tests for the per-IP rate limiter.
 */

import {
  checkRateLimit,
  rateLimitHeaders,
  extractClientIp,
  RATE_LIMIT_PRESETS,
  __clearStoreForTests,
} from "../rate-limit";

beforeEach(() => {
  __clearStoreForTests();
});

describe("security/rate-limit", () => {
  describe("checkRateLimit", () => {
    it("allows requests under the limit", () => {
      const config = { windowMs: 60_000, maxRequests: 5 };
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit("ip-1", config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it("blocks requests over the limit", () => {
      const config = { windowMs: 60_000, maxRequests: 3 };
      for (let i = 0; i < 3; i++) {
        checkRateLimit("ip-2", config);
      }
      const result = checkRateLimit("ip-2", config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it("isolates different keys", () => {
      const config = { windowMs: 60_000, maxRequests: 1 };
      const r1 = checkRateLimit("ip-a", config);
      const r2 = checkRateLimit("ip-b", config);
      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);

      // Both at limit now
      expect(checkRateLimit("ip-a", config).allowed).toBe(false);
      expect(checkRateLimit("ip-b", config).allowed).toBe(false);
    });

    it("allows requests after window expires", () => {
      const config = { windowMs: 100, maxRequests: 1 };
      checkRateLimit("ip-3", config);
      expect(checkRateLimit("ip-3", config).allowed).toBe(false);

      // Fast-forward past window
      const realNow = Date.now;
      Date.now = () => realNow() + 150;
      expect(checkRateLimit("ip-3", config).allowed).toBe(true);
      Date.now = realNow;
    });

    it("uses api preset by default", () => {
      const result = checkRateLimit("ip-default");
      expect(result.limit).toBe(RATE_LIMIT_PRESETS.api.maxRequests);
    });

    it("returns correct resetAt as unix seconds", () => {
      const result = checkRateLimit("ip-reset", { windowMs: 60_000, maxRequests: 10 });
      const nowSec = Math.ceil(Date.now() / 1000);
      // resetAt should be roughly now + 60s
      expect(result.resetAt).toBeGreaterThanOrEqual(nowSec + 59);
      expect(result.resetAt).toBeLessThanOrEqual(nowSec + 61);
    });
  });

  describe("rateLimitHeaders", () => {
    it("returns standard headers for allowed request", () => {
      const headers = rateLimitHeaders({
        allowed: true,
        remaining: 5,
        limit: 10,
        resetAt: 1700000000,
        retryAfterMs: 0,
      });
      expect(headers["X-RateLimit-Limit"]).toBe("10");
      expect(headers["X-RateLimit-Remaining"]).toBe("5");
      expect(headers["X-RateLimit-Reset"]).toBe("1700000000");
      expect(headers["Retry-After"]).toBeUndefined();
    });

    it("includes Retry-After for blocked request", () => {
      const headers = rateLimitHeaders({
        allowed: false,
        remaining: 0,
        limit: 10,
        resetAt: 1700000000,
        retryAfterMs: 30_000,
      });
      expect(headers["Retry-After"]).toBe("30");
    });
  });

  describe("extractClientIp", () => {
    it("extracts from x-forwarded-for (first IP)", () => {
      const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
      expect(extractClientIp(headers)).toBe("1.2.3.4");
    });

    it("extracts single x-forwarded-for", () => {
      const headers = new Headers({ "x-forwarded-for": "10.0.0.1" });
      expect(extractClientIp(headers)).toBe("10.0.0.1");
    });

    it("falls back to x-real-ip", () => {
      const headers = new Headers({ "x-real-ip": "192.168.1.1" });
      expect(extractClientIp(headers)).toBe("192.168.1.1");
    });

    it("returns 'unknown' when no IP headers", () => {
      const headers = new Headers();
      expect(extractClientIp(headers)).toBe("unknown");
    });

    it("prefers x-forwarded-for over x-real-ip", () => {
      const headers = new Headers({
        "x-forwarded-for": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
      });
      expect(extractClientIp(headers)).toBe("1.1.1.1");
    });
  });

  describe("presets", () => {
    it("auth preset is stricter than api", () => {
      expect(RATE_LIMIT_PRESETS.auth.maxRequests).toBeLessThan(
        RATE_LIMIT_PRESETS.api.maxRequests
      );
    });

    it("strict preset is the strictest", () => {
      expect(RATE_LIMIT_PRESETS.strict.maxRequests).toBeLessThanOrEqual(
        RATE_LIMIT_PRESETS.auth.maxRequests
      );
    });
  });
});
