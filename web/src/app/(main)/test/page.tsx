"use client";

import { useState, useRef, useCallback } from "react";
import { useStreamQuery } from "@/hooks/useStreamQuery";

/* ── Sample queries for quick testing ───────────────────────────── */

const SAMPLE_QUERIES = [
  { label: "Tier A (敷金)", q: "敷金はいくらですか", tier: "A" },
  { label: "Tier A (deposit)", q: "How much is the deposit?", tier: "A" },
  { label: "Tier B (procedure)", q: "How do I rent an apartment in Tokyo?", tier: "B" },
  { label: "Tier C (LLM)", q: "What are the cultural differences between Japanese and Western rental practices?", tier: "C" },
  { label: "High Risk", q: "My landlord is threatening to deport me", tier: "L6" },
  { label: "Chinese", q: "在日本租房需要什么手续？", tier: "B" },
  { label: "Japanese", q: "家賃の相場はどのくらいですか？", tier: "A/B" },
];

/* ── Debug panel for response metadata ──────────────────────────── */

function DebugPanel({
  tier,
  latencyMs,
  isDone,
  isThinking,
  error,
  contentLength,
  sourcesCount,
}: {
  tier: string | null;
  latencyMs: number | null;
  isDone: boolean;
  isThinking: boolean;
  error: string | null;
  contentLength: number;
  sourcesCount: number;
}) {
  const tierColor: Record<string, string> = {
    A: "#22c55e",
    B: "#3b82f6",
    C: "#f59e0b",
    L6: "#ef4444",
    CACHE: "#8b5cf6",
  };

  return (
    <div
      style={{
        background: "#1a1a2e",
        border: "1px solid #333",
        borderRadius: 8,
        padding: 16,
        fontFamily: "monospace",
        fontSize: 13,
        color: "#e0e0e0",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8, color: "#60a5fa" }}>
        Debug Panel
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px" }}>
        <div>
          Tier:{" "}
          <span style={{ color: tier ? tierColor[tier] ?? "#fff" : "#666", fontWeight: 700 }}>
            {tier ?? "—"}
          </span>
        </div>
        <div>
          Latency:{" "}
          <span style={{ color: latencyMs != null && latencyMs < 100 ? "#22c55e" : "#f59e0b" }}>
            {latencyMs != null ? `${latencyMs}ms` : "—"}
          </span>
        </div>
        <div>
          Status:{" "}
          <span
            style={{
              color: error ? "#ef4444" : isDone ? "#22c55e" : isThinking ? "#f59e0b" : "#666",
            }}
          >
            {error ? "ERROR" : isDone ? "DONE" : isThinking ? "THINKING..." : "IDLE"}
          </span>
        </div>
        <div>
          Content: <span>{contentLength} chars</span>
        </div>
        <div>
          Sources: <span>{sourcesCount}</span>
        </div>
        <div>
          KB Hit:{" "}
          <span style={{ color: tier === "A" || tier === "B" ? "#22c55e" : "#666" }}>
            {tier === "A" || tier === "B" ? "YES" : tier ? "NO" : "—"}
          </span>
        </div>
      </div>
      {error && (
        <div style={{ marginTop: 8, color: "#ef4444", fontSize: 12 }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}

/* ── History log ────────────────────────────────────────────────── */

interface HistoryEntry {
  id: number;
  query: string;
  tier: string | null;
  latencyMs: number;
  contentPreview: string;
  timestamp: string;
  error: string | null;
}

function HistoryLog({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>
        Query History
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {entries.map((e) => (
          <div
            key={e.id}
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 13,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ color: "#475569" }}>{e.query.slice(0, 60)}{e.query.length > 60 ? "..." : ""}</span>
            </div>
            <div style={{ display: "flex", gap: 12, flexShrink: 0, fontSize: 12, fontFamily: "monospace" }}>
              <span
                style={{
                  background: e.error ? "#fef2f2" : e.tier === "A" || e.tier === "B" ? "#f0fdf4" : "#fffbeb",
                  color: e.error ? "#dc2626" : e.tier === "A" || e.tier === "B" ? "#16a34a" : "#d97706",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                {e.error ? "ERR" : e.tier ?? "?"}
              </span>
              <span style={{ color: "#64748b" }}>{e.latencyMs}ms</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────── */

export default function TestPage() {
  const { content, isThinking, isDone, error, tier, sources, query, reset } =
    useStreamQuery();

  const [inputText, setInputText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [queryStart, setQueryStart] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const idCounter = useRef(0);

  // Track latency when response completes
  const prevDone = useRef(false);
  if (isDone && !prevDone.current && queryStart != null) {
    const elapsed = Date.now() - queryStart;
    if (latencyMs === null) {
      setLatencyMs(elapsed);
      setHistory((prev) => [
        {
          id: ++idCounter.current,
          query: inputText || "(unknown)",
          tier,
          latencyMs: elapsed,
          contentPreview: content.slice(0, 80),
          timestamp: new Date().toISOString(),
          error,
        },
        ...prev,
      ]);
    }
  }
  prevDone.current = isDone;

  const handleSubmit = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      reset();
      setLatencyMs(null);
      setQueryStart(Date.now());
      prevDone.current = false;
      query(text);
    },
    [query, reset]
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(inputText);
  };

  const handleSample = (q: string) => {
    setInputText(q);
    handleSubmit(q);
  };

  return (
    <div
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "40px 20px",
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
          JTG Test Console
        </h1>
        <p style={{ fontSize: 14, color: "#64748b" }}>
          Query the router, inspect tier routing, timing, and evidence fields.
        </p>
      </div>

      {/* Sample queries */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>
          QUICK TEST
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SAMPLE_QUERIES.map((s) => (
            <button
              key={s.q}
              onClick={() => handleSample(s.q)}
              disabled={isThinking}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                background: isThinking ? "#f1f5f9" : "#fff",
                color: isThinking ? "#94a3b8" : "#475569",
                cursor: isThinking ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontWeight: 600 }}>{s.label}</span>
              <span style={{ color: "#94a3b8", marginLeft: 4 }}>({s.tier})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input form */}
      <form onSubmit={handleFormSubmit} style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a query to test routing..."
            disabled={isThinking}
            style={{
              flex: 1,
              padding: "10px 14px",
              fontSize: 15,
              borderRadius: 8,
              border: "1px solid #d1d5db",
              outline: "none",
              background: "#fff",
            }}
          />
          <button
            type="submit"
            disabled={isThinking || !inputText.trim()}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              border: "none",
              background: isThinking ? "#94a3b8" : "#2563eb",
              color: "#fff",
              cursor: isThinking ? "not-allowed" : "pointer",
            }}
          >
            {isThinking ? "..." : "Send"}
          </button>
          {(isDone || error) && (
            <button
              type="button"
              onClick={() => {
                reset();
                setLatencyMs(null);
                setQueryStart(null);
              }}
              style={{
                padding: "10px 14px",
                fontSize: 14,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#475569",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Debug panel */}
      <DebugPanel
        tier={tier}
        latencyMs={latencyMs}
        isDone={isDone}
        isThinking={isThinking}
        error={error}
        contentLength={content.length}
        sourcesCount={sources.length}
      />

      {/* Response content */}
      {(content || isThinking) && (
        <div
          style={{
            marginTop: 20,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>
            RESPONSE
          </div>
          {isThinking && !content && (
            <div style={{ color: "#f59e0b", fontSize: 14 }}>Thinking...</div>
          )}
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "#1e293b",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {content}
            {isThinking && content && (
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 16,
                  background: "#2563eb",
                  marginLeft: 2,
                  animation: "blink 1s step-end infinite",
                }}
              />
            )}
          </div>

          {/* Sources */}
          {sources.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
                SOURCES ({sources.length})
              </div>
              {sources.map((s) => (
                <div key={s.id} style={{ fontSize: 13, color: "#64748b", marginBottom: 2 }}>
                  <span style={{ color: "#475569", fontWeight: 500 }}>{s.title}</span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: "#94a3b8" }}>
                    [{s.type}] {s.id}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {error && !content && (
        <div
          style={{
            marginTop: 20,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 16,
            color: "#dc2626",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* History */}
      <HistoryLog entries={history} />

      {/* Blink animation */}
      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
