"use client";
/**
 * TrustDashboard — ZONE 4c
 *
 * maturity: skeleton
 * notEquivalentTo: does not represent blockchain attestation until
 *   /api/trust-dashboard is backed by real evidence_records writes.
 *
 * Security: this component does NOT accept trust status as props.
 *   All status values are fetched from the server via useTrustDashboard().
 *   This prevents any parent from injecting a forged trust state.
 */

import React, { useState, useEffect } from "react";
import { track, Events } from "@/lib/analytics/events";
import { TrustBadge, type TrustStatus } from "./TrustBadge";
import type { HomepageCopy } from "@/lib/i18n/homepage";

// ── Server response type (mirrors T4 route output) ──────────────────────────

interface TrustDashboardData {
  analysisId:           string;
  listingStatus:        TrustStatus;
  documentCompleteness: TrustStatus;
  riskSummary:          "low" | "medium" | "high" | "unknown";
  riskBasis:            string;
  riskKnownItems:       string[];
  riskUnknownItems:     string[];
  costTransparency:     TrustStatus;
  costEstimate?:        { min: number; max: number; currency: "JPY" };
  onlineEligible:       boolean;
  evidenceTimestamp?:   string;
  evidenceHash?:        string;
  engineTier:           "tier-a-keyword" | "tier-b-semantic" | "tier-c-llm";
  confidenceLevel:      "high" | "medium" | "low";
  dataSources:          Array<{ label: string; url?: string; external: true }>;
  disclaimer:           string;
  trustDashboardReady:  boolean;
  _evidenceError?:      boolean;
}

// ── Hook — ONLY source of trust state ────────────────────────────────────────

function useTrustDashboard(analysisId: string, lang: string) {
  const [data, setData]     = useState<TrustDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!analysisId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/trust-dashboard?analysisId=${encodeURIComponent(analysisId)}&lang=${lang}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
          track(Events.TRUST_DASHBOARD_VIEW, { analysisId, lang });
        } else {
          setError(res.error ?? "unknown_error");
        }
      })
      .catch(() => setError("network_error"))
      .finally(() => setLoading(false));
  }, [analysisId, lang]);

  return { data, loading, error };
}

// ── Component ────────────────────────────────────────────────────────────────

interface TrustDashboardProps {
  analysisId: string;
  locale:     string;
  copy: Pick<
    HomepageCopy,
    | "trustDashboardTitle"
    | "trustDashboardSubtitle"
    | "trustDashboardDisclaimer"
    | "trustStatusVerified"
    | "trustStatusPartial"
    | "trustStatusRisk"
    | "trustStatusUnknown"
    | "trustStatusPending"
    | "evidenceTimestampLabel"
    | "evidenceViewDetail"
    | "evidenceWriteFailed"
    | "riskLow" | "riskMedium" | "riskHigh" | "riskUnknown"
  >;
  onShowEvidence?: (hash: string, timestamp: string) => void;
}

// ── Risk level → copy key mapping ────────────────────────────────────────────
const RISK_COPY_MAP = {
  low: "riskLow", medium: "riskMedium", high: "riskHigh", unknown: "riskUnknown",
} as const;

export function TrustDashboard({
  analysisId, locale, copy, onShowEvidence,
}: TrustDashboardProps) {
  const { data, loading, error } = useTrustDashboard(analysisId, locale);
  const [riskExpanded, setRiskExpanded] = useState(false);

  // Loading state
  if (loading) {
    return (
      <section aria-label={copy.trustDashboardTitle} style={containerStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{copy.trustDashboardTitle}</h2>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={skeletonRowStyle} />
        ))}
      </section>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <section aria-label={copy.trustDashboardTitle} style={containerStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{copy.trustDashboardTitle}</h2>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: "8px 14px" }}>
          Unable to load trust status. Please try again or contact support.
        </p>
      </section>
    );
  }

  const riskCopyKey = RISK_COPY_MAP[data.riskSummary];

  return (
    <section aria-label={copy.trustDashboardTitle} style={containerStyle}>

      {/* Header */}
      <div style={headerStyle}>
        <h2 style={titleStyle}>{copy.trustDashboardTitle}</h2>
        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>
          {copy.trustDashboardSubtitle}
        </p>
      </div>

      {/* Status rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px" }}>

        {/* Listing status */}
        <StatusRow
          label={locale === "en" ? "Listing information" : "房源信息"}
          status={data.listingStatus}
          statusCopy={getStatusCopy(data.listingStatus, copy)}
          actionLabel={locale === "en" ? "View details" : "查看详情"}
        />

        {/* Document completeness */}
        <StatusRow
          label={locale === "en" ? "Document completeness" : "文件完整度"}
          status={data.documentCompleteness}
          statusCopy={getStatusCopy(data.documentCompleteness, copy)}
          actionLabel={locale === "en" ? "Add info" : "补充信息"}
        />

        {/* Risk summary — expandable */}
        <div>
          <StatusRow
            label={locale === "en" ? "Risk summary" : "风险摘要"}
            status={data.riskSummary === "low" ? "verified"
                  : data.riskSummary === "medium" ? "partial"
                  : data.riskSummary === "high" ? "risk"
                  : "unknown"}
            statusCopy={copy[riskCopyKey]}
            actionLabel={locale === "en" ? "View basis" : "查看依据"}
            onAction={() => {
              setRiskExpanded((v) => !v);
              track(Events.RISK_DETAIL_VIEW, { analysisId, riskLevel: data.riskSummary, locale });
            }}
          />
          {riskExpanded && (
            <div style={riskExpandedStyle}>
              {data.riskKnownItems.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <p style={riskSectionTitle}>{locale === "en" ? "Known items:" : "已知风险："}</p>
                  {data.riskKnownItems.map((item, i) => (
                    <p key={i} style={riskItemStyle}>{"\u25AA"} {item}</p>
                  ))}
                </div>
              )}
              {data.riskUnknownItems.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <p style={riskSectionTitle}>{locale === "en" ? "Not assessed:" : "未纳入因素："}</p>
                  {data.riskUnknownItems.map((item, i) => (
                    <p key={i} style={riskItemStyle}>{"\u25CB"} {item}</p>
                  ))}
                </div>
              )}
              {data.riskBasis && (
                <p style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 4 }}>
                  {data.riskBasis}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Cost transparency */}
        <StatusRow
          label={locale === "en" ? "Cost transparency" : "费用透明度"}
          status={data.costTransparency}
          statusCopy={getStatusCopy(data.costTransparency, copy)}
          actionLabel={locale === "en" ? "View breakdown" : "查看明细"}
          extra={data.costEstimate
            ? `\u00A5${data.costEstimate.min.toLocaleString()} \u2013 \u00A5${data.costEstimate.max.toLocaleString()}`
            : undefined}
        />

        {/* Online eligibility */}
        <StatusRow
          label={locale === "en" ? "Online process available" : "可在线办理"}
          status={data.onlineEligible ? "verified" : "unknown"}
          statusCopy={data.onlineEligible
            ? (locale === "en" ? "Partial online process supported" : "支持部分在线流程")
            : (locale === "en" ? "Check with agent" : "请与客服确认")}
          actionLabel={locale === "en" ? "Learn more" : "了解更多"}
        />
      </div>

      {/* Evidence / timestamp row */}
      <div style={evidenceSectionStyle}>
        {data._evidenceError ? (
          /* ω5: evidence failure MUST be visible, never silent */
          <p style={{ fontSize: 11, color: "#E24B4A", margin: 0 }}>
            {"\u25B2"} {copy.evidenceWriteFailed}
          </p>
        ) : data.evidenceHash ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#1D9E75" }}>{"\u2713"}</span>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
              {copy.evidenceTimestampLabel}
            </span>
            <button
              onClick={() => {
                track(Events.EVIDENCE_VIEW, { analysisId, locale });
                onShowEvidence?.(data.evidenceHash!, data.evidenceTimestamp!);
              }}
              style={evidenceLinkStyle}
            >
              {copy.evidenceViewDetail}
            </button>
          </div>
        ) : null}
      </div>

      {/* Mandatory disclaimer — server controls copy */}
      <p style={disclaimerStyle}>{data.disclaimer}</p>

    </section>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function StatusRow({
  label, status, statusCopy, actionLabel, extra, onAction,
}: {
  label: string;
  status: TrustStatus;
  statusCopy: string;
  actionLabel: string;
  extra?: string;
  onAction?: () => void;
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
      minHeight: 44,
      padding: "4px 0",
      borderBottom: "0.5px solid var(--color-border-tertiary)",
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 2px" }}>
          {label}
        </p>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
          {statusCopy}
          {extra && (
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: 6 }}>
              {extra}
            </span>
          )}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <TrustBadge status={status} label="" />
        <button onClick={onAction} style={rowActionStyle}>{actionLabel}</button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusCopy(
  status: TrustStatus,
  copy: TrustDashboardProps["copy"]
): string {
  const map: Record<TrustStatus, keyof TrustDashboardProps["copy"]> = {
    verified: "trustStatusVerified",
    partial:  "trustStatusPartial",
    risk:     "trustStatusRisk",
    unknown:  "trustStatusUnknown",
    pending:  "trustStatusPending",
  };
  return copy[map[status]] as string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  margin: "0 20px 16px",
  border: "0.5px solid var(--color-border-tertiary)",
  borderRadius: "var(--border-radius-lg)",
  overflow: "hidden",
};
const headerStyle: React.CSSProperties = {
  padding: "12px 14px 8px",
  borderBottom: "0.5px solid var(--color-border-tertiary)",
  background: "var(--color-background-secondary)",
};
const titleStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 500, margin: "0 0 2px",
  color: "var(--color-text-primary)",
};
const skeletonRowStyle: React.CSSProperties = {
  height: 40, margin: "8px 14px",
  background: "var(--color-background-secondary)",
  borderRadius: "var(--border-radius-md)",
  animation: "pulse 1.5s ease-in-out infinite",
};
const evidenceSectionStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderTop: "0.5px solid var(--color-border-tertiary)",
};
const disclaimerStyle: React.CSSProperties = {
  fontSize: 10, color: "var(--color-text-tertiary)",
  padding: "6px 14px 12px", margin: 0, lineHeight: 1.5,
};
const riskExpandedStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  padding: "10px 12px",
  background: "#FAEEDA",
  borderRadius: "var(--border-radius-md)",
};
const riskSectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, color: "#633806", margin: "0 0 4px",
};
const riskItemStyle: React.CSSProperties = {
  fontSize: 11, color: "#633806", margin: "0 0 2px", paddingLeft: 4,
};
const rowActionStyle: React.CSSProperties = {
  fontSize: 11, color: "#1D9E75", background: "none",
  border: "none", cursor: "pointer", padding: "0 4px",
  fontFamily: "var(--font-sans)", minHeight: 44, display: "flex",
  alignItems: "center",
};
const evidenceLinkStyle: React.CSSProperties = {
  fontSize: 11, color: "#1D9E75", background: "none",
  border: "none", cursor: "pointer", padding: 0,
  fontFamily: "var(--font-sans)", textDecoration: "underline",
};
