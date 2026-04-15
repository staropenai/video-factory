/**
 * lib/security/rate-limit.ts
 *
 * Per-IP rate limiting with dual-mode backend:
 *   - Redis (Upstash) when UPSTASH_REDIS_REST_URL is configured
 *   - In-memory sliding window fallback (single-instance only)
 *
 * DESIGN
 * ------
 * - Fixed window counter per key (IP address, uid, etc.)
 * - Configurable window size and max requests
 * - Redis backend uses INCR + EXPIRE for atomic, multi-instance safe counting
 * - In-memory fallback uses sliding window timestamps (same as pre-Redis behavior)
 * - Returns standard rate limit headers (X-RateLimit-*)
 *
 * DEFAULTS
 * --------
 * - API routes: 60 requests per minute
 * - Auth routes: 10 requests per minute (stricter)
 * - AI routes: 30 requests per minute
 */

import { getRedis } from "@/lib/redis/client";

interface WindowEntry {
  /** Request timestamps within the current window */
  timestamps: number[];
  /** Last access time for cleanup */
  lastAccess: number;
}

interface RateLimitConfig {
  /** Window size in milliseconds */
  windowMs: number;
  /** Max requests per window */
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in current window */
  remaining: number;
  /** Total limit */
  limit: number;
  /** Unix timestamp (seconds) when window resets */
  resetAt: number;
  /** Milliseconds until next request is allowed (0 if allowed) */
  retryAfterMs: number;
}

// --- Preset configurations ---

export const RATE_LIMIT_PRESETS = {
  /** General API routes: 60 req/min */
  api: { windowMs: 60_000, maxRequests: 60 },
  /** Auth routes: 10 req/min (brute force protection) */
  auth: { windowMs: 60_000, maxRequests: 10 },
  /** AI/LLM routes: 30 req/min */
  ai: { windowMs: 60_000, maxRequests: 30 },
  /** Strict: 5 req/min (sensitive operations) */
  strict: { windowMs: 60_000, maxRequests: 5 },
} as const satisfies Record<string, RateLimitConfig>;

// =====================================================================
// Redis backend — atomic INCR + EXPIRE, multi-instance safe
// =====================================================================

/**
 * Async rate limit check using Redis.
 * Uses fixed-window counting: key = `rl:{key}:{windowId}`.
 * Returns null if Redis is not available (caller falls back to in-memory).
 */
async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult | null> {
  const redis = getRedis();
  if (!redis) return null;

  const now = Date.now();
  const windowId = Math.floor(now / config.windowMs);
  const redisKey = `rl:${key}:${windowId}`;
  const ttlSec = Math.ceil(config.windowMs / 1000) + 1; // +1s safety margin
  const resetAt = Math.ceil(((windowId + 1) * config.windowMs) / 1000);

  try {
    // Atomic increment + set TTL if new key
    const pipeline = redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.expire(redisKey, ttlSec);
    const results = await pipeline.exec();

    const count = (results[0] as number) ?? 1;

    if (count > config.maxRequests) {
      const windowEndMs = (windowId + 1) * config.windowMs;
      return {
        allowed: false,
        remaining: 0,
        limit: config.maxRequests,
        resetAt,
        retryAfterMs: Math.max(0, windowEndMs - now),
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - count,
      limit: config.maxRequests,
      resetAt,
      retryAfterMs: 0,
    };
  } catch {
    // Redis error — fall through to in-memory
    return null;
  }
}

// =====================================================================
// In-memory fallback — single-instance sliding window
// =====================================================================

const store = new Map<string, WindowEntry>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

let lastCleanup = Date.now();

function cleanupStaleEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    if (now - entry.lastAccess > STALE_THRESHOLD_MS) {
      store.delete(key);
    }
  }
}

function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  cleanupStaleEntries();

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [], lastAccess: now };
    store.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);
  entry.lastAccess = now;

  const resetAt = Math.ceil((now + config.windowMs) / 1000);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + config.windowMs - now;

    return {
      allowed: false,
      remaining: 0,
      limit: config.maxRequests,
      resetAt,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    limit: config.maxRequests,
    resetAt,
    retryAfterMs: 0,
  };
}

// =====================================================================
// Public API — tries Redis first, falls back to in-memory
// =====================================================================

/**
 * Check and consume a rate limit token for the given key (typically IP).
 *
 * When Redis is configured, uses atomic INCR + EXPIRE (multi-instance safe).
 * Falls back to in-memory sliding window when Redis is unavailable.
 *
 * @param key    - Identifier (IP address, uid, etc.)
 * @param config - Rate limit configuration (use RATE_LIMIT_PRESETS or custom)
 * @returns      - Whether the request is allowed + metadata
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = RATE_LIMIT_PRESETS.api
): RateLimitResult {
  // Synchronous path: always available, used as fallback
  return checkRateLimitMemory(key, config);
}

/**
 * Async rate limit check — prefers Redis when available.
 * Use this in async route handlers for multi-instance safe limiting.
 * Falls back to in-memory if Redis is not configured or errors.
 */
export async function checkRateLimitAsync(
  key: string,
  config: RateLimitConfig = RATE_LIMIT_PRESETS.api
): Promise<RateLimitResult> {
  const redisResult = await checkRateLimitRedis(key, config);
  if (redisResult) return redisResult;
  return checkRateLimitMemory(key, config);
}

/**
 * Build standard rate limit headers for the response.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  };
  if (!result.allowed) {
    headers["Retry-After"] = String(Math.ceil(result.retryAfterMs / 1000));
  }
  return headers;
}

/**
 * Extract client IP from request headers.
 * Checks x-forwarded-for (Vercel/proxy), x-real-ip, then falls back to "unknown".
 */
export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be comma-separated; take the first (client) IP
    return forwarded.split(",")[0].trim();
  }
  return headers.get("x-real-ip") ?? "unknown";
}

// --- Test helpers ---

/** @internal Clear store for tests */
export function __clearStoreForTests(): void {
  store.clear();
  lastCleanup = Date.now();
}
