"use client";

/**
 * components/homepage/AIZone.tsx
 *
 * AI question entry zone.
 *
 * SPEC COMPLIANCE
 * ───────────────
 * §3.5: All copy avoids absolute claims ("can always", "100% accurate").
 *       Fixed disclaimer rendered beneath the input.
 * §3.8: Mobile-first — 44px min touch target, textarea resizes, quota badge visible.
 * §5.1: Fires ai_open on every submission attempt (including quota-blocked ones).
 *
 * QUOTA DISPLAY
 * ─────────────
 * Props drive remaining/limit — this component owns no quota state.
 * When remaining === 0, submit is disabled and exhausted copy is shown.
 * No dark-pattern wording (no "last chance", no countdown timers).
 */

import React, { useState } from "react";
import { track, Events } from "@/lib/analytics/events";
import { fmtQuota, type HomepageCopy } from "@/lib/i18n/homepage";

interface Props {
  copy: Pick<
    HomepageCopy,
    | "aiZoneTitle"
    | "aiPlaceholder"
    | "aiSendLabel"
    | "aiDisclaimer"
    | "aiQuotaFmt"
    | "aiQuotaExhausted"
  >;
  locale: string;
  remaining: number;
  limit: number;
  /** Called when the user submits a question and quota is available */
  onSubmit: (message: string) => void;
}

export function AIZone({ copy, locale, remaining, limit, onSubmit }: Props) {
  const [value, setValue] = useState("");
  const blocked = remaining <= 0;

  function handleSubmit() {
    track(Events.AI_OPEN, {
      locale,
      quota_remaining: remaining,
      blocked: blocked ? 1 : 0,
    });
    if (blocked) return;
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
  }

  return (
    <section
      aria-label={copy.aiZoneTitle}
      style={{
        margin: "0 20px 16px",
        padding: 14,
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        background: "var(--color-background-secondary)",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          gap: 8,
        }}
      >
        <h2
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--color-text-primary)",
            margin: 0,
          }}
        >
          {copy.aiZoneTitle}
        </h2>

        {/* Quota badge — always visible when limit is known */}
        {limit > 0 && (
          <span
            aria-live="polite"
            style={{
              fontSize: 11,
              color: blocked ? "var(--color-text-danger, #A32D2D)" : "var(--color-text-secondary)",
              background: blocked
                ? "var(--color-background-danger, #FCEBEB)"
                : "var(--color-background-primary)",
              padding: "3px 8px",
              borderRadius: 20,
              border: `0.5px solid ${blocked ? "var(--color-border-danger, #F09595)" : "var(--color-border-tertiary)"}`,
              flexShrink: 0,
            }}
          >
            {fmtQuota(copy.aiQuotaFmt, remaining, limit)}
          </span>
        )}
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={blocked ? "" : copy.aiPlaceholder}
          disabled={blocked}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          style={{
            flex: 1,
            padding: "9px 12px",
            fontSize: 13,
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: "var(--border-radius-md)",
            background: "var(--color-background-primary)",
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-sans)",
            outline: "none",
            resize: "vertical",
            lineHeight: 1.5,
            opacity: blocked ? 0.5 : 1,
            minHeight: 44, // §3.8 mobile touch target
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={blocked || !value.trim()}
          aria-disabled={blocked || !value.trim()}
          style={{
            padding: "0 16px",
            minHeight: 44, // §3.8 mobile touch target
            background: "#1D9E75",
            color: "#fff",
            border: "none",
            borderRadius: "var(--border-radius-md)",
            fontSize: 13,
            fontWeight: 500,
            cursor: blocked || !value.trim() ? "not-allowed" : "pointer",
            opacity: blocked || !value.trim() ? 0.4 : 1,
            fontFamily: "var(--font-sans)",
            transition: "opacity 0.15s",
            flexShrink: 0,
          }}
        >
          {copy.aiSendLabel}
        </button>
      </div>

      {/* Quota exhausted message — restrained copy, no dark patterns */}
      {blocked && (
        <p
          aria-live="assertive"
          style={{
            fontSize: 12,
            color: "var(--color-text-secondary)",
            margin: "8px 0 0",
            lineHeight: 1.5,
          }}
        >
          {copy.aiQuotaExhausted}
        </p>
      )}

      {/* Fixed disclaimer — spec §3.5 mandatory copy */}
      {!blocked && (
        <p
          style={{
            fontSize: 11,
            color: "var(--color-text-tertiary)",
            margin: "7px 0 0",
            lineHeight: 1.5,
          }}
        >
          {copy.aiDisclaimer}
        </p>
      )}
    </section>
  );
}
