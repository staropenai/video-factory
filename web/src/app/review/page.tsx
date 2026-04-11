"use client";

/**
 * Internal review page — staging-only operator view.
 *
 * Shows: aggregate counts, recent log, handoff queue, content coverage,
 * and lets staff write back a resolution to a handoff.
 *
 * [KNOWN LIMITATION] Backed by an in-memory buffer. Cold starts wipe state.
 * This is intentional Phase 1 — see KNOWN_LIMITATIONS.md.
 */

import { useEffect, useState } from "react";

type RouterLogEntry = {
  timestamp: string;
  queryText: string;
  detectedLanguage: "en" | "zh" | "ja";
  answerMode: string;
  riskLevel: string;
  confidenceBand: string;
  knowledgeFound: boolean;
  topFaqId: string | null;
  topFaqCategory: string | null;
  topScore: number;
};

type HandoffEntry = {
  id: string;
  timestamp: string;
  queryText: string;
  detectedLanguage: "en" | "zh" | "ja";
  answerMode: string;
  riskLevel: string;
  reason: string;
  status: "open" | "in_progress" | "resolved";
  humanReply?: string;
  resolution?: string;
  resolvedAt?: string;
};

type Stats = {
  total: number;
  byMode: Record<string, number>;
  byLang: Record<string, number>;
  byCategory: Record<string, number>;
  topFaqs: [string, number][];
  noMatchCount: number;
  noMatchSample: string[];
  highRiskCount: number;
  highRiskSample: string[];
  openHandoffs: number;
  totalHandoffs: number;
};

type ReviewResponse = {
  ok: boolean;
  stats: Stats;
  recentLog: RouterLogEntry[];
  handoffs: HandoffEntry[];
  content: {
    live: Record<string, number>;
    stub: Record<string, number>;
  };
};

export default function ReviewPage() {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review/stats", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to load");
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function resolve(
    id: string,
    humanReply: string,
    resolution: string,
    createFaqCandidate: boolean,
  ) {
    await fetch("/api/handoff/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id,
        humanReply,
        resolution,
        resolvedBy: "staff",
        createFaqCandidate,
      }),
    });
    await load();
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-2xl font-semibold">Internal review</h1>
        <button
          onClick={load}
          className="text-sm underline underline-offset-4 hover:opacity-70"
        >
          Refresh
        </button>
      </div>

      <p className="text-sm text-muted mb-8">
        Staging-only operator view. Buffer is in-process and resets on cold
        starts — treat as recent activity, not an audit log.
      </p>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-medium mb-3">Snapshot</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Card label="Total queries" value={data.stats.total} />
              <Card label="No knowledge match" value={data.stats.noMatchCount} />
              <Card label="High-risk routes" value={data.stats.highRiskCount} />
              <Card label="Open handoffs" value={data.stats.openHandoffs} />
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <BreakdownCard title="By answer mode" rows={data.stats.byMode} />
            <BreakdownCard title="By language" rows={data.stats.byLang} />
            <BreakdownCard title="By category" rows={data.stats.byCategory} />
          </section>

          <section>
            <h2 className="text-lg font-medium mb-3">Top matched FAQs</h2>
            {data.stats.topFaqs.length === 0 ? (
              <p className="text-sm text-muted">No matches recorded yet.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {data.stats.topFaqs.map(([id, n]) => (
                  <li key={id} className="flex justify-between border-b border-border py-1">
                    <span className="font-mono">{id}</span>
                    <span className="text-muted">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-lg font-medium mb-3">Content coverage</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {(["renting", "home_buying", "visa", "daily_life"] as const).map((c) => (
                <div key={c} className="border border-border rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wider text-muted">{c}</p>
                  <p className="mt-2">
                    <span className="font-semibold">{data.content.live[c] ?? 0}</span>
                    <span className="text-muted"> live</span>
                  </p>
                  <p className="text-muted text-xs">
                    + {data.content.stub[c] ?? 0} stubs
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-medium mb-3">Handoff queue</h2>
            {data.handoffs.length === 0 ? (
              <p className="text-sm text-muted">No handoffs queued.</p>
            ) : (
              <ul className="space-y-4">
                {data.handoffs.map((h) => (
                  <HandoffRow key={h.id} entry={h} onResolve={resolve} />
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-lg font-medium mb-3">No-knowledge sample</h2>
            {data.stats.noMatchSample.length === 0 ? (
              <p className="text-sm text-muted">All recent queries hit at least one FAQ.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {data.stats.noMatchSample.map((q, i) => (
                  <li key={i} className="border-b border-border py-1">
                    {q}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-lg font-medium mb-3">Recent activity</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="py-2 pr-3">time</th>
                    <th className="py-2 pr-3">lang</th>
                    <th className="py-2 pr-3">mode</th>
                    <th className="py-2 pr-3">risk</th>
                    <th className="py-2 pr-3">faq</th>
                    <th className="py-2">query</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentLog.map((e, i) => (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="py-1 pr-3 whitespace-nowrap font-mono">
                        {e.timestamp.slice(11, 19)}
                      </td>
                      <td className="py-1 pr-3">{e.detectedLanguage}</td>
                      <td className="py-1 pr-3">{e.answerMode}</td>
                      <td className="py-1 pr-3">{e.riskLevel}</td>
                      <td className="py-1 pr-3 font-mono">{e.topFaqId ?? "—"}</td>
                      <td className="py-1">{e.queryText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-xl p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: Record<string, number> }) {
  const entries = Object.entries(rows).sort((a, b) => b[1] - a[1]);
  return (
    <div className="border border-border rounded-xl p-4">
      <p className="text-xs uppercase tracking-wider text-muted mb-2">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">—</p>
      ) : (
        <ul className="text-sm space-y-1">
          {entries.map(([k, v]) => (
            <li key={k} className="flex justify-between">
              <span>{k}</span>
              <span className="text-muted">{v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HandoffRow({
  entry,
  onResolve,
}: {
  entry: HandoffEntry;
  onResolve: (
    id: string,
    humanReply: string,
    resolution: string,
    createFaqCandidate: boolean,
  ) => void;
}) {
  const [humanReply, setHumanReply] = useState(entry.humanReply ?? "");
  const [resolution, setResolution] = useState(entry.resolution ?? "");
  const [createFaqCandidate, setCreateFaqCandidate] = useState(false);
  const [open, setOpen] = useState(entry.status !== "resolved");

  return (
    <li className="border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {entry.timestamp.slice(0, 19).replace("T", " ")} · {entry.detectedLanguage} · {entry.answerMode} · {entry.riskLevel}
          </p>
          <p className="text-body-lg mt-1 whitespace-pre-line">{entry.queryText}</p>
          <p className="text-xs text-muted mt-1">{entry.reason}</p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
            entry.status === "resolved"
              ? "bg-foreground/10 text-muted"
              : "bg-foreground text-surface"
          }`}
        >
          {entry.status}
        </span>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <textarea
            value={humanReply}
            onChange={(e) => setHumanReply(e.target.value)}
            placeholder="Human reply (what we told the user, in their language)"
            rows={3}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface"
          />
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Resolution / FAQ candidate / next action"
            rows={2}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface"
          />
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={createFaqCandidate}
              onChange={(e) => setCreateFaqCandidate(e.target.checked)}
            />
            Create FAQ candidate from this reply
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => {
                onResolve(entry.id, humanReply, resolution, createFaqCandidate);
                setOpen(false);
              }}
              disabled={!humanReply.trim()}
              className="text-sm px-4 py-2 bg-foreground text-surface rounded-full disabled:opacity-40"
            >
              Mark resolved
            </button>
            {entry.status === "resolved" && (
              <button
                onClick={() => setOpen(false)}
                className="text-sm px-4 py-2 underline underline-offset-4"
              >
                Collapse
              </button>
            )}
          </div>
        </div>
      )}

      {!open && entry.status === "resolved" && entry.humanReply && (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 text-xs underline underline-offset-4 text-muted"
        >
          Show writeback
        </button>
      )}
    </li>
  );
}
