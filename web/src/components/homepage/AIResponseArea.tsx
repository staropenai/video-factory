"use client";

/**
 * components/homepage/AIResponseArea.tsx — V4 Streaming UI
 *
 * Three visual states per spec:
 *   1. Thinking  — pulse animation, no content yet (TTFT target <800ms)
 *   2. Streaming — typewriter text + blinking cursor
 *   3. Complete  — full text + disclaimer + action buttons
 *   +  Error     — retry + contact support (both always visible)
 *
 * Tier A/B: no typewriter animation (content arrives instantly as JSON).
 * Tier C:   full streaming experience.
 *
 * Human help button remains visible at ALL times per V4 spec.
 */

import React from "react";
import type { HomepageCopy } from "@/lib/i18n/homepage";

interface Props {
  copy: Pick<
    HomepageCopy,
    "aiThinking" | "aiError" | "aiDisclaimer" | "aiFromKB" | "aiBtnCopy" | "aiBtnRetry" | "aiBtnContact"
  >;
  content: string;
  isThinking: boolean;
  isDone: boolean;
  error: string | null;
  tier: string | null;
  onRetry: () => void;
  onContactSupport: () => void;
}

export function AIResponseArea({
  copy,
  content,
  isThinking,
  isDone,
  error,
  tier,
  onRetry,
  onContactSupport,
}: Props) {
  const isTierC = tier === "C" || tier === "CACHE";
  const hasContent = content.length > 0;

  // Nothing to show yet — user hasn't submitted
  if (!isThinking && !hasContent && !error) return null;

  return (
    <div
      className="ai-response-container"
      style={{
        margin: "0 20px 12px",
        minHeight: 120,
        overflowWrap: "break-word",
        wordBreak: "break-word",
      }}
    >
      {/* ── State 1: Thinking (pulse animation) ──────────────────────── */}
      {isThinking && !hasContent && !error && (
        <div
          className="thinking-indicator"
          aria-live="polite"
          style={{
            padding: "12px 14px",
            fontSize: 13,
            color: "var(--color-text-secondary)",
            background: "var(--color-background-secondary)",
            borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-tertiary)",
          }}
        >
          {copy.aiThinking}
        </div>
      )}

      {/* ── State 2: Streaming (typewriter + cursor) ─────────────────── */}
      {hasContent && !isDone && (
        <div
          aria-live="polite"
          aria-atomic="false"
          style={{
            padding: "12px 14px",
            fontSize: 13,
            color: "var(--color-text-primary)",
            background: "#E1F5EE",
            borderRadius: "var(--border-radius-md)",
            border: "0.5px solid #9FE1CB",
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
          }}
        >
          <span>{content}</span>
          <span className="streaming-cursor" aria-hidden="true" />
        </div>
      )}

      {/* ── State 3: Complete ────────────────────────────────────────── */}
      {isDone && hasContent && !error && (
        <div
          style={{
            padding: "12px 14px",
            fontSize: 13,
            color: "var(--color-text-primary)",
            background: "#E1F5EE",
            borderRadius: "var(--border-radius-md)",
            border: "0.5px solid #9FE1CB",
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
          }}
        >
          {content}

          {/* Tier label / disclaimer */}
          <p
            style={{
              fontSize: 11,
              color: isTierC
                ? "var(--color-text-tertiary)"
                : "#1D9E75",
              marginTop: 10,
              marginBottom: 8,
              opacity: 0.85,
            }}
          >
            {isTierC ? copy.aiDisclaimer : copy.aiFromKB}
          </p>

          {/* Action buttons — only after isDone */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                try {
                  navigator.clipboard.writeText(content);
                } catch {
                  // Clipboard not available
                }
              }}
              style={actionBtnStyle}
            >
              {copy.aiBtnCopy}
            </button>
            <button onClick={onContactSupport} style={actionBtnStyle}>
              {copy.aiBtnContact}
            </button>
          </div>
        </div>
      )}

      {/* ── Error state ──────────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 14px",
            fontSize: 13,
            color: "var(--color-text-danger, #A32D2D)",
            background: "var(--color-background-danger, #FCEBEB)",
            borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-danger, #F09595)",
          }}
        >
          <p style={{ margin: "0 0 8px" }}>{copy.aiError}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={onRetry} style={actionBtnStyle}>
              {copy.aiBtnRetry}
            </button>
            <button onClick={onContactSupport} style={actionBtnStyle}>
              {copy.aiBtnContact}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  border: "0.5px solid var(--color-border-secondary)",
  borderRadius: "var(--border-radius-md)",
  background: "var(--color-background-primary)",
  color: "var(--color-text-primary)",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};
