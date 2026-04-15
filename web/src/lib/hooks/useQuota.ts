/**
 * lib/hooks/useQuota.ts
 *
 * Client-side React hook that manages AI quota display state.
 *
 * RESPONSIBILITIES
 * 1. Fetch usage status from GET /api/usage/today on mount.
 * 2. Optimistically update state after each AI call.
 * 3. Expose `blocked`, `showUpgradeHint`, `resetAtText` for UI.
 * 4. Call POST /api/ai/session/open before each LLM request and
 *    return the sessionToken to pass to /api/router.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// --- Types ---

export interface QuotaState {
  /** Whether the status has been fetched from the server */
  ready: boolean;
  used: number;
  limit: number;
  remaining: number;
  /** true when remaining <= 0 — caller must disable the submit button */
  blocked: boolean;
  /** true when used >= 20 — show upgrade hint */
  showUpgradeHint: boolean;
  /** Localised string e.g. "约 6 小时后重置" */
  resetAtText: string;
}

export interface OpenSessionResult {
  ok: true;
  sessionToken: string;
  quota: QuotaState;
}

export interface OpenSessionError {
  ok: false;
  error: "quota_exceeded" | "network_error" | "unknown";
  resetAtText?: string;
}

const INITIAL_STATE: QuotaState = {
  ready: false,
  used: 0,
  limit: 30,
  remaining: 30,
  blocked: false,
  showUpgradeHint: false,
  resetAtText: "",
};

// --- Hook ---

export function useQuota(lang = "zh") {
  const [quota, setQuota] = useState<QuotaState>(INITIAL_STATE);

  // Fetch on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch(`/api/usage/today?lang=${encodeURIComponent(lang)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setQuota({
            ready: true,
            used: data.used ?? data.ai?.used ?? 0,
            limit: data.limit ?? data.ai?.limit ?? 30,
            remaining: data.remaining ?? data.ai?.remaining ?? 30,
            blocked: data.blocked ?? false,
            showUpgradeHint: data.showUpgradeHint ?? false,
            resetAtText: data.resetAtText ?? data.ai?.resetAtText ?? "",
          });
        }
      } catch {
        // Network error — show default state, don't block the UI
        if (!cancelled) setQuota((s: QuotaState) => ({ ...s, ready: true }));
      }
    }

    fetchStatus();
    return () => { cancelled = true; };
  }, [lang]);

  // Open session (pre-LLM gate)
  const openSession = useCallback(
    async (): Promise<OpenSessionResult | OpenSessionError> => {
      // Use remaining<=0 (not quota.blocked) because consumeQuota returns
      // blocked=false on the last successful call — blocked=true only when
      // a call is actually rejected.
      if (quota.remaining <= 0) {
        return {
          ok: false,
          error: "quota_exceeded",
          resetAtText: quota.resetAtText,
        };
      }

      try {
        const res = await fetch("/api/ai/session/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang }),
        });

        const data = await res.json();

        if (res.status === 429) {
          setQuota((s: QuotaState) => ({
            ...s,
            remaining: 0,
            blocked: true,
            showUpgradeHint: true,
            resetAtText: data.resetAtText ?? s.resetAtText,
          }));
          return {
            ok: false,
            error: "quota_exceeded",
            resetAtText: data.resetAtText,
          };
        }

        if (!res.ok || !data.ok) {
          return { ok: false, error: "unknown" };
        }

        // Optimistic update
        setQuota({
          ready: true,
          used: data.used,
          limit: data.limit,
          remaining: data.remaining,
          blocked: data.blocked,
          showUpgradeHint: data.showUpgradeHint,
          resetAtText: data.resetAtText,
        });

        return {
          ok: true,
          sessionToken: data.sessionToken,
          quota: {
            ready: true,
            used: data.used,
            limit: data.limit,
            remaining: data.remaining,
            blocked: data.blocked,
            showUpgradeHint: data.showUpgradeHint,
            resetAtText: data.resetAtText,
          },
        };
      } catch {
        return { ok: false, error: "network_error" };
      }
    },
    [quota.remaining, quota.resetAtText, lang]
  );

  return { quota, openSession };
}
