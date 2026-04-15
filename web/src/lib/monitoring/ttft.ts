/**
 * TTFT (Time to First Token) tracking for the JTG router.
 *
 * Records latency metrics via Sentry for P95 monitoring dashboard.
 * All functions are safe no-ops when Sentry is not configured.
 */

import { recordMetric, startSpan } from "@/lib/monitoring/sentry";

export type RouteTier = "A" | "B" | "C" | "L6";

/**
 * Record the total request latency for a router call.
 */
export function recordRouterLatency(
  latencyMs: number,
  tier: RouteTier | string,
  opts?: { fastPath?: boolean; language?: string }
): void {
  recordMetric("jtg.router.latency", latencyMs, "millisecond", {
    tier,
    ...(opts?.fastPath ? { fast_path: "true" } : {}),
    ...(opts?.language ? { language: opts.language } : {}),
  });
}

/**
 * Record TTFT specifically for streaming (Tier C) responses.
 * TTFT = time from request start to first SSE token emitted.
 */
export function recordTTFT(ttftMs: number): void {
  recordMetric("jtg.router.ttft", ttftMs, "millisecond", { tier: "C" });
}

/**
 * Record tier distribution for monitoring shortcut effectiveness.
 */
export function recordTierHit(tier: RouteTier | string): void {
  recordMetric("jtg.router.tier_hit", 1, "none", { tier });
}

/**
 * Create a span for a router sub-phase (understanding, retrieval, etc.).
 */
export function spanRouterPhase(phase: string) {
  return startSpan(`router.${phase}`, "router");
}
