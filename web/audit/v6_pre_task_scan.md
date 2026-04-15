# AUDIT 基线扫描 — 2026-04-13T23:11:41Z

## 1. /api/query/stream 实际路径
src/app/api/router/stream/route.ts

## 2. Tier A/B 分流逻辑是否存在
src/app/api/review/faq-candidates/[id]/publish/route.ts:55:const TIERS: LiveFaqRow['tier'][] = ['A', 'B', 'C']
src/app/api/router/stream/route.ts:198:        const tier = baselineRetrieval.summary.shortcut === "tier_a_shortcut" ? "A" : "B";
src/app/api/router/stream/route.ts:250:        // V5 T2: Evidence record with ttft_ms and kb_hit (non-blocking)
src/app/api/router/stream/route.ts:258:              routeTaken: tier === "A" ? "L1_STATIC" : "L1_STATIC",
src/app/api/router/stream/route.ts:270:            // V5 T1/T2: Attach ttft_ms, kb_hit, tier to evidence record
src/app/api/router/stream/route.ts:272:            ecRecord.kb_hit = true;
src/app/api/router/stream/route.ts:291:          kb_hit: true,
src/app/api/router/stream/route.ts:406:        tier: shortcut === "tier_a_shortcut" ? "A" : "B",
src/app/api/router/stream/route.ts:491:          const tierCLatency = Date.now() - startedAt;
src/app/api/router/stream/route.ts:557:          const tierCTotalMs = Date.now() - startedAt;
src/app/api/router/stream/route.ts:578:            ecRecord.kb_hit = false;
src/hooks/useStreamQuery.ts:24:  /** Which tier answered: "A", "B", "C", "CACHE", "L6", or null */
src/lib/patent/evidence-chain-logger.ts:70:  kb_hit?: boolean
src/lib/patent/evidence-chain-logger.ts:72:  tier?: 'A' | 'B' | 'C' | 'L6'
src/lib/knowledge/retrieve.ts:73:  tier: 'A' | 'B' | 'C',
src/lib/knowledge/retrieve.ts:79:  if (tier === 'A') return 'tier_a_shortcut'
src/lib/knowledge/retrieve.ts:80:  if (tier === 'B') return 'tier_b_shortcut'
src/lib/knowledge/seed.ts:2330:/** Resolve the effective tier of a seed FAQ entry. */
src/lib/knowledge/seed.ts:2360:    tier: (f.tier ?? TIER_BY_SUBTOPIC[f.subtopic] ?? "C") as FaqTier,
src/lib/knowledge/faq-sync.ts:87:  const tier = TIER_MAP[key] ?? 'C'

## 3. evidence_records 写入入口
src/app/api/bridge/session/route.ts:33:import { createEvidenceRecord, logEvidenceRecord } from '@/lib/patent/evidence-chain-logger'
src/app/api/bridge/session/route.ts:125:          const ecRecord = createEvidenceRecord({
src/app/api/bridge/session/route.ts:142:          logEvidenceRecord(ecRecord)
src/app/api/router/stream/route.ts:54:import { createEvidenceRecord, logEvidenceRecord } from "@/lib/patent/evidence-chain-logger";
src/app/api/router/stream/route.ts:253:            const ecRecord = createEvidenceRecord({
src/app/api/router/stream/route.ts:274:            const written = logEvidenceRecord(ecRecord);
src/app/api/router/stream/route.ts:559:            const ecRecord = createEvidenceRecord({
src/app/api/router/stream/route.ts:580:            const written = logEvidenceRecord(ecRecord);
src/app/api/router/route.ts:53:import { createEvidenceRecord, logEvidenceRecord } from '@/lib/patent/evidence-chain-logger'
src/app/api/router/route.ts:634:      const ecRecord = createEvidenceRecord({
src/app/api/router/route.ts:660:      logEvidenceRecord(ecRecord)
src/lib/patent/evidence-chain-logger.ts:110:export function createEvidenceRecord(params: {
src/lib/patent/evidence-chain-logger.ts:488:export function logEvidenceRecord(record: EvidenceChainRecord): boolean {

## 4. ttft_ms 字段
src/app/api/router/stream/route.ts:53:import { recordRouterLatency, recordTTFT, recordTierHit } from "@/lib/monitoring/ttft";
src/app/api/router/stream/route.ts:250:        // V5 T2: Evidence record with ttft_ms and kb_hit (non-blocking)
src/app/api/router/stream/route.ts:270:            // V5 T1/T2: Attach ttft_ms, kb_hit, tier to evidence record
src/app/api/router/stream/route.ts:271:            ecRecord.ttft_ms = fastLatency;
src/app/api/router/stream/route.ts:556:          // V5 T2: Evidence record for Tier C with ttft_ms
src/app/api/router/stream/route.ts:577:            ecRecord.ttft_ms = tierCTotalMs;
src/hooks/useStreamQuery.ts:172:                        Sentry.setMeasurement("client_ttft_ms", clientTtft, "millisecond");
src/lib/patent/evidence-chain-logger.ts:68:  ttft_ms?: number
src/lib/monitoring/ttft.ts:32:  recordMetric("jtg.router.ttft", ttftMs, "millisecond", { tier: "C" });

## 5. Sentry 状态
    "@sentry/nextjs": "^10.48.0",
src/hooks/useStreamQuery.ts:171:                      import("@sentry/nextjs").then((Sentry) => {
src/hooks/useStreamQuery.ts:172:                        Sentry.setMeasurement("client_ttft_ms", clientTtft, "millisecond");
src/lib/monitoring/sentry.ts:11:import * as Sentry from "@sentry/nextjs";
src/lib/monitoring/sentry.ts:30:  Sentry.withScope((scope) => {
src/lib/monitoring/sentry.ts:37:    Sentry.captureException(
src/lib/monitoring/sentry.ts:54:  const span = Sentry.startInactiveSpan({ name, op });
src/lib/monitoring/sentry.ts:73:    Sentry.metrics.distribution(name, value, {
src/instrumentation.ts:17:    const Sentry = await import("@sentry/nextjs");
src/instrumentation.ts:18:    Sentry.init({

## 6. Redis 状态
    "@upstash/redis": "^1.37.0",
src/app/api/router/quota-gate.ts:97:  // V5 T4: pass idempotency key for dedup when Redis is available
src/lib/security/rate-limit.ts:5: *   - Redis (Upstash) when UPSTASH_REDIS_REST_URL is configured
src/lib/security/rate-limit.ts:12: * - Redis backend uses INCR + EXPIRE for atomic, multi-instance safe counting
src/lib/security/rate-limit.ts:13: * - In-memory fallback uses sliding window timestamps (same as pre-Redis behavior)
src/lib/security/rate-limit.ts:23:import { getRedis } from "@/lib/redis/client";
src/lib/security/rate-limit.ts:65:// Redis backend — atomic INCR + EXPIRE, multi-instance safe
src/lib/security/rate-limit.ts:69: * Async rate limit check using Redis.
src/lib/security/rate-limit.ts:71: * Returns null if Redis is not available (caller falls back to in-memory).
src/lib/security/rate-limit.ts:73:async function checkRateLimitRedis(
src/lib/security/rate-limit.ts:77:  const redis = getRedis();

## 7. rate-limit.ts 当前算法
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


## 8. quota tracker 当前实现
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

## 9. instrumentation.ts
/**
 * src/instrumentation.ts — Next.js instrumentation hook.
 *
 * Runs once at server startup (before any request is handled).
 * Validates that required environment variables are set and logs
 * warnings for optional-but-recommended ones.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only validate on the server (not edge)
  if (process.env.NEXT_RUNTIME === "edge") return;

  // ── Sentry APM initialization ─────────────────────────────────
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 1.0,
      enabled: true,
      environment: process.env.NODE_ENV,
      sendDefaultPii: false,
    });
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Required in production ──────────────────────────────────────
  const required = [
    "JTG_JWT_SECRET",
  ];

  for (const key of required) {
    if (!process.env[key]) {
      if (process.env.NODE_ENV === "production") {
        errors.push(`Missing required env var: ${key}`);
      } else {
        warnings.push(`Missing env var ${key} — using dev fallback`);
      }
    }
  }

  // ── Recommended (warn if missing) ──────────────────────────────
  const recommended: { key: string; note: string }[] = [
    { key: "OPENAI_API_KEY", note: "AI features (Tier C streaming) will be unavailable" },
    { key: "JTG_SESSION_SECRET", note: "Session tokens will use JWT secret as fallback" },
    { key: "JTG_ADMIN_TOKEN", note: "Admin endpoints will be inaccessible" },
  ];

  for (const { key, note } of recommended) {
    if (!process.env[key]) {
      warnings.push(`Missing env var ${key} — ${note}`);
    }
  }

  // ── Report ─────────────────────────────────────────────────────
  if (warnings.length > 0) {
    console.warn(
      `[JTG startup] ${warnings.length} warning(s):\n` +
        warnings.map((w) => `  ⚠ ${w}`).join("\n")
    );
  }

  if (errors.length > 0) {
    const msg =
      `[JTG startup] ${errors.length} critical error(s):\n` +
      errors.map((e) => `  ✗ ${e}`).join("\n");

    if (process.env.NODE_ENV === "production") {
      // In production, throw to prevent serving with broken config
      throw new Error(msg);
    } else {
      console.error(msg);
    }
  }
}

## 10. 所有 AI 调用入口
src/app/api/vision-extract/route.ts:90:  const resp = await openai.responses.create({
src/app/api/bridge/route.ts:150:    const resp = await openai.chat.completions.create({
src/app/api/transcribe/route.ts:92:      const resp = await openai.audio.transcriptions.create({

## 11. 专利敏感字段扫描
src/app/api/knowledge/graph/route.ts:91:      const threshold = Number(body.threshold ?? 0.5)
src/app/api/router/route.ts:433:            ai.confidence ?? 0.6,
src/app/api/router/route.ts:611:      const confNum = confidenceBand === 'high' ? 0.9 : confidenceBand === 'medium' ? 0.6 : 0.3
src/lib/judgment/registry.ts:186:    confidence: 0.85,
src/lib/judgment/registry.ts:205:    confidence: 0.90,
src/lib/judgment/registry.ts:224:    confidence: 0.80,
src/lib/judgment/registry.ts:242:    confidence: 0.95,
src/lib/judgment/registry.ts:260:    confidence: 0.88,
src/lib/judgment/registry.ts:279:    confidence: 0.82,
src/lib/judgment/registry.ts:296:    confidence: 0.87,

## 12. llm_called 字段是否存在

## 13. 当前测试基线
Test Suites: 33 passed, 33 total
Tests:       494 passed, 494 total
Snapshots:   0 total
Time:        1.424 s
Ran all test suites.
