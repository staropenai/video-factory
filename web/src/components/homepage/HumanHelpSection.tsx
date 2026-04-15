"use client";

/**
 * components/homepage/HumanHelpSection.tsx
 *
 * Implements the two-path human-help design from spec §3.4:
 *
 *   Path A — Info-send channels (LINE, WeChat, Email, WhatsApp)
 *     → User clicks a channel
 *     → Confirmation strip appears FIRST (spec §3.4-A)
 *     → Confirmation strip explains: what is sent, language support, free
 *     → User confirms → actual channel link opens
 *
 *   Path B — Direct phone
 *     → Phone entry is visually distinct from Path A
 *     → Explanation shown inline: agent has less context, no info sent (spec §3.4-B)
 *     → No confirmation strip required (nothing is sent)
 *
 * SPEC CONSTRAINTS ENFORCED
 *   - Do NOT merge the two paths (spec §3.4 explicit requirement)
 *   - Do NOT default-send user data without confirmation
 *   - Do NOT promise specific response times unless operationally confirmed
 *     (phone entry shows no SLA — leave that to runtime config)
 *   - FIRES analytics events: human_help_click, contact_confirm_submit, phone_click
 */

import React, { useState } from "react";
import { track, Events } from "@/lib/analytics/events";
import type { HomepageCopy } from "@/lib/i18n/homepage";

interface ChannelConfig {
  key: "line" | "wechat" | "email" | "whatsapp";
  labelKey: keyof Pick<
    HomepageCopy,
    "channelLine" | "channelWechat" | "channelEmail" | "channelWhatsApp"
  >;
  /** Actual link — passed in from page config, NOT hardcoded here */
  href: string;
}

interface Props {
  copy: Pick<
    HomepageCopy,
    | "humanTitle"
    | "humanLangBadge"
    | "humanDesc"
    | "confirmTitle"
    | "confirmBody"
    | "confirmOk"
    | "confirmCancel"
    | "phoneLabel"
    | "phoneDesc"
    | "channelLine"
    | "channelWechat"
    | "channelEmail"
    | "channelWhatsApp"
    | "channelPhone"
    | "humanReplyTime"
    | "humanFallback"
  >;
  locale: string;
  /** Runtime channel URLs — never hardcoded in this component */
  channels: {
    line?: string;
    wechat?: string;
    email?: string;
    whatsapp?: string;
    phone?: string;
  };
}

export function HumanHelpSection({ copy, locale, channels }: Props) {
  const [pendingChannel, setPendingChannel] = useState<ChannelConfig | null>(
    null
  );

  const hasAnyChannel = !!(channels.line || channels.wechat || channels.email || channels.whatsapp || channels.phone);

  const infoChannels = ([
    { key: "line" as const,      labelKey: "channelLine" as const,      href: channels.line      ?? "#" },
    { key: "wechat" as const,    labelKey: "channelWechat" as const,    href: channels.wechat    ?? "#" },
    { key: "email" as const,     labelKey: "channelEmail" as const,     href: channels.email     ?? "#" },
    { key: "whatsapp" as const,  labelKey: "channelWhatsApp" as const,  href: channels.whatsapp  ?? "#" },
  ] satisfies ChannelConfig[]).filter((c) => channels[c.key]);

  function openConfirm(channel: ChannelConfig) {
    track(Events.HUMAN_HELP_CLICK, { channel: channel.key, locale });
    setPendingChannel(channel);
    // Scroll confirmation strip into view on mobile
    setTimeout(() => {
      document.getElementById("jtg-confirm-strip")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 50);
  }

  function confirmAndOpen() {
    if (!pendingChannel) return;
    track(Events.CONTACT_CONFIRM_SUBMIT, { channel: pendingChannel.key, locale });
    window.open(pendingChannel.href, "_blank", "noopener,noreferrer");
    setPendingChannel(null);
  }

  function cancelConfirm() {
    setPendingChannel(null);
  }

  function handlePhoneClick() {
    track(Events.PHONE_CLICK, { locale });
    if (channels.phone) {
      window.location.href = `tel:${channels.phone}`;
    }
  }

  return (
    <section
      aria-label={copy.humanTitle}
      style={{
        margin: "0 20px 20px",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 0",
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
          {copy.humanTitle}
        </h2>
        <span
          style={{
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 20,
            background: "#E1F5EE",
            color: "#0F6E56",
          }}
        >
          {copy.humanLangBadge}
        </span>
      </div>

      <p
        style={{
          fontSize: 12,
          color: "var(--color-text-secondary)",
          lineHeight: 1.55,
          padding: "8px 16px 14px",
          margin: 0,
          borderBottom: "0.5px solid var(--color-border-tertiary)",
        }}
      >
        {copy.humanDesc}
      </p>

      {/* Reply time hint */}
      <p
        style={{
          fontSize: 11,
          color: "#0F6E56",
          padding: "0 16px 10px",
          margin: 0,
        }}
      >
        {copy.humanReplyTime}
      </p>

      {/* Fallback: no channels configured */}
      {!hasAnyChannel && (
        <p
          style={{
            fontSize: 12,
            color: "var(--color-text-secondary)",
            padding: "12px 16px 14px",
            margin: 0,
            textAlign: "center",
          }}
        >
          {copy.humanFallback}
        </p>
      )}

      {/* ── Path A: Info-send channels ─────────────────────────────────── */}
      {infoChannels.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(infoChannels.length, 4)}, minmax(0, 1fr))`,
            gap: 8,
            padding: "12px 16px",
          }}
        >
          {infoChannels.map((ch) => (
            <button
              key={ch.key}
              onClick={() => openConfirm(ch)}
              aria-label={copy[ch.labelKey]}
              style={{
                padding: "8px 4px",
                border: "0.5px solid var(--color-border-tertiary)",
                borderRadius: "var(--border-radius-md)",
                background: "var(--color-background-primary)",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                textAlign: "center",
                transition: "border-color 0.15s",
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                }}
              >
                {copy[ch.labelKey]}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Confirmation strip (Path A) — spec §3.4-A ─────────────────── */}
      {pendingChannel && (
        <div
          id="jtg-confirm-strip"
          role="dialog"
          aria-modal="false"
          aria-labelledby="confirm-title"
          style={{
            margin: "0 16px 12px",
            padding: "12px 14px",
            border: "0.5px solid #9FE1CB",
            borderRadius: "var(--border-radius-md)",
            background: "#E1F5EE",
          }}
        >
          <p
            id="confirm-title"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#0F6E56",
              margin: "0 0 6px",
            }}
          >
            {copy.confirmTitle}
          </p>
          <p
            style={{
              fontSize: 12,
              color: "#0F6E56",
              lineHeight: 1.55,
              margin: "0 0 10px",
            }}
          >
            {copy.confirmBody}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={confirmAndOpen}
              style={{
                padding: "7px 14px",
                border: "none",
                borderRadius: "var(--border-radius-md)",
                background: "#1D9E75",
                color: "#fff",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}
            >
              {copy.confirmOk}
            </button>
            <button
              onClick={cancelConfirm}
              style={{
                padding: "7px 14px",
                border: "0.5px solid #0F6E56",
                borderRadius: "var(--border-radius-md)",
                background: "transparent",
                color: "#0F6E56",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}
            >
              {copy.confirmCancel}
            </button>
          </div>
        </div>
      )}

      {/* ── Path B: Direct phone — spec §3.4-B ────────────────────────── */}
      {channels.phone && (
        <div
          style={{
            margin: "0 16px 14px",
            padding: "10px 12px",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-md)",
            background: "var(--color-background-secondary)",
          }}
        >
          <button
            onClick={handlePhoneClick}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              fontFamily: "var(--font-sans)",
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-text-primary)",
                marginBottom: 4,
              }}
            >
              {copy.phoneLabel}
            </span>
          </button>
          {/* Mandatory explanation — spec §3.4-B: must distinguish this path */}
          <p
            style={{
              fontSize: 11,
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {copy.phoneDesc}
          </p>
        </div>
      )}
    </section>
  );
}
