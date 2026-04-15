"use client";

import { useState, useEffect } from "react";
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

  return (
    <div
      role="banner"
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 8,
        padding: "10px 20px",
        background: "#FEF3C7",
        borderBottom: "0.5px solid #F59E0B",
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12, color: "#92400E", margin: 0, lineHeight: 1.5 }}>
          {copy.lossAversionText}
        </p>
        <a
          href="https://www.moj.go.jp/JINKEN/jinken04_00126.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "#B45309", textDecoration: "underline" }}
        >
          {copy.lossAversionSource} ↗
        </a>
      </div>
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
          color: "#92400E",
          cursor: "pointer",
          padding: "0 2px",
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
