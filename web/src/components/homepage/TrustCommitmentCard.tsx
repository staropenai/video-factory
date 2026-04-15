"use client";

import { useState } from "react";
import { track, Events } from "@/lib/analytics/events";
import { TrustBadge } from "./TrustBadge";
import type { Locale } from "@/lib/i18n/homepage";

interface Action {
  label: string;
  href?: string;
  external?: boolean;
}

interface Props {
  icon: string;
  title: string;
  summary: string;
  detail: string;
  actions: Action[];
  status: "verified" | "partial" | "risk" | "unknown" | "pending";
  locale: Locale;
  commitmentName: string;
}

export function TrustCommitmentCard({
  icon,
  title,
  summary,
  detail,
  actions,
  status,
  locale,
  commitmentName,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-md)",
        overflow: "hidden",
        transition: "border-color 0.15s",
        ...(expanded ? { borderColor: "#1D9E75" } : {}),
      }}
    >
      <button
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded) {
            track(Events.TRUST_PROMISE_CLICK, { commitment: commitmentName, locale });
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          minHeight: 44,
          padding: "10px 14px",
          background: expanded ? "#E1F5EE" : "var(--color-background-primary)",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "var(--font-sans)",
          transition: "background 0.15s",
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <TrustBadge status={status} label={title} locale={locale} />
          </div>
          {!expanded && (
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "2px 0 0", lineHeight: 1.4 }}>
              {summary}
            </p>
          )}
        </div>
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-tertiary)",
            flexShrink: 0,
            transition: "transform 0.15s",
            transform: expanded ? "rotate(180deg)" : "rotate(0)",
          }}
        >
          ▾
        </span>
      </button>
      {expanded && (
        <div style={{ padding: "0 14px 12px", background: "#E1F5EE" }}>
          <p style={{ fontSize: 12, color: "#0F6E56", lineHeight: 1.6, margin: "0 0 8px" }}>
            {detail}
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {actions.map((action, i) => (
              action.href ? (
                <a
                  key={i}
                  href={action.href}
                  target={action.external ? "_blank" : undefined}
                  rel={action.external ? "noopener noreferrer" : undefined}
                  style={{
                    fontSize: 11,
                    color: "#1D9E75",
                    border: "0.5px solid #1D9E75",
                    borderRadius: "var(--border-radius-md)",
                    padding: "4px 10px",
                    textDecoration: "none",
                    minHeight: 30,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {action.label}
                </a>
              ) : (
                <span
                  key={i}
                  style={{
                    fontSize: 11,
                    color: "#1D9E75",
                    border: "0.5px solid #1D9E75",
                    borderRadius: "var(--border-radius-md)",
                    padding: "4px 10px",
                    cursor: "pointer",
                    minHeight: 30,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {action.label}
                </span>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
