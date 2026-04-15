# 任务前扫描 — 2026-04-13T22:54:09Z

## 1. /api/query/stream 当前实现状态
[NOT FOUND] /api/query/stream
src/app/api/router/stream/route.ts

## 2. 知识库检索相关文件
src/app/api/metrics/route.ts
src/app/api/faq/search/route.ts
src/app/api/knowledge/graph/route.ts
src/app/api/review/faq-candidates/[id]/publish/route.ts
src/app/api/review/stats/route.ts
src/app/api/sensing/scan/route.ts
src/app/api/router/stream/route.ts
src/app/api/router/route.ts
src/hooks/useStreamQuery.ts
src/lib/pipeline/gap-detector.ts
src/lib/judgment/registry.ts
src/lib/patent/baseline-comparison.ts
src/lib/patent/claim-mapping.ts
src/lib/patent/evidence-chain-logger.ts
src/lib/style/output-guide.ts
src/lib/audit/logger.ts
src/lib/knowledge/retrieve.ts
src/lib/knowledge/seed.ts
src/lib/knowledge/faq-sync.ts
src/lib/knowledge/graph.ts

## 3. evidence_records 写入位置
src/app/api/bridge/session/route.ts:33:import { createEvidenceRecord, logEvidenceRecord } from '@/lib/patent/evidence-chain-logger'
src/app/api/bridge/session/route.ts:142:          logEvidenceRecord(ecRecord)
src/app/api/router/route.ts:53:import { createEvidenceRecord, logEvidenceRecord } from '@/lib/patent/evidence-chain-logger'
src/app/api/router/route.ts:660:      logEvidenceRecord(ecRecord)
src/lib/patent/evidence-chain-logger.ts:349:  const evidenceRecords = filterByModule(records, 'evidence')
src/lib/patent/evidence-chain-logger.ts:369:  const evidenceTriggerScores = evidenceRecords
src/lib/patent/evidence-chain-logger.ts:372:  const evidenceCounts = evidenceRecords.map(
src/lib/patent/evidence-chain-logger.ts:384:  const evidenceDataSufficient = evidenceRecords.length >= 100
src/lib/patent/evidence-chain-logger.ts:413:      totalEvents: evidenceRecords.length,
src/lib/patent/evidence-chain-logger.ts:472:export function logEvidenceRecord(record: EvidenceChainRecord): boolean {

## 4. Sentry 当前状态
src/lib/audit/logger.ts:12:import { captureError } from '@/lib/monitoring/sentry'
src/lib/audit/logger.ts:102:  // Forward to Sentry when configured
src/lib/monitoring/ttft.ts:4: * Records latency metrics via Sentry for P95 monitoring dashboard.
src/lib/monitoring/ttft.ts:5: * All functions are safe no-ops when Sentry is not configured.
src/lib/monitoring/ttft.ts:8:import { recordMetric, startSpan } from "@/lib/monitoring/sentry";
src/lib/monitoring/sentry.ts:2: * Sentry APM integration — thin wrapper for JTG monitoring.
src/lib/monitoring/sentry.ts:8: *   import { captureError, startSpan, recordMetric } from '@/lib/monitoring/sentry'
src/lib/monitoring/sentry.ts:11:import * as Sentry from "@sentry/nextjs";
src/lib/monitoring/sentry.ts:13:/** Whether Sentry is actively sending data (DSN configured). */
src/lib/monitoring/sentry.ts:14:export function isSentryActive(): boolean {
src/lib/monitoring/sentry.ts:20: * No-op if Sentry is not configured.
src/lib/monitoring/sentry.ts:29:  if (!isSentryActive()) return;
src/lib/monitoring/sentry.ts:30:  Sentry.withScope((scope) => {
src/lib/monitoring/sentry.ts:37:    Sentry.captureException(
src/lib/monitoring/sentry.ts:45: * No-op wrapper if Sentry is not configured.

## 5. Redis 当前状态
src/lib/security/rate-limit.ts:5: *   - Redis (Upstash) when UPSTASH_REDIS_REST_URL is configured
src/lib/security/rate-limit.ts:12: * - Redis backend uses INCR + EXPIRE for atomic, multi-instance safe counting
src/lib/security/rate-limit.ts:13: * - In-memory fallback uses sliding window timestamps (same as pre-Redis behavior)
src/lib/security/rate-limit.ts:23:import { getRedis } from "@/lib/redis/client";
src/lib/security/rate-limit.ts:65:// Redis backend — atomic INCR + EXPIRE, multi-instance safe
src/lib/security/rate-limit.ts:69: * Async rate limit check using Redis.
src/lib/security/rate-limit.ts:71: * Returns null if Redis is not available (caller falls back to in-memory).
src/lib/security/rate-limit.ts:73:async function checkRateLimitRedis(
src/lib/security/rate-limit.ts:77:  const redis = getRedis();
src/lib/security/rate-limit.ts:78:  if (!redis) return null;
src/lib/security/rate-limit.ts:82:  const redisKey = `rl:${key}:${windowId}`;
src/lib/security/rate-limit.ts:88:    const pipeline = redis.pipeline();
src/lib/security/rate-limit.ts:89:    pipeline.incr(redisKey);
src/lib/security/rate-limit.ts:90:    pipeline.expire(redisKey, ttlSec);
src/lib/security/rate-limit.ts:114:    // Redis error — fall through to in-memory

## 6. rate-limit.ts 当前实现（前40行）
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

## 7. quota tracker 当前实现（前40行）
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

## 8. instrumentation.ts 当前状态（前30行）
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

## 9. 所有 AI 调用入口
src/app/api/vision-extract/route.ts:90:  const resp = await openai.responses.create({
src/app/api/bridge/route.ts:150:    const resp = await openai.chat.completions.create({
src/app/api/transcribe/route.ts:92:      const resp = await openai.audio.transcriptions.create({

## 10. ttft 相关字段
src/app/api/router/stream/route.ts:53:import { recordRouterLatency, recordTTFT, recordTierHit } from "@/lib/monitoring/ttft";
src/app/api/router/stream/route.ts:439:              recordTTFT(Date.now() - startedAt);
src/lib/ai/generate-stream.ts:5: * SSE endpoint can push them to the client as they arrive (TTFT < 800ms).
src/lib/monitoring/ttft.ts:2: * TTFT (Time to First Token) tracking for the JTG router.
src/lib/monitoring/ttft.ts:28: * Record TTFT specifically for streaming (Tier C) responses.
src/lib/monitoring/ttft.ts:29: * TTFT = time from request start to first SSE token emitted.
src/lib/monitoring/ttft.ts:31:export function recordTTFT(ttftMs: number): void {
src/lib/monitoring/ttft.ts:32:  recordMetric("jtg.router.ttft", ttftMs, "millisecond", { tier: "C" });
src/lib/monitoring/sentry.ts:62: * Record a custom metric (e.g., TTFT, latency, shortcut rate).

## 11. 快速路径 (fast path) 状态
183:      const canFastShortcut =
189:      if (canFastShortcut) {
232:              fastPath: true,
236:            logError("fast_path_audit_error", e);
241:        recordRouterLatency(fastLatency, tier, { fastPath: true, language: fastLang });
251:          debug: { requestId, latencyMs: fastLatency, fastPath: true },

## 12. 当前测试基线
Test Suites: 30 passed, 30 total
Tests:       466 passed, 466 total
