/**
 * src/lib/analytics/useDwell.ts
 *
 * Tracks how long the user spends on the homepage.
 * Fires home_dwell at milestones: 5s, 15s, 30s, 60s.
 * Used to establish baseline dwell data before setting KPI thresholds (spec §5.3).
 *
 * SERVER SAFE — only runs in the browser.
 */

"use client";

import { useEffect, useRef } from "react";
import { track, Events } from "./events";

const MILESTONES_MS = [5_000, 15_000, 30_000, 60_000];

export function useDwell(locale: string) {
  const firedRef = useRef<Set<number>>(new Set());
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    firedRef.current.clear();

    const timers = MILESTONES_MS.map((ms) =>
      setTimeout(() => {
        if (!firedRef.current.has(ms)) {
          firedRef.current.add(ms);
          track(Events.HOME_DWELL, { milestone_ms: ms, locale });
        }
      }, ms)
    );

    // Cleanup on unmount (navigation away)
    return () => timers.forEach(clearTimeout);
  }, [locale]);
}
