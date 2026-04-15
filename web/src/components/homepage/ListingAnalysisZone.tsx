"use client";

/**
 * components/homepage/ListingAnalysisZone.tsx
 *
 * Listing analysis entry zone — implements spec §3.3:
 *   "At least three input types must be present: screenshot upload, URL paste, text description."
 *
 * Three tabs switch between the three input modes.
 * Each mode fires a distinct analytics event so usage distribution can be observed
 * without pre-judging which path converts best (spec §4.2 / §5.2).
 *
 * SPEC CONSTRAINTS
 *   - Screenshot cannot be the ONLY path
 *   - Displayed copy must NOT claim 100% accuracy
 *   - All three tabs must be visible simultaneously (not hidden behind "more")
 */

import React, { useState, useRef } from "react";
import { track, Events } from "@/lib/analytics/events";
import type { HomepageCopy } from "@/lib/i18n/homepage";

/** Keys from HomepageCopy used by this component */
type AnalysisCopy = Pick<
  HomepageCopy,
  | "analysisTabScreenshot" | "analysisTabUrl" | "analysisTabText"
  | "analysisDropHint" | "analysisDropFormats"
  | "analysisUrlPlaceholder" | "analysisUrlNote"
  | "analysisTextPlaceholder" | "analysisTextNote"
  | "analysisSubmit" | "analysisDisclaimer" | "analysisTimestampNote"
>;

interface Props {
  locale: string;
  /** Localized UI strings — if omitted, English defaults are used */
  copy?: AnalysisCopy;
  /** Callback when analysis should be submitted — parent handles the actual API call */
  onSubmit: (payload: AnalysisPayload) => void;
  disabled?: boolean;
}

export interface AnalysisPayload {
  type: "screenshot" | "url" | "text";
  file?: File;
  url?: string;
  text?: string;
}

/** English defaults — used when copy prop is not provided (e.g. storybook, tests) */
const DEFAULTS: AnalysisCopy = {
  analysisTabScreenshot: "Screenshot",
  analysisTabUrl:        "Paste link",
  analysisTabText:       "Describe in text",
  analysisDropHint:      "Tap or drag a screenshot here",
  analysisDropFormats:   "JPG, PNG, WebP — max 10 MB",
  analysisUrlPlaceholder: "Paste an AtHome / SUUMO / LIFULL listing URL",
  analysisUrlNote:       "The page will be fetched and analysed. Results are for reference only.",
  analysisTextPlaceholder: "Describe the listing you saw: rent, size, station, age of building…",
  analysisTextNote:      "Type as much or as little as you know. AI will try to extract what it can.",
  analysisSubmit:        "Analyse",
  analysisDisclaimer:    "Analysis results are for reference only — verify with the listing page or a human agent.",
  analysisTimestampNote: "This analysis will generate a timestamp record for your future verification",
};

type InputMode = "screenshot" | "url" | "text";

export function ListingAnalysisZone({ locale, copy, onSubmit, disabled }: Props) {
  const L = copy ?? DEFAULTS;
  const [mode, setMode] = useState<InputMode>("screenshot");
  const [urlValue, setUrlValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function switchMode(m: InputMode) {
    setMode(m);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    track(Events.UPLOAD_SCREENSHOT, { locale });
    onSubmit({ type: "screenshot", file });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    track(Events.UPLOAD_SCREENSHOT, { locale });
    onSubmit({ type: "screenshot", file });
  }

  function handleUrlSubmit() {
    if (!urlValue.trim()) return;
    track(Events.PASTE_LISTING_URL, { locale });
    onSubmit({ type: "url", url: urlValue.trim() });
    setUrlValue("");
  }

  function handleTextSubmit() {
    if (!textValue.trim()) return;
    track(Events.TEXT_LISTING_SUBMIT, { locale });
    onSubmit({ type: "text", text: textValue.trim() });
    setTextValue("");
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "7px 4px",
    fontSize: 12,
    fontWeight: active ? 500 : 400,
    color: active ? "#1D9E75" : "var(--color-text-secondary)",
    borderBottom: active ? "2px solid #1D9E75" : "2px solid transparent",
    background: "transparent",
    border: "none",
    borderBottomWidth: 2,
    borderBottomStyle: "solid",
    borderBottomColor: active ? "#1D9E75" : "transparent",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "color 0.15s",
  });

  return (
    <div
      style={{
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        overflow: "hidden",
        background: "var(--color-background-primary)",
      }}
    >
      {/* Three-tab switcher — all three always visible, spec §3.3 */}
      <div
        role="tablist"
        style={{
          display: "flex",
          borderBottom: "0.5px solid var(--color-border-tertiary)",
          padding: "0 4px",
        }}
      >
        {(["screenshot", "url", "text"] as InputMode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            style={tabStyle(mode === m)}
          >
            {m === "screenshot"
              ? L.analysisTabScreenshot
              : m === "url"
              ? L.analysisTabUrl
              : L.analysisTabText}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ padding: 14 }}>

        {/* ── Screenshot panel ─────────────────────────────────────── */}
        {mode === "screenshot" && (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "24px 16px",
                border: `1.5px dashed ${dragOver ? "#1D9E75" : "var(--color-border-secondary)"}`,
                borderRadius: "var(--border-radius-md)",
                background: dragOver ? "#E1F5EE" : "var(--color-background-secondary)",
                cursor: "pointer",
                transition: "all 0.15s",
                minHeight: 100,
              }}
            >
              {/* Upload icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3v13M7 8l5-5 5 5M4 20h16" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 13, color: "var(--color-text-secondary)", textAlign: "center" }}>
                {L.analysisDropHint}
              </span>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                {L.analysisDropFormats}
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={handleFileChange}
              disabled={disabled}
            />
          </>
        )}

        {/* ── URL panel ──────────────────────────────────────────── */}
        {mode === "url" && (
          <>
            <input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder={L.analysisUrlPlaceholder}
              disabled={disabled}
              onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
              style={{
                width: "100%",
                padding: "9px 12px",
                fontSize: 13,
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: "var(--border-radius-md)",
                background: "var(--color-background-primary)",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-sans)",
                outline: "none",
                marginBottom: 8,
              }}
            />
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 10px", lineHeight: 1.5 }}>
              {L.analysisUrlNote}
            </p>
            <button
              onClick={handleUrlSubmit}
              disabled={!urlValue.trim() || disabled}
              style={{
                padding: "8px 16px",
                background: "#1D9E75",
                color: "#fff",
                border: "none",
                borderRadius: "var(--border-radius-md)",
                fontSize: 13,
                cursor: urlValue.trim() && !disabled ? "pointer" : "not-allowed",
                opacity: urlValue.trim() && !disabled ? 1 : 0.5,
                fontFamily: "var(--font-sans)",
              }}
            >
              {L.analysisSubmit}
            </button>
          </>
        )}

        {/* ── Text panel ─────────────────────────────────────────── */}
        {mode === "text" && (
          <>
            <textarea
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder={L.analysisTextPlaceholder}
              disabled={disabled}
              rows={4}
              style={{
                width: "100%",
                padding: "9px 12px",
                fontSize: 13,
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: "var(--border-radius-md)",
                background: "var(--color-background-primary)",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-sans)",
                outline: "none",
                resize: "vertical",
                marginBottom: 8,
                lineHeight: 1.55,
              }}
            />
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 10px", lineHeight: 1.5 }}>
              {L.analysisTextNote}
            </p>
            <button
              onClick={handleTextSubmit}
              disabled={!textValue.trim() || disabled}
              style={{
                padding: "8px 16px",
                background: "#1D9E75",
                color: "#fff",
                border: "none",
                borderRadius: "var(--border-radius-md)",
                fontSize: 13,
                cursor: textValue.trim() && !disabled ? "pointer" : "not-allowed",
                opacity: textValue.trim() && !disabled ? 1 : 0.5,
                fontFamily: "var(--font-sans)",
              }}
            >
              {L.analysisSubmit}
            </button>
          </>
        )}

        {/* Mandatory disclaimer — spec §3.5 */}
        <p
          style={{
            fontSize: 11,
            color: "var(--color-text-tertiary)",
            margin: "10px 0 0",
            lineHeight: 1.5,
          }}
        >
          {L.analysisDisclaimer}
        </p>
        <p
          style={{
            fontSize: 11,
            color: "var(--color-text-secondary)",
            margin: "4px 0 0",
            lineHeight: 1.5,
          }}
        >
          {L.analysisTimestampNote}
        </p>
      </div>
    </div>
  );
}
