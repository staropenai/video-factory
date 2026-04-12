/**
 * JTG V6 P0-2 — Routing metrics with alert thresholds.
 *
 * V6 spec (执行文件 §P0-2):
 *   "任何指标超过alert_threshold，自动发送告警"
 *
 * This module adds:
 *   1. `ALERT_THRESHOLDS` — the v6 alert boundaries
 *   2. `checkAlerts` — pure function: compare hit rates against thresholds
 *   3. `MetricSnapshot` — timestamped snapshot for trend tracking
 *   4. `buildMetricSnapshot` — pure snapshot builder from hit rates
 *
 * All test-exercised functions are pure. The I/O wrapper `captureSnapshot`
 * reads from layer-stats and returns a snapshot.
 */

import type { LayerHitRate, LayerLabel } from './layer-stats'
import { getLayerHitRates } from './layer-stats'

// ---------------------------------------------------------------------
// Alert thresholds (V6 §P0-2).
// ---------------------------------------------------------------------

export interface AlertThreshold {
  /** Metric identifier. */
  metric: string
  /** Threshold value. */
  value: number
  /** Direction: 'above' means alert when metric > value; 'below' means alert when metric < value. */
  direction: 'above' | 'below'
  /** Severity level. */
  severity: 'warning' | 'critical'
}

/**
 * V6 alert thresholds. These are STRICTER than the target thresholds
 * in layer-stats.ts — they represent the point where the system is
 * degrading enough to require immediate attention.
 */
export const ALERT_THRESHOLDS: AlertThreshold[] = [
  {
    metric: 'L1_STATIC',
    value: 0.40,
    direction: 'below',
    severity: 'critical',
  },
  {
    metric: 'L3_AI',
    value: 0.35,
    direction: 'above',
    severity: 'warning',
  },
  {
    metric: 'L6_ESCALATION',
    value: 0.08,
    direction: 'above',
    severity: 'critical',
  },
  {
    metric: 'L5_BRIDGE',
    value: 0.20,
    direction: 'above',
    severity: 'warning',
  },
]

// ---------------------------------------------------------------------
// Pure: alert checking.
// ---------------------------------------------------------------------

export interface AlertFiring {
  metric: string
  currentValue: number
  threshold: number
  direction: 'above' | 'below'
  severity: 'warning' | 'critical'
  message: string
}

/**
 * Check all alert thresholds against current hit rates.
 * Pure — no I/O.
 *
 * Returns an array of firing alerts (empty = all clear).
 */
export function checkAlerts(
  hitRates: LayerHitRate[],
  thresholds: AlertThreshold[] = ALERT_THRESHOLDS,
): AlertFiring[] {
  const rateMap = new Map<string, number>()
  for (const hr of hitRates) rateMap.set(hr.layer, hr.rate)

  const alerts: AlertFiring[] = []
  for (const t of thresholds) {
    const current = rateMap.get(t.metric)
    if (current == null) continue

    const firing =
      t.direction === 'above'
        ? current > t.value
        : current < t.value

    if (firing) {
      alerts.push({
        metric: t.metric,
        currentValue: current,
        threshold: t.value,
        direction: t.direction,
        severity: t.severity,
        message:
          t.direction === 'above'
            ? `${t.metric} at ${(current * 100).toFixed(1)}% exceeds ${t.severity} threshold of ${(t.value * 100).toFixed(1)}%`
            : `${t.metric} at ${(current * 100).toFixed(1)}% below ${t.severity} threshold of ${(t.value * 100).toFixed(1)}%`,
      })
    }
  }

  return alerts
}

// ---------------------------------------------------------------------
// Pure: metric snapshot.
// ---------------------------------------------------------------------

export interface MetricSnapshot {
  timestamp: string
  totalQueries: number
  rates: Record<string, number>
  alerts: AlertFiring[]
  status: 'healthy' | 'warning' | 'critical'
}

/**
 * Build a snapshot from hit rates. Pure — no I/O.
 */
export function buildMetricSnapshot(
  hitRates: LayerHitRate[],
  timestamp: string = new Date().toISOString(),
): MetricSnapshot {
  const rates: Record<string, number> = {}
  let totalQueries = 0
  for (const hr of hitRates) {
    rates[hr.layer] = hr.rate
    totalQueries = hr.totalQueries
  }

  const alerts = checkAlerts(hitRates)
  const hasCritical = alerts.some((a) => a.severity === 'critical')
  const hasWarning = alerts.some((a) => a.severity === 'warning')

  return {
    timestamp,
    totalQueries,
    rates,
    alerts,
    status: hasCritical ? 'critical' : hasWarning ? 'warning' : 'healthy',
  }
}

// ---------------------------------------------------------------------
// I/O wrapper.
// ---------------------------------------------------------------------

/**
 * Capture a live metric snapshot from the events table.
 */
export function captureSnapshot(since?: string): MetricSnapshot {
  const hitRates = getLayerHitRates(since)
  return buildMetricSnapshot(hitRates)
}
