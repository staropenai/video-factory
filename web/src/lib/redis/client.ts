/**
 * lib/redis/client.ts — Upstash Redis client singleton.
 *
 * Maturity: PRODUCTION READY when UPSTASH_REDIS_REST_URL is configured.
 * Without env vars, `getRedis()` returns null and all callers fall back
 * to in-memory implementations (existing behavior).
 *
 * Required env vars:
 *   UPSTASH_REDIS_REST_URL  — Upstash REST API endpoint
 *   UPSTASH_REDIS_REST_TOKEN — Upstash REST API token
 *
 * These are auto-provisioned by `vercel integration add upstash` and
 * injected into all deployment environments.
 */

import { Redis } from "@upstash/redis";

let _client: Redis | null = null;
let _initialized = false;

/**
 * Get the Redis client singleton.
 * Returns null if Upstash env vars are not configured.
 */
export function getRedis(): Redis | null {
  if (_initialized) return _client;
  _initialized = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    _client = null;
    return null;
  }

  _client = new Redis({ url, token });
  return _client;
}

/**
 * Whether Redis is available for this deployment.
 */
export function isRedisAvailable(): boolean {
  return getRedis() !== null;
}

/**
 * Reset singleton for tests.
 * @internal
 */
export function __resetForTests(): void {
  _client = null;
  _initialized = false;
}
