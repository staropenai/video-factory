"use client";
/**
 * TrustBadge — unified visual status indicator for all trust/verification states.
 *
 * maturity: production-ready
 * security: status MUST come from server — never accept a computed status as prop
 *           from a parent that computed it locally
 *
 * 5 states:
 *   verified  — green  ✓  confirmed by server
 *   partial   — amber  ◐  partially confirmed, action needed
 *   risk      — red    ▲  risk item, attention required
 *   unknown   — gray   ○  cannot determine from available data
 *   pending   — gray   …  server request in flight
 */

import React from "react";
import { track, Events } from "@/lib/analytics/events";

export type TrustStatus = "verified" | "partial" | "risk" | "unknown" | "pending";

interface TrustBadgeProps {
  status: TrustStatus;
  label: string;
  /** If provided, renders as an interactive button and fires trust_promise_click */
  onClick?: () => void;
  /** Promise index (1–5) for analytics — only used when onClick is provided */
  promiseIndex?: number;
  locale?: string;
}

export const STATUS_CONFIG: Record<
  TrustStatus,
  { color: string; bg: string; icon: string; textColor: string }
> = {
  verified: { color: "#1D9E75", bg: "#E1F5EE", icon: "✓", textColor: "#0F6E56" },
  partial:  { color: "#BA7517", bg: "#FAEEDA", icon: "◐", textColor: "#633806" },
  risk:     { color: "#E24B4A", bg: "#FCEBEB", icon: "▲", textColor: "#791F1F" },
  unknown:  { color: "#888780", bg: "#F1EFE8", icon: "○", textColor: "#5F5E5A" },
  pending:  { color: "#888780", bg: "#F1EFE8", icon: "…", textColor: "#5F5E5A" },
};

export function TrustBadge({
  status,
  label,
  onClick,
  promiseIndex,
  locale = "zh-Hans",
}: TrustBadgeProps) {
  const cfg = STATUS_CONFIG[status];

  function handleClick() {
    if (!onClick) return;
    if (promiseIndex !== undefined) {
      track(Events.TRUST_PROMISE_CLICK, {
        promise_index: promiseIndex,
        promise_label: label,
        locale,
      });
    }
    onClick();
  }

  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 10px",
    borderRadius: 20,
    border: `0.5px solid ${cfg.color}`,
    background: cfg.bg,
    cursor: onClick ? "pointer" : "default",
    minHeight: 28,
    fontFamily: "var(--font-sans)",
    transition: "opacity 0.15s",
  };

  const content = (
    <>
      <span style={{ fontSize: 11, color: cfg.color, lineHeight: 1 }} aria-hidden="true">
        {cfg.icon}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: cfg.textColor }}>
        {label}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={handleClick}
        style={style}
        aria-label={label}
      >
        {content}
      </button>
    );
  }

  return <span style={style}>{content}</span>;
}
