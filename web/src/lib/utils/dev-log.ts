/**
 * lib/utils/dev-log.ts
 *
 * Centralized production log guard.
 *
 * All non-critical console.log statements in API routes should use
 * devLog() instead of raw console.log(). This ensures sensitive data
 * (user queries, internal IDs, feedback content) is never logged in
 * production.
 *
 * console.warn and console.error remain unguarded — those are for
 * operational alerts that should always be visible.
 */

/**
 * Log only in non-production environments.
 * Drop-in replacement for console.log(...args).
 */
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
}

/**
 * Structured dev log — JSON.stringify a single object.
 * Useful for audit-style structured logs.
 */
export function devLogJson(obj: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(JSON.stringify(obj));
  }
}
