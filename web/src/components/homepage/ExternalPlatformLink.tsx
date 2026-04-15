"use client";

/**
 * components/homepage/ExternalPlatformLink.tsx
 *
 * Renders a link to an external property platform.
 *
 * SPEC §3.10 compliance:
 *   - Always shows an "External link" label (copy from i18n)
 *   - Never implies official partnership or affiliation
 *   - Opens in new tab with rel="noopener noreferrer"
 *   - Fires external_platform_click analytics event on click
 *
 * SPEC §5.1: fires external_platform_click with platform name and locale.
 */

import React from "react";
import { track, Events } from "@/lib/analytics/events";
import type { HomepageCopy } from "@/lib/i18n/homepage";

interface Props {
  /** Platform display name, e.g. "AtHome" */
  name: string;
  /** Destination URL */
  href: string;
  /** One-line description */
  description?: string;
  /** Show 外国人友好 badge */
  foreignFriendly?: boolean;
  /** Show 支持中文 badge */
  hasChinese?: boolean;
  /** Current locale — included in analytics payload */
  locale: string;
  copy: Pick<HomepageCopy, "externalLabel" | "externalNote">;
  className?: string;
}

export function ExternalPlatformLink({
  name,
  href,
  description,
  foreignFriendly,
  hasChinese,
  locale,
  copy,
  className = "",
}: Props) {
  function handleClick() {
    track(Events.EXTERNAL_PLATFORM_CLICK, { platform: name, locale });
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
      aria-label={`${name} — ${copy.externalNote}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "10px 14px",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-md)",
        textDecoration: "none",
        background: "var(--color-background-primary)",
        transition: "border-color 0.15s",
      }}
    >
      {/* Platform name */}
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: "var(--color-text-primary)",
          lineHeight: 1.3,
        }}
      >
        {name}
      </span>

      {/* Description */}
      {description && (
        <span style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
          {description}
        </span>
      )}

      {/* Badges */}
      {(foreignFriendly || hasChinese) && (
        <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {foreignFriendly && (
            <span style={{ fontSize: 10, color: "#1D9E75", background: "#E1F5EE", borderRadius: 4, padding: "1px 5px" }}>
              外国人友好
            </span>
          )}
          {hasChinese && (
            <span style={{ fontSize: 10, color: "#2563EB", background: "#EFF6FF", borderRadius: 4, padding: "1px 5px" }}>
              支持中文
            </span>
          )}
        </span>
      )}

      {/* Mandatory external-link badge — spec §3.10 */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: 11,
          color: "var(--color-text-secondary)",
        }}
      >
        {/* Arrow-out icon (inline SVG, no emoji) */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1.5 8.5L8.5 1.5M8.5 1.5H3.5M8.5 1.5V6.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {copy.externalLabel}
      </span>
    </a>
  );
}
