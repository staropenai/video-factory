/**
 * Sentry APM integration — thin wrapper for JTG monitoring.
 *
 * Maturity: PRODUCTION SCAFFOLD — requires SENTRY_DSN env var to activate.
 * Without SENTRY_DSN, all functions are safe no-ops.
 *
 * Usage:
 *   import { captureError, startSpan, recordMetric } from '@/lib/monitoring/sentry'
 */

import * as Sentry from "@sentry/nextjs";

/** Whether Sentry is actively sending data (DSN configured). */
export function isSentryActive(): boolean {
  return !!process.env.SENTRY_DSN;
}

/**
 * Capture an error with optional context tags.
 * No-op if Sentry is not configured.
 */
export function captureError(
  error: unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): void {
  if (!isSentryActive()) return;
  Sentry.withScope((scope) => {
    if (context?.tags) {
      for (const [k, v] of Object.entries(context.tags)) scope.setTag(k, v);
    }
    if (context?.extra) {
      for (const [k, v] of Object.entries(context.extra)) scope.setExtra(k, v);
    }
    Sentry.captureException(
      error instanceof Error ? error : new Error(String(error))
    );
  });
}

/**
 * Start a performance span. Returns an object with `end()` to close the span.
 * No-op wrapper if Sentry is not configured.
 */
export function startSpan(
  name: string,
  op: string
): { end: () => void; setTag: (key: string, value: string) => void } {
  if (!isSentryActive()) {
    return { end: () => {}, setTag: () => {} };
  }
  const span = Sentry.startInactiveSpan({ name, op });
  return {
    end: () => span?.end(),
    setTag: (key: string, value: string) => span?.setAttribute(key, value),
  };
}

/**
 * Record a custom metric (e.g., TTFT, latency, shortcut rate).
 * Uses Sentry's metrics API when available, otherwise no-op.
 */
export function recordMetric(
  name: string,
  value: number,
  unit: "millisecond" | "none" | "ratio" = "none",
  tags?: Record<string, string>
): void {
  if (!isSentryActive()) return;
  try {
    Sentry.metrics.distribution(name, value, {
      unit,
      attributes: tags as Record<string, string | number | boolean | bigint | undefined>,
    });
  } catch {
    // Sentry metrics API may not be available in all environments
  }
}
