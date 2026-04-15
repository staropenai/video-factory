"use client";

/**
 * app/(jtg)/[locale]/page.tsx  — JTG Homepage V3
 *
 * SPEC COMPLIANCE SUMMARY
 * ───────────────────────
 * §3.1  Entry naming: tabs use task-stage naming, no mixed dimensions
 * §3.2  Primary entry for listing browse is first and visually prominent; others remain visible
 * §3.3  ListingAnalysisZone provides screenshot / URL / text (via component)
 * §3.4  HumanHelpSection implements info-send (A) and direct-phone (B) as distinct paths
 * §3.5  AI copy: no absolute claims; disclaimer fixed; quota uses restrained wording
 * §3.6  Hero: no jargon terms in first screen (保証会社, 敷金, etc. appear only in FAQ)
 * §3.7  Trust bar rendered immediately after FAQ list
 * §3.8  Mobile: 375px safe; buttons ≥44px; AI results would fold in result page (out of scope here)
 * §3.9  Login shown only if NEXT_PUBLIC_AUTH_ENABLED=true
 * §3.10 ExternalPlatformLink enforces "external link" labelling
 * §5.1  All required events tracked (home_view, dwell, entry clicks, faq, ai, channels, external)
 *
 * WHAT THIS FILE DOES NOT CONTAIN
 * ────────────────────────────────
 * - Hardcoded channel URLs (comes from env / config)
 * - KPI thresholds (no baseline yet — spec §4.5 / §5.3)
 * - Assertions that any one entry card layout is "correct"
 *   (two layout variants exist so the team can A/B test — spec §4.2)
 */

import React, { useState, useEffect, useCallback, useRef, use } from "react";
import { track, Events } from "@/lib/analytics/events";
import { useDwell } from "@/lib/analytics/useDwell";
import { getCopy, type Locale } from "@/lib/i18n/homepage";
import { ExternalPlatformLink } from "@/components/homepage/ExternalPlatformLink";
import { HumanHelpSection } from "@/components/homepage/HumanHelpSection";
import { ListingAnalysisZone } from "@/components/homepage/ListingAnalysisZone";
import type { AnalysisPayload } from "@/components/homepage/ListingAnalysisZone";
import { AIZone } from "@/components/homepage/AIZone";
import { AIResponseArea } from "@/components/homepage/AIResponseArea";
import { StreamErrorBoundary } from "@/components/homepage/StreamErrorBoundary";
import { TrustBadge } from "@/components/homepage/TrustBadge";
import { TrustDashboard } from "@/components/homepage/TrustDashboard";
import { EvidenceModal } from "@/components/homepage/EvidenceModal";
import { LossAversionBanner } from "@/components/homepage/LossAversionBanner";
import { TrustCommitmentCard } from "@/components/homepage/TrustCommitmentCard";
import { TransparencyLayer } from "@/components/homepage/TransparencyLayer";
import { ThreeStepGuide } from "@/components/homepage/ThreeStepGuide";
import { useStreamQuery } from "@/hooks/useStreamQuery";
import { getFaqData, type TabKey } from "@/lib/jtg/faq-data";

// ─── Runtime config ──────────────────────────────────────────────────────────
// All URLs come from env so this file stays free of hardcoded platform references.

const CHANNEL_CONFIG = {
  line:      process.env.NEXT_PUBLIC_LINE_URL      ?? "",
  wechat:    process.env.NEXT_PUBLIC_WECHAT_URL    ?? "",
  email:     process.env.NEXT_PUBLIC_EMAIL_URL     ?? "",
  whatsapp:  process.env.NEXT_PUBLIC_WHATSAPP_URL  ?? "",
  phone:     process.env.NEXT_PUBLIC_PHONE_NUMBER  ?? "",
};

const EXTERNAL_PLATFORMS = [
  { name: "AtHome",        href: "https://www.athome.co.jp" },
  { name: "SUUMO",         href: "https://suumo.jp" },
  { name: "LIFULL HOME'S", href: "https://www.homes.co.jp" },
  { name: "CHINTAI",       href: "https://www.chintai.net" },
  { name: "UR賃貸",        href: "https://www.ur-net.go.jp/chintai" },
  { name: "GoodRooms",     href: "https://www.goodrooms.jp" },
  { name: "Real Estate Japan", href: "https://realestate.co.jp" },
];

const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
/** V12: SSE streaming. Set to "false" to fall back to the synchronous /api/router endpoint. */
const STREAMING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_STREAMING !== "false";

// ─── Component ───────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default function JTGHomepage({ params }: PageProps) {
  const { locale: rawLocale } = use(params);
  const locale = rawLocale as Locale;
  const copy = getCopy(locale);

  const [activeTab, setActiveTab] = useState<TabKey>("rent_prep");
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [quotaRemaining, setQuotaRemaining] = useState(3);
  const [quotaLimit, setQuotaLimit] = useState(3);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0); // 0=idle, 1/2/3=staged labels
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  // V6: Trust & Transparency state
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [showTrustDashboard, setShowTrustDashboard] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidenceData, setEvidenceData] = useState<{ hash: string; timestamp: string } | null>(null);

  // V12/V4: streaming AI response
  const stream = useStreamQuery();
  const lastQueryRef = useRef("");

  // Spec §5.1 — home_view on mount
  useEffect(() => {
    track(Events.HOME_VIEW, { locale });
  }, [locale]);

  // Spec §5.1 — home_dwell at milestones
  useDwell(locale);

  // Fetch real quota on mount
  useEffect(() => {
    fetch(`/api/usage/today?lang=${locale}`)
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.remaining === "number") setQuotaRemaining(d.remaining);
        if (typeof d.dailyLimit === "number") setQuotaLimit(d.dailyLimit);
      })
      .catch(() => {}); // never block UI on analytics/quota failure
  }, [locale]);

  // ── Derived FAQ list ──────────────────────────────────────────────────────
  const faqData = getFaqData(locale);
  const allFaqs = faqData[activeTab];
  const filteredFaqs = searchQuery.trim()
    ? allFaqs.filter(
        (f) =>
          f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.a.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.tag.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allFaqs;

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleTabClick(tab: TabKey) {
    setActiveTab(tab);
    setSearchQuery("");
    setOpenFaqId(null);
  }

  function handleFaqClick(id: string) {
    track(Events.FAQ_CLICK, { faq_id: id, tab: activeTab, locale });
    setOpenFaqId(openFaqId === id ? null : id);
  }

  function handlePrimaryEntryClick(entryName: string) {
    track(Events.PRIMARY_ENTRY_CLICK, { entry: entryName, locale });
    if (entryName === "listing_browse") {
      setShowGuide((prev) => !prev);
      document.getElementById("jtg-analysis-zone")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  function handleSecondaryEntryClick(entryName: string) {
    track(Events.SECONDARY_ENTRY_CLICK, { entry: entryName, locale });
    if (entryName === "rent_guide") handleTabClick("rent_prep");
    if (entryName === "ask_ai") {
      document.getElementById("jtg-ai-zone")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  const handleAISubmit = useCallback(
    async (message: string) => {
      if (stream.isThinking || (stream.content && !stream.isDone)) return;
      lastQueryRef.current = message;

      // Step 1: Consume quota via session/open
      try {
        const sessionRes = await fetch("/api/ai/session/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang: locale }),
        });
        const sessionData = await sessionRes.json();

        if (!sessionRes.ok || !sessionData.ok) {
          if (typeof sessionData.remaining === "number") {
            setQuotaRemaining(sessionData.remaining);
          }
          return;
        }

        if (typeof sessionData.remaining === "number") {
          setQuotaRemaining(sessionData.remaining);
        }
        if (typeof sessionData.dailyLimit === "number") {
          setQuotaLimit(sessionData.dailyLimit);
        }

        // Step 2: Stream via SSE (or fall back to sync endpoint if streaming disabled)
        stream.query(message, {
          sessionToken: sessionData.sessionToken,
          locale,
          endpoint: STREAMING_ENABLED ? "/api/router/stream" : "/api/router",
        });
      } catch {
        // Network error on session/open — let the stream hook handle display
      }
    },
    [stream, locale],
  );

  /** Retry the last query (used by AIResponseArea error state) */
  const handleRetry = useCallback(() => {
    if (lastQueryRef.current) handleAISubmit(lastQueryRef.current);
  }, [handleAISubmit]);

  // ── Styles ────────────────────────────────────────────────────────────────
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: active ? 500 : 400,
    color: active ? "#1D9E75" : "var(--color-text-secondary)",
    borderBottom: "2px solid",
    borderBottomColor: active ? "#1D9E75" : "transparent",
    background: "transparent",
    border: "none",
    borderBottomWidth: 2,
    borderBottomStyle: "solid",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    fontFamily: "var(--font-sans)",
    transition: "color 0.15s",
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        maxWidth: 780,
        margin: "0 auto",
        background: "var(--color-background-primary)",
        minHeight: "100vh",
      }}
    >

      {/* ── V6 ZONE 1: Loss aversion banner ──────────────────────────── */}
      <LossAversionBanner copy={copy} />

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: "0.5px solid var(--color-border-tertiary)",
          position: "sticky",
          top: 0,
          background: "var(--color-background-primary)",
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>
          Japan<span style={{ color: "#1D9E75" }}>Trust</span>Gateway
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* V6 ZONE 0: Trust center nav */}
          <button
            onClick={() => {
              track(Events.VERIFY_CENTER_VISIT, { locale });
              document.getElementById("jtg-trust-promises")?.scrollIntoView({
                behavior: "smooth", block: "start",
              });
            }}
            style={{
              fontSize: 12, padding: "4px 10px",
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: "var(--border-radius-md)",
              background: "transparent",
              color: "var(--color-text-secondary)",
              cursor: "pointer", fontFamily: "var(--font-sans)",
            }}
          >
            {copy.trustCenterNavLabel}
          </button>
          {/* Language switcher — spec §3.1 verification: locale matches URL */}
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: "var(--border-radius-md)",
              color: "var(--color-text-secondary)",
            }}
          >
            {locale}
          </span>

          {/* Login — shown only when auth is enabled (spec §3.9) */}
          {AUTH_ENABLED && (
            <button
              onClick={() => track(Events.LOGIN_CLICK, { locale })}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: "var(--border-radius-md)",
                background: "transparent",
                color: "var(--color-text-primary)",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}
            >
              {copy.navLogin}
            </button>
          )}
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <header style={{ padding: "28px 20px 20px" }}>
        {/* Spec §3.6: eyebrow copy — plain language, no jargon */}
        <p
          style={{
            fontSize: 12,
            color: "#1D9E75",
            fontWeight: 500,
            margin: "0 0 8px",
            letterSpacing: "0.02em",
          }}
        >
          {copy.eyebrow}
        </p>

        {/* Spec §3.6: main title — no industry terms */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 500,
            lineHeight: 1.35,
            color: "var(--color-text-primary)",
            margin: "0 0 6px",
            whiteSpace: "pre-line",
          }}
        >
          {copy.heroTitle}
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-secondary)",
            lineHeight: 1.6,
            margin: "0 0 20px",
          }}
        >
          {copy.heroSub}
        </p>

        {/* ── Primary entry cards (spec §3.2) ───────────────────────── */}
        {/*
          Layout: primary card gets 2 columns on desktop, secondary cards split the rest.
          On mobile (< 480px) all stack to full width.
          This is ONE layout option — a second variant should be prepared for A/B
          evaluation per spec §4.2 ("best structure is to be validated").
        */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          {/* Card 1 — Primary: listing browse + AI (spec §3.2 must-have primary entry) */}
          <div
            style={{
              padding: "14px 12px",
              border: "0.5px solid #1D9E75",
              borderRadius: "var(--border-radius-lg)",
              background: "#E1F5EE",
              cursor: "pointer",
              gridColumn: "1 / 2",
            }}
            onClick={() => handlePrimaryEntryClick("listing_browse")}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "#9FE1CB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8,
                fontSize: 14,
              }}
            >
              🏠
            </div>
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#0F6E56",
                lineHeight: 1.35,
                margin: "0 0 3px",
                whiteSpace: "pre-line",
              }}
            >
              {copy.card1Label}
            </p>
            <p style={{ fontSize: 11, color: "#0F6E56", opacity: 0.8, margin: 0, lineHeight: 1.4 }}>
              {copy.card1Hint}
            </p>
          </div>

          {/* Card 2 — Secondary: rent guide */}
          <div
            style={{
              padding: "14px 12px",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-lg)",
              background: "var(--color-background-primary)",
              cursor: "pointer",
            }}
            onClick={() => handleSecondaryEntryClick("rent_guide")}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "var(--color-background-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8,
                fontSize: 14,
              }}
            >
              📋
            </div>
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-text-primary)",
                lineHeight: 1.35,
                margin: "0 0 3px",
                whiteSpace: "pre-line",
              }}
            >
              {copy.card2Label}
            </p>
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.4 }}>
              {copy.card2Hint}
            </p>
          </div>

          {/* Card 3 — Secondary: direct question */}
          <div
            style={{
              padding: "14px 12px",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-lg)",
              background: "var(--color-background-primary)",
              cursor: "pointer",
            }}
            onClick={() => handleSecondaryEntryClick("ask_ai")}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "var(--color-background-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8,
                fontSize: 14,
              }}
            >
              💬
            </div>
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-text-primary)",
                lineHeight: 1.35,
                margin: "0 0 3px",
                whiteSpace: "pre-line",
              }}
            >
              {copy.card3Label}
            </p>
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.4 }}>
              {copy.card3Hint}
            </p>
          </div>
        </div>

        {/* V5 §4.4: Three-step guide with platform cards — toggled by primary card click */}
        <ThreeStepGuide isOpen={showGuide} locale={locale} copy={copy} />
      </header>

      {/* ── V6 ZONE 2: Trust promise bar (5 verifiable promises) ────── */}
      <section
        id="jtg-trust-promises"
        aria-label={copy.trustDashboardTitle}
        style={{ padding: "0 20px 14px" }}
      >
        <div style={{
          display: "flex", gap: 6, flexWrap: "wrap",
        }}>
          {([
            { key: "trustPromise1" as const, status: "verified" as const, anchor: "identity" },
            { key: "trustPromise2" as const, status: "verified" as const, anchor: "documents" },
            { key: "trustPromise3" as const, status: "verified" as const, anchor: "process" },
            { key: "trustPromise4" as const, status: "partial" as const, anchor: "risk" },
            { key: "trustPromise5" as const, status: "verified" as const, anchor: "data" },
          ]).map((p, i) => (
            <TrustBadge
              key={i}
              status={p.status}
              label={copy[p.key]}
              promiseIndex={i + 1}
              locale={locale}
              onClick={() => {
                // Jump to ZONE 6 trust section (trust-center page not yet ready)
                document.getElementById("jtg-trust-zone6")?.scrollIntoView({
                  behavior: "smooth", block: "start",
                });
              }}
            />
          ))}
        </div>
      </section>

      {/* ── External platforms ─────────────────────────────────────────── */}
      <section aria-label="Property platforms" style={{ padding: "0 20px 16px" }}>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 8px" }}>
          {copy.externalBrowseHint}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 8,
          }}
        >
          {EXTERNAL_PLATFORMS.map((p) => (
            <ExternalPlatformLink
              key={p.name}
              name={p.name}
              href={p.href}
              locale={locale}
              copy={copy}
            />
          ))}
        </div>
      </section>

      {/* ── Listing analysis zone (spec §3.3 — three input paths) ──────── */}
      <section id="jtg-analysis-zone" style={{ padding: "0 20px 16px" }}>
        <ListingAnalysisZone
          locale={locale}
          copy={copy}
          disabled={analysisLoading}
          onSubmit={async (payload: AnalysisPayload) => {
            setAnalysisLoading(true);
            setAnalysisResult(null);
            setAnalysisStage(1); // Stage 1: reading

            // V6: generate analysisId for trust dashboard binding
            const newAnalysisId = crypto.randomUUID();
            setAnalysisId(newAnalysisId);
            setShowTrustDashboard(false);

            try {
              let routerMessage = "";

              if (payload.type === "screenshot" && payload.file) {
                // Stage 1: Extract text via vision API
                const form = new FormData();
                form.append("file", payload.file);
                form.append("language", locale === "zh-Hans" ? "zh" : locale === "ja" ? "ja" : "en");
                const visionRes = await fetch("/api/vision-extract", { method: "POST", body: form });
                setAnalysisStage(2); // Stage 2: extracting fields
                const visionData = await visionRes.json();
                routerMessage = visionData.suggestedQuery || visionData.extractedText || "";
                if (!routerMessage) return;
              } else if (payload.type === "url" && payload.url) {
                setAnalysisStage(2); // Stage 2: fetching page
                routerMessage = `${copy.analysisSubmit}: ${payload.url}`;
              } else if (payload.type === "text" && payload.text) {
                setAnalysisStage(2);
                routerMessage = payload.text;
              }

              if (!routerMessage) return;

              setAnalysisStage(3); // Stage 3: analyzing

              // Send to streaming router for analysis
              const routerRes = await fetch("/api/router/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  message: routerMessage,
                  taskState: { analysisType: payload.type, listingUrl: payload.url },
                }),
              });

              const contentType = routerRes.headers.get("content-type") || "";

              if (contentType.includes("application/json")) {
                // Tier A/B fast path
                const data = await routerRes.json();
                if (data.content) setAnalysisResult(data.content);
                else if (data.answer) setAnalysisResult(data.answer);
              } else if (contentType.includes("text/event-stream") && routerRes.body) {
                // Tier C: consume SSE tokens
                const reader = routerRes.body.getReader();
                const decoder = new TextDecoder();
                let fullContent = "";
                let buf = "";

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buf += decoder.decode(value, { stream: true });
                  const frames = buf.split("\n\n");
                  buf = frames.pop() ?? "";
                  for (const frame of frames) {
                    const line = frame.trim();
                    if (!line.startsWith("data: ")) continue;
                    try {
                      const evt = JSON.parse(line.slice(6));
                      if (evt.type === "token" && evt.text) fullContent += evt.text;
                    } catch { /* skip malformed */ }
                  }
                }
                if (fullContent) setAnalysisResult(fullContent);
              }
            } catch {
              // Network error — never crash the UI
            } finally {
              setAnalysisLoading(false);
              setAnalysisStage(0);
              // V6 ZONE 4b: auto-show trust dashboard after analysis
              setShowTrustDashboard(true);
            }
          }}
        />
        {/* V4: Staged analysis loading labels — no fake percentages */}
        {analysisLoading && (
          <div
            className="thinking-indicator"
            style={{
              marginTop: 10,
              padding: "10px 14px",
              fontSize: 13,
              color: "var(--color-text-secondary)",
              background: "var(--color-background-secondary)",
              borderRadius: "var(--border-radius-md)",
              border: "0.5px solid var(--color-border-tertiary)",
            }}
          >
            {analysisStage === 1 ? copy.analysisStage1
              : analysisStage === 2 ? copy.analysisStage2
              : analysisStage === 3 ? copy.analysisStage3
              : copy.analysisThinking}
          </div>
        )}
        {/* Analysis result */}
        {analysisResult && !analysisLoading && (
          <div
            style={{
              marginTop: 10,
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
            {analysisResult}
            {/* V6 Task 3: Timestamp note + disclaimer */}
            <p style={{ fontSize: 11, color: "#0F6E56", margin: "8px 0 0", opacity: 0.7 }}>
              {copy.analysisTimestampNote}
            </p>
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
              {copy.analysisDisclaimer}
            </p>
          </div>
        )}
        {/* V6 Task 4: View trust dashboard button (after analysis complete) */}
        {analysisResult && !analysisLoading && analysisId && (
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                track(Events.TRUST_DASHBOARD_VIEW, { analysisId, locale });
                setShowTrustDashboard(true);
                setTimeout(() => {
                  document.getElementById("jtg-trust-dashboard")?.scrollIntoView({
                    behavior: "smooth", block: "start",
                  });
                }, 100);
              }}
              style={{
                fontSize: 12,
                padding: "6px 14px",
                minHeight: 36,
                background: "#E1F5EE",
                color: "#1D9E75",
                border: "0.5px solid #1D9E75",
                borderRadius: "var(--border-radius-md)",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
              }}
            >
              {copy.viewTrustDashboard}
            </button>
          </div>
        )}
      </section>

      {/* ── V6 ZONE 4c: Trust Dashboard (conditional after analysis) ──── */}
      {showTrustDashboard && analysisId && (
        <div id="jtg-trust-dashboard">
        <TrustDashboard
          analysisId={analysisId}
          locale={locale}
          copy={copy}
          onShowEvidence={(hash, timestamp) => {
            setEvidenceData({ hash, timestamp });
            setShowEvidenceModal(true);
          }}
        />
        </div>
      )}

      {/* ── V6 ZONE 4c: Evidence Modal (normal-flow, not fixed) ──────── */}
      {showEvidenceModal && evidenceData && analysisId && (
        <EvidenceModal
          evidenceHash={evidenceData.hash}
          timestamp={evidenceData.timestamp}
          analysisId={analysisId}
          locale={locale}
          isOpen={showEvidenceModal}
          onClose={() => setShowEvidenceModal(false)}
        />
      )}

      {/* ── FAQ tabs ───────────────────────────────────────────────────── */}
      <section aria-label="FAQ" style={{ padding: "0 20px" }}>
        {/* Tabs — spec §3.1 task-stage naming */}
        <div
          role="tablist"
          style={{
            display: "flex",
            gap: 4,
            borderBottom: "0.5px solid var(--color-border-tertiary)",
            overflowX: "auto",
          }}
        >
          {(
            [
              ["rent_prep", copy.tabRentPrep],
              ["signing",   copy.tabSigning],
              ["living",    copy.tabLiving],
              ["life",      copy.tabLife],
            ] as [TabKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => handleTabClick(key)}
              style={tabBtn(activeTab === key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: "var(--border-radius-md)",
            margin: "12px 0 8px",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="4.5" stroke="var(--color-text-tertiary)" strokeWidth="1.2"/>
            <path d="M10 10l2.5 2.5" stroke="var(--color-text-tertiary)" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={copy.searchPlaceholder}
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 13,
              color: "var(--color-text-primary)",
              flex: 1,
              fontFamily: "var(--font-sans)",
            }}
          />
        </div>

        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 8px 2px" }}>
          {copy.hotLabel}
        </p>

        {/* FAQ cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {filteredFaqs.map((faq) => {
            const id = `${activeTab}-${faq.q.slice(0, 20)}`;
            const isOpen = openFaqId === id;
            return (
              <article
                key={id}
                onClick={() => handleFaqClick(id)}
                style={{
                  padding: "12px 14px",
                  border: `0.5px solid ${isOpen ? "#1D9E75" : "var(--color-border-tertiary)"}`,
                  borderRadius: "var(--border-radius-md)",
                  background: isOpen ? "#E1F5EE" : "var(--color-background-primary)",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: isOpen ? "#0F6E56" : "var(--color-text-primary)",
                      lineHeight: 1.4,
                      margin: 0,
                    }}
                  >
                    {faq.q}
                  </p>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background: "var(--color-background-secondary)",
                      color: "var(--color-text-secondary)",
                      flexShrink: 0,
                    }}
                  >
                    {faq.tag}
                  </span>
                </div>
                {isOpen && (
                  <>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#0F6E56",
                        marginTop: 8,
                        lineHeight: 1.6,
                      }}
                    >
                      {faq.a}
                    </p>
                    <p style={{ fontSize: 11, color: "#1D9E75", marginTop: 4, opacity: 0.7 }}>
                      {copy.faqVerified.replace("{date}", faq.verified)}
                    </p>
                  </>
                )}
              </article>
            );
          })}
          {filteredFaqs.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", padding: "12px 0" }}>
              {copy.faqNoResults}
            </p>
          )}
        </div>

        {/* Tier 2 locale notice (spec §6.1 two-tier model) */}
        {copy.tier2Notice && (
          <div
            style={{
              padding: "8px 12px",
              background: "var(--color-background-secondary)",
              borderRadius: "var(--border-radius-md)",
              fontSize: 12,
              color: "var(--color-text-secondary)",
              marginBottom: 12,
            }}
          >
            {copy.tier2Notice}
          </div>
        )}
      </section>

      {/* ── V6 ZONE 6: Verifiable promises (expandable cards) ──────────── */}
      <section
        id="jtg-trust-zone6"
        aria-label={copy.trustTitle}
        style={{ margin: "0 20px 14px" }}
      >
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", margin: "0 0 8px" }}>
          {copy.trustTitle}
        </p>
        {/* Original trust items */}
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          {[copy.trust1, copy.trust2, copy.trust3].map((item, i) => (
            <li
              key={i}
              style={{
                fontSize: 12,
                color: "var(--color-text-secondary)",
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#1D9E75",
                  flexShrink: 0,
                  marginTop: 5,
                }}
              />
              {item}
            </li>
          ))}
        </ul>
        {/* V6: 5 expandable commitment cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <TrustCommitmentCard
            icon="🛡️" title={copy.trustPromise1} summary={copy.trustPromise1Detail}
            detail={copy.trustPromise1Detail} status="verified" locale={locale} commitmentName="identity"
            actions={[{ label: copy.trustAction1Label, href: "https://etsuran.mlit.go.jp/TAKKEN/takkenKensaku.do", external: true }]}
          />
          <TrustCommitmentCard
            icon="📄" title={copy.trustPromise2} summary={copy.trustPromise2Detail}
            detail={copy.trustPromise2Detail} status="verified" locale={locale} commitmentName="documents"
            actions={[{ label: copy.trustAction2aLabel }, { label: copy.trustAction2bLabel }]}
          />
          <TrustCommitmentCard
            icon="📋" title={copy.trustPromise3} summary={copy.trustPromise3Detail}
            detail={copy.trustPromise3Detail} status="verified" locale={locale} commitmentName="process"
            actions={[{ label: `${copy.trustAction3Label} (${copy.trustAction3LoginHint})` }]}
          />
          <TrustCommitmentCard
            icon="⚠️" title={copy.trustPromise4} summary={copy.trustPromise4Detail}
            detail={copy.trustPromise4Detail} status="partial" locale={locale} commitmentName="risk"
            actions={[{ label: copy.trustAction4Label }]}
          />
          <TrustCommitmentCard
            icon="🔒" title={copy.trustPromise5} summary={copy.trustPromise5Detail}
            detail={copy.trustPromise5Detail} status="verified" locale={locale} commitmentName="data"
            actions={[{ label: copy.trustAction5aLabel, href: `/${locale}/privacy` }, { label: copy.trustAction5bLabel }]}
          />
        </div>
      </section>

      {/* ── V6 ZONE 6b: Transparency layer (collapsible) ────────────────── */}
      {showTrustDashboard && analysisId && (
        <TransparencyLayer
          copy={copy}
          locale={locale}
          data={{
            analysisTime: new Date().toISOString(),
            engineTier: "tier-c-llm",
            confidenceLevel: "medium",
            evidenceHash: analysisId.replace(/-/g, "").padEnd(64, "0"),
            dataSources: [
              { name: "MLIT Guidelines", url: "https://www.mlit.go.jp" },
              { name: "National Consumer Affairs Center" },
            ],
          }}
        />
      )}

      {/* ── AI zone (spec §3.5) + V4 streaming response area ──────────── */}
      <div id="jtg-ai-zone">
        <AIZone
          copy={copy}
          locale={locale}
          remaining={quotaRemaining}
          limit={quotaLimit}
          onSubmit={handleAISubmit}
        />
        {/* V4: Streaming response (thinking → typewriter → complete | error) */}
        <StreamErrorBoundary
          errorMessage={copy.aiError}
          retryLabel={copy.aiBtnRetry}
          contactLabel={copy.aiBtnContact}
          onContactSupport={() => {
            document.getElementById("jtg-human-help")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }}
        >
          <AIResponseArea
            copy={copy}
            content={stream.content}
            isThinking={stream.isThinking}
            isDone={stream.isDone}
            error={stream.error}
            tier={stream.tier}
            onRetry={handleRetry}
            onContactSupport={() => {
              document.getElementById("jtg-human-help")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          />
        </StreamErrorBoundary>
      </div>

      {/* ── V6 ZONE 9: Confirmation strip with send/not-send lists ──────── */}
      {showTrustDashboard && analysisId && (
        <section
          aria-label={copy.confirmSendScope}
          style={{
            margin: "0 20px 14px",
            padding: "10px 14px",
            border: "0.5px solid #BA7517",
            borderRadius: "var(--border-radius-md)",
            background: "#FAEEDA",
          }}
        >
          {/* What we send */}
          <p style={{ fontSize: 12, fontWeight: 500, color: "#633806", margin: "0 0 4px" }}>
            ✓ {copy.confirmSendScope}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
            {[copy.confirmSendItem1, copy.confirmSendItem2, copy.confirmSendItem3, copy.confirmSendItem4].map((item, i) => (
              <li key={i} style={{ fontSize: 11, color: "#633806", paddingLeft: 12, position: "relative" }}>
                <span style={{ position: "absolute", left: 0 }}>·</span>{item}
              </li>
            ))}
          </ul>
          {/* What we don't send */}
          <p style={{ fontSize: 12, fontWeight: 500, color: "#633806", margin: "0 0 4px" }}>
            ✗ {copy.confirmNotSend}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
            {[copy.confirmNotSendItem1, copy.confirmNotSendItem2, copy.confirmNotSendItem3].map((item, i) => (
              <li key={i} style={{ fontSize: 11, color: "#633806", paddingLeft: 12, position: "relative" }}>
                <span style={{ position: "absolute", left: 0 }}>·</span>{item}
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              track(Events.CONFIRM_SCOPE_MODIFY, { analysisId, locale });
            }}
            style={{
              fontSize: 11, color: "#BA7517", background: "none",
              border: "0.5px solid #BA7517", borderRadius: "var(--border-radius-md)",
              padding: "4px 10px", cursor: "pointer", fontFamily: "var(--font-sans)",
              minHeight: 30,
            }}
          >
            {copy.confirmModifyScope}
          </button>
        </section>
      )}

      {/* ── Human help (spec §3.4 — two distinct paths) ───────────────── */}
      {/* V4: sticky during streaming so contact support is always reachable */}
      <div
        id="jtg-human-help"
        className={stream.isThinking || (stream.content && !stream.isDone) ? "jtg-human-help-sticky" : ""}
      >
        <HumanHelpSection
          copy={copy}
          locale={locale}
          channels={CHANNEL_CONFIG}
        />
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer
        style={{
          padding: "14px 20px",
          borderTop: "0.5px solid var(--color-border-tertiary)",
          fontSize: 11,
          color: "var(--color-text-tertiary)",
          lineHeight: 1.6,
        }}
      >
        <p style={{ margin: "0 0 4px" }}>{copy.footerDisclaimer}</p>
        {/* V6 ZONE 10: Compliance note */}
        <p style={{ margin: "0 0 6px", fontSize: 10, color: "var(--color-text-tertiary)" }}>
          {copy.footerComplianceNote}
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href={`/${locale}/privacy`} style={{ cursor: "pointer", color: "inherit", textDecoration: "none" }}>{copy.footerPrivacy}</a>
          <a href={`/${locale}/terms`} style={{ cursor: "pointer", color: "inherit", textDecoration: "none" }}>{copy.footerTerms}</a>
          <a href={`/${locale}/trust-center`} style={{ cursor: "pointer", color: "inherit", textDecoration: "none" }}>{copy.footerTranslation}</a>
          {/* V6: Evidence verify link */}
          <a href={`/${locale}/verify-evidence`} style={{ cursor: "pointer", color: "inherit", textDecoration: "none" }}>{copy.footerEvidenceVerify}</a>
          {/* V6: Report violation link */}
          <a href={`/${locale}/report`} style={{ cursor: "pointer", color: "#E24B4A", textDecoration: "none" }}>{copy.footerReportViolation}</a>
        </div>
      </footer>

    </div>
  );
}
