"use client";

/**
 * V5 §4.4 — Three Step Guide with Platform Cards
 * Maturity: production-ready
 *
 * Expanded by primary CTA click. Shows 3-step usage flow
 * and platform card grid with foreignFriendly / hasChinese badges.
 */

import { useEffect, useRef } from "react";
import { platforms, PLATFORM_GUIDE } from "@/lib/platforms/japan-property-platforms";
import { track, Events } from "@/lib/analytics/events";
import type { HomepageCopy } from "@/lib/i18n/homepage";

interface Props {
  isOpen: boolean;
  locale: string;
  copy: HomepageCopy;
}

export function ThreeStepGuide({ isOpen, locale, copy }: Props) {
  const tracked = useRef(false);

  useEffect(() => {
    if (isOpen && !tracked.current) {
      tracked.current = true;
      track(Events.GUIDE_EXPAND);
      setTimeout(() => {
        document.querySelector("#jtg-analysis-zone")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const guideText =
    PLATFORM_GUIDE[locale] ?? PLATFORM_GUIDE["zh-Hans"];

  return (
    <div
      role="region"
      aria-label="三步使用引导"
      style={{
        marginTop: 12,
        padding: "14px",
        background: "#E1F5EE",
        borderRadius: "var(--border-radius-md)",
        borderTop: "0.5px solid #9FE1CB",
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: "#0F6E56", margin: "0 0 12px" }}>
        {copy.guideTitle}
      </p>

      {/* Steps */}
      {[copy.step1, copy.step2, copy.step3].map((step, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <span style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#1D9E75",
            color: "#fff",
            fontSize: 12,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {i + 1}
          </span>
          <span style={{ fontSize: 12, color: "#0F6E56", lineHeight: 1.6 }}>
            {step}
          </span>
        </div>
      ))}

      {/* Guide text box */}
      <div style={{
        fontSize: 12,
        color: "var(--color-text-secondary)",
        background: "var(--color-background-primary)",
        border: "1px solid var(--color-border-tertiary)",
        borderRadius: 8,
        padding: "8px 12px",
        marginBottom: 12,
        lineHeight: 1.7,
      }}>
        {guideText}
      </div>

      {/* Platform cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
        gap: 8,
      }}>
        {platforms.map((p) => (
          <a
            key={p.id}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track(Events.EXTERNAL_PLATFORM_CLICK, { platform: p.id })}
            aria-label={`${p.name}（${copy.externalLabel}）`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              padding: "8px 10px",
              border: "1px solid var(--color-border-tertiary)",
              borderRadius: 8,
              textDecoration: "none",
              background: "var(--color-background-primary)",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>
              {p.name}
              <span style={{ fontSize: 10, color: "var(--color-text-secondary)", marginLeft: 3 }}>↗</span>
            </span>
            <span style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 2, lineHeight: 1.4 }}>
              {p.description}
            </span>
            {(p.foreignFriendly || p.hasChinese) && (
              <span style={{
                marginTop: 4,
                fontSize: 9,
                background: "#E1F5EE",
                color: "#0F6E56",
                padding: "1px 5px",
                borderRadius: 3,
                fontWeight: 500,
              }}>
                {p.hasChinese ? "支持中文" : "外国人友好"}
              </span>
            )}
          </a>
        ))}
      </div>

      <p style={{ fontSize: 10, color: "#0F6E56", opacity: 0.65, marginTop: 8, lineHeight: 1.5, margin: "8px 0 0" }}>
        以上均为外部链接，点击后将跳转至各平台官网。JTG 与上述平台无合作关系。
      </p>
    </div>
  );
}
