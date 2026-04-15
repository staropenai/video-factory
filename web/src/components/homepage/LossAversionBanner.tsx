"use client";

/**
 * V5 §4.2 — Loss Aversion Banner
 * Maturity: production-ready
 *
 * Shows "39% of foreigners rejected" stat with CTA scrolling to FAQ.
 * Dismissible via localStorage. Hidden by default to avoid flash.
 */

import { useState, useEffect } from "react";
import { track, Events } from "@/lib/analytics/events";
import type { HomepageCopy } from "@/lib/i18n/homepage";

const STORAGE_KEY = "jtg-loss-aversion-dismissed";

interface Props {
  copy: HomepageCopy;
}

export function LossAversionBanner({ copy }: Props) {
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  function handleCtaClick() {
    track(Events.STAT_BANNER_CLICK);
    document.querySelector("#faq")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div
      role="banner"
      aria-label="租房风险提示"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "10px 16px",
        background: "#FAEEDA",
        flexWrap: "wrap",
      }}
    >
      {/* Left: stat + text */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", flex: 1 }}>
        <span style={{ fontSize: 20, fontWeight: 500, color: "#854F0B", lineHeight: 1 }}>
          {copy.statBannerPercent}
        </span>
        <span style={{ fontSize: 13, color: "#633806", lineHeight: 1.4 }}>
          {copy.statBannerText}
        </span>
      </div>

      {/* CTA */}
      <button
        onClick={handleCtaClick}
        style={{
          fontSize: 12,
          color: "#854F0B",
          fontWeight: 500,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textDecoration: "underline",
          whiteSpace: "nowrap",
          padding: 0,
          minHeight: 28,
        }}
      >
        {copy.statBannerCta}
      </button>

      {/* Close */}
      <button
        onClick={() => {
          setDismissed(true);
          try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
        }}
        aria-label="Close"
        style={{
          background: "none",
          border: "none",
          fontSize: 16,
          color: "#854F0B",
          cursor: "pointer",
          padding: "0 2px",
          lineHeight: 1,
          flexShrink: 0,
          minHeight: 28,
        }}
      >
        ×
      </button>

      {/* Source attribution */}
      <span style={{ width: "100%", fontSize: 10, color: "#854F0B", opacity: 0.65, marginTop: -4 }}>
        {copy.statBannerSource}
      </span>
    </div>
  );
}
