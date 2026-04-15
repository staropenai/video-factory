"use client";

import { useState } from "react";
import { track, Events } from "@/lib/analytics/events";
import type { HomepageCopy, Locale } from "@/lib/i18n/homepage";

interface TransparencyData {
  analysisTime?: string;
  engineTier?: string;
  confidenceLevel?: string;
  evidenceHash?: string;
  dataSources?: Array<{ name: string; url?: string }>;
}

interface Props {
  copy: HomepageCopy;
  locale: Locale;
  data?: TransparencyData;
}

function formatEngineTier(tier: string | undefined, copy: HomepageCopy): string {
  if (!tier) return copy.engineTierC;
  if (tier.includes("tier-a") || tier.includes("keyword")) return copy.engineTierA;
  if (tier.includes("tier-b") || tier.includes("semantic")) return copy.engineTierB;
  return copy.engineTierC;
}

function formatConfidence(level: string | undefined, copy: HomepageCopy): string {
  if (!level) return copy.confidenceMedium;
  if (level === "high") return copy.confidenceHigh;
  if (level === "low") return copy.confidenceLow;
  return copy.confidenceMedium;
}

export function TransparencyLayer({ copy, locale, data }: Props) {
  const [expanded, setExpanded] = useState(false);

  const row: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    fontSize: 12,
    padding: "4px 0",
  };

  return (
    <section
      aria-label={copy.transparencyTitle}
      style={{
        margin: "0 20px 14px",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-md)",
        background: "var(--color-background-secondary)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => {
          if (!expanded) {
            track(Events.TRANSPARENCY_EXPAND, { locale });
          }
          setExpanded(!expanded);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "10px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          minHeight: 44,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)" }}>
          {copy.transparencyTitle}
        </span>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
          {expanded ? "▴" : `${copy.transparencyExpandLabel} ▾`}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 12px" }}>
          {/* Analysis time */}
          {data?.analysisTime && (
            <div style={row}>
              <span style={{ color: "var(--color-text-secondary)" }}>{copy.transparencyAnalysisTime}</span>
              <span style={{ color: "var(--color-text-primary)", fontWeight: 500, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                {new Date(data.analysisTime).toLocaleString(locale === "zh-Hans" ? "zh-CN" : locale)}
              </span>
            </div>
          )}

          {/* Engine tier */}
          <div style={row}>
            <span style={{ color: "var(--color-text-secondary)" }}>{copy.transparencyEngine}</span>
            <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
              {formatEngineTier(data?.engineTier, copy)}
            </span>
          </div>

          {/* Confidence */}
          <div style={row}>
            <span style={{ color: "var(--color-text-secondary)" }}>{copy.transparencyConfidence}</span>
            <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
              {formatConfidence(data?.confidenceLevel, copy)}
            </span>
          </div>

          {/* Evidence hash */}
          {data?.evidenceHash && (
            <div style={row}>
              <span style={{ color: "var(--color-text-secondary)" }}>{copy.transparencyEvidenceHash}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-primary)" }}>
                {data.evidenceHash.slice(0, 8)}…{" "}
                <span style={{ color: "#1D9E75", cursor: "pointer", fontSize: 10 }}>
                  [{copy.transparencyViewFull}]
                </span>
              </span>
            </div>
          )}

          {/* Data sources */}
          {data?.dataSources && data.dataSources.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{copy.transparencyDataSources}</span>
              <ul style={{ margin: "4px 0 0", padding: "0 0 0 16px", listStyle: "disc" }}>
                {data.dataSources.map((src, i) => (
                  <li key={i} style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                    {src.url ? (
                      <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ color: "#1D9E75" }}>
                        {src.name} ↗
                      </a>
                    ) : src.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Disclaimer */}
          <p style={{ fontSize: 10, color: "var(--color-text-tertiary)", margin: "8px 0 0", lineHeight: 1.5 }}>
            {copy.transparencyDisclaimer}
          </p>
        </div>
      )}
    </section>
  );
}
