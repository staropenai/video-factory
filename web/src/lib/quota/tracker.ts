/**
 * lib/quota/tracker.ts
 *
 * Server-side per-user daily AI quota tracker.
 *
 * DESIGN DECISIONS
 * ----------------
 * 1. Storage: dual-mode.
 *    - Redis (Upstash) when UPSTASH_REDIS_REST_URL is configured.
 *      Uses Redis Hash with atomic HINCRBY for concurrent-safe counting.
 *      Key: `quota:{uid}:{dateKey}`, TTL: 25 hours (auto-cleanup).
 *    - In-memory Map fallback (single-instance, resets on cold-start).
 *    Redis errors fall back to in-memory silently.
 *
 * 2. Identity: jtg_uid cookie (httpOnly, SameSite=Lax).
 *    Anonymously-issued UUID. Not a security claim — just a best-effort
 *    continuity token so the same browser session shares one counter.
 *
 * 3. Quota rules (from spec):
 *    - Anonymous   : 30 AI calls / day
 *    - Authenticated: 50 AI calls / day
 *    - Upgrade hint : shown when used >= 20 (not on hard-block)
 *    - Hard block   : remaining <= 0
 *    - Reset        : midnight JST (UTC+9)
 *
 * 4. This module is ONLY imported in server-side code (API routes, RSC).
 *    Never import in client components.
 */

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { getRedis } from "@/lib/redis/client";

// --- Constants (exported for tests) ---

export const QUOTA_ANONYMOUS = 30;
export const QUOTA_AUTHENTICATED = 50;
export const UPGRADE_HINT_THRESHOLD = 20;
export const COOKIE_NAME = "jtg_uid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// --- Types ---

export interface UsageStatus {
  uid: string;
  isAuthenticated: boolean;
  used: number;
  limit: number;
  remaining: number;
  /**
   * true when this specific call was REJECTED (counter not incremented).
   * false when the call was accepted, even if remaining === 0.
   *
   * For getUsageStatus(): blocked = remaining <= 0 (read-only check).
   * For consumeQuota(): blocked = true only when rejected; false on success.
   *
   * UI rule: disable submit when remaining <= 0, not when blocked.
   */
  blocked: boolean;
  /** true when used >= UPGRADE_HINT_THRESHOLD */
  showUpgradeHint: boolean;
  /** Human-readable reset time in the user's locale */
  resetAtText: string;
}

interface CounterEntry {
  used: number;
  dateKey: string; // "YYYY-MM-DD" in JST
  isAuthenticated: boolean;
}

// --- In-memory store ---

const store = new Map<string, CounterEntry>();

// --- Per-uid mutex (prevents check-then-increment race in consumeQuota) ---

const locks = new Map<string, Promise<void>>();

/**
 * Acquire a promise-based lock for the given uid.
 * Returns a release function that MUST be called when done.
 */
function acquireLock(uid: string): Promise<() => void> {
  const prev = locks.get(uid) ?? Promise.resolve();
  let release: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(uid, next);
  return prev.then(() => release!);
}

/**
 * Clear the in-memory store. For use in tests only.
 * @internal
 */
export function __clearStoreForTests(): void {
  store.clear();
}

// --- Helpers ---

/** Returns "YYYY-MM-DD" for the current day in JST (UTC+9). */
function jstDateKey(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/**
 * Produce a human-readable reset time string.
 */
function resetAtText(lang: string): string {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const nextMidnight = new Date(jstNow);
  nextMidnight.setUTCHours(24, 0, 0, 0);
  const msLeft = nextMidnight.getTime() - jstNow.getTime();
  const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));

  const map: Record<string, string> = {
    ja: `約${hoursLeft}時間後にリセット`,
    ko: `약 ${hoursLeft}시간 후 초기화`,
    vi: `Làm mới sau khoảng ${hoursLeft} giờ`,
    th: `รีเซ็ตในอีกประมาณ ${hoursLeft} ชั่วโมง`,
    en: `Resets in ~${hoursLeft}h`,
  };

  // Default is Chinese
  return map[lang] ?? `约 ${hoursLeft} 小时后重置`;
}

/** Resolve or create a UID from the httpOnly cookie. */
export async function resolveUid(): Promise<{
  uid: string;
  isNew: boolean;
}> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;

  if (existing && existing.length >= 8) {
    return { uid: existing, isNew: false };
  }

  return { uid: randomUUID(), isNew: true };
}

// --- Legacy aliases (used by existing router code) ---

/** @deprecated Use resolveUid() instead */
export async function getOrCreateUid(): Promise<{
  uid: string;
  isNew: boolean;
}> {
  return resolveUid();
}

// =====================================================================
// Redis helpers — atomic counter with daily TTL
// =====================================================================

const QUOTA_TTL_SEC = 25 * 60 * 60; // 25 hours (covers full JST day + margin)

function quotaRedisKey(uid: string, dateKey: string): string {
  return `quota:${uid}:${dateKey}`;
}

/**
 * Read current usage from Redis. Returns null if Redis unavailable.
 */
async function getUsedFromRedis(uid: string, dateKey: string): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const val = await redis.get<number>(quotaRedisKey(uid, dateKey));
    return val ?? 0;
  } catch {
    return null;
  }
}

/**
 * Atomic increment in Redis using INCR + conditional EXPIRE.
 * Returns new count, or null if Redis unavailable.
 */
async function incrQuotaRedis(uid: string, dateKey: string): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const key = quotaRedisKey(uid, dateKey);
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, QUOTA_TTL_SEC);
    const results = await pipeline.exec();
    return (results[0] as number) ?? null;
  } catch {
    return null;
  }
}

/**
 * Atomic decrement (rollback) in Redis. Best-effort, no error on failure.
 */
async function decrQuotaRedis(uid: string, dateKey: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.decr(quotaRedisKey(uid, dateKey));
  } catch {
    // best-effort rollback
  }
}

// =====================================================================
// Public API — tries Redis first, falls back to in-memory
// =====================================================================

/**
 * Read-only status query — does NOT increment the counter.
 * Prefers Redis when configured; falls back to in-memory.
 */
export async function getUsageStatus(
  uid: string,
  isAuthenticated: boolean,
  lang = "zh"
): Promise<UsageStatus> {
  const dateKey = jstDateKey();
  const limit = isAuthenticated ? QUOTA_AUTHENTICATED : QUOTA_ANONYMOUS;

  // Try Redis first
  const redisUsed = await getUsedFromRedis(uid, dateKey);
  const used = redisUsed ?? ((): number => {
    const entry = store.get(uid);
    return entry && entry.dateKey === dateKey ? entry.used : 0;
  })();

  const remaining = Math.max(0, limit - used);

  return {
    uid,
    isAuthenticated,
    used,
    limit,
    remaining,
    blocked: remaining <= 0,
    showUpgradeHint: used >= UPGRADE_HINT_THRESHOLD,
    resetAtText: resetAtText(lang),
  };
}

/** @deprecated Use getUsageStatus() instead */
export function checkUsage(
  uid: string,
  isAuthenticated: boolean,
  lang = "zh"
): {
  uid: string;
  used: number;
  limit: number;
  remaining: number;
  resetAtText: string;
  showUpgradeHint: boolean;
  isAuthenticated: boolean;
} {
  const dateKey = jstDateKey();
  const entry = store.get(uid);
  const limit = isAuthenticated ? QUOTA_AUTHENTICATED : QUOTA_ANONYMOUS;
  const used = entry && entry.dateKey === dateKey ? entry.used : 0;

  return {
    uid,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetAtText: resetAtText(lang),
    showUpgradeHint: used >= UPGRADE_HINT_THRESHOLD,
    isAuthenticated,
  };
}

// =====================================================================
// Idempotency key support (V5 T4)
// =====================================================================

/**
 * Check and mark an idempotency key in Redis.
 * Returns "new" if the key was not seen before (and is now marked),
 * "duplicate" if already processed, or null if Redis unavailable.
 *
 * maturity: transitional
 * notEquivalentTo: not a distributed lock — 24h TTL means same key can
 * re-trigger after expiry (known limitation)
 */
async function checkIdempotencyKey(key: string): Promise<"new" | "duplicate" | null> {
  const redis = getRedis();
  if (!redis || !key) return null;
  try {
    const idemRedisKey = `idem:${key}`;
    // SET NX with 24h TTL — returns "OK" only if key was new
    const result = await redis.set(idemRedisKey, "1", { nx: true, ex: 86400 });
    return result === "OK" ? "new" : "duplicate";
  } catch {
    return null; // Redis error → skip idempotency check
  }
}

/**
 * Attempt to consume one quota unit.
 * If blocked, used is NOT incremented.
 *
 * Redis path: INCR is atomic — no race conditions even across instances.
 * If INCR result exceeds limit, we DECR to rollback the over-count.
 * Idempotency: when idempotencyKey is provided and Redis is available,
 * duplicate requests skip consumption (V5 T4).
 *
 * In-memory path: uses per-UID promise lock (same as pre-Redis behavior).
 */
export async function consumeQuota(
  uid: string,
  isAuthenticated: boolean,
  lang = "zh",
  idempotencyKey?: string
): Promise<UsageStatus> {
  const dateKey = jstDateKey();
  const limit = isAuthenticated ? QUOTA_AUTHENTICATED : QUOTA_ANONYMOUS;

  // ── V5 T4: Idempotency check (Redis only) ────────────────────
  if (idempotencyKey) {
    const idemResult = await checkIdempotencyKey(idempotencyKey);
    if (idemResult === "duplicate") {
      // Already processed — return current status without incrementing
      return getUsageStatus(uid, isAuthenticated, lang);
    }
  }

  // ── Try Redis (atomic, multi-instance safe) ───────────────────
  const redisCount = await incrQuotaRedis(uid, dateKey);
  if (redisCount !== null) {
    if (redisCount > limit) {
      // Over limit — rollback the increment
      await decrQuotaRedis(uid, dateKey);
      return {
        uid,
        isAuthenticated,
        used: redisCount - 1, // actual count before our failed increment
        limit,
        remaining: 0,
        blocked: true,
        showUpgradeHint: true,
        resetAtText: resetAtText(lang),
      };
    }

    const remaining = Math.max(0, limit - redisCount);
    return {
      uid,
      isAuthenticated,
      used: redisCount,
      limit,
      remaining,
      blocked: false,
      showUpgradeHint: redisCount >= UPGRADE_HINT_THRESHOLD,
      resetAtText: resetAtText(lang),
    };
  }

  // ── Fallback: in-memory with per-UID lock ─────────────────────
  const release = await acquireLock(uid);
  try {
    const existing = store.get(uid);
    const currentUsed =
      existing && existing.dateKey === dateKey ? existing.used : 0;

    if (currentUsed >= limit) {
      return {
        uid,
        isAuthenticated,
        used: currentUsed,
        limit,
        remaining: 0,
        blocked: true,
        showUpgradeHint: true,
        resetAtText: resetAtText(lang),
      };
    }

    const newUsed = currentUsed + 1;
    store.set(uid, { used: newUsed, dateKey, isAuthenticated });

    const remaining = Math.max(0, limit - newUsed);
    return {
      uid,
      isAuthenticated,
      used: newUsed,
      limit,
      remaining,
      blocked: false,
      showUpgradeHint: newUsed >= UPGRADE_HINT_THRESHOLD,
      resetAtText: resetAtText(lang),
    };
  } finally {
    release();
  }
}

/** @deprecated Use consumeQuota() instead */
export function incrementUsage(
  uid: string,
  isAuthenticated: boolean,
  lang = "zh"
): { allowed: boolean; status: { uid: string; used: number; limit: number; remaining: number; resetAtText: string; showUpgradeHint: boolean; isAuthenticated: boolean } } {
  const dateKey = jstDateKey();
  const limit = isAuthenticated ? QUOTA_AUTHENTICATED : QUOTA_ANONYMOUS;

  const existing = store.get(uid);
  const currentUsed =
    existing && existing.dateKey === dateKey ? existing.used : 0;

  if (currentUsed >= limit) {
    return {
      allowed: false,
      status: {
        uid,
        used: currentUsed,
        limit,
        remaining: 0,
        resetAtText: resetAtText(lang),
        showUpgradeHint: true,
        isAuthenticated,
      },
    };
  }

  const newUsed = currentUsed + 1;
  store.set(uid, { used: newUsed, dateKey, isAuthenticated });

  return {
    allowed: true,
    status: {
      uid,
      used: newUsed,
      limit,
      remaining: Math.max(0, limit - newUsed),
      resetAtText: resetAtText(lang),
      showUpgradeHint: newUsed >= UPGRADE_HINT_THRESHOLD,
      isAuthenticated,
    },
  };
}

/**
 * Mark a user as having provided contact info (upgrade from anon to auth limit).
 */
export function markContactProvided(uid: string): void {
  const dateKey = jstDateKey();
  const existing = store.get(uid);
  if (existing && existing.dateKey === dateKey) {
    existing.isAuthenticated = true;
  }
}
