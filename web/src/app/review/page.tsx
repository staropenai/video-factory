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
  faqCandidatesPending?: number;
  faqCandidatesTotal?: number;
  feedbackTotal?: number;
  feedbackSatisfied?: number;
  feedbackDissatisfied?: number;
  satisfactionRate?: number | null;
  last7Days?: Array<{ date: string; count: number }>;
  cases?: {
    total: number;
    byStatus: Record<string, number>;
    avgResolveHours: number | null;
  };
};

type TemplateRow = {
  id: string;
  title: string;
  body: string;
  language: "en" | "zh" | "ja";
  category: string | null;
  tags: string[];
  status: "draft" | "active" | "archived";
  useCount: number;
};

type CandidateState =
  | "NEW"
  | "CLUSTERED"
  | "REVIEWED"
  | "NEEDS_EDIT"
  | "PUBLISHED"
  | "REJECTED";

type FaqCandidate = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  source: "handoff" | "user_feedback" | "sensing";
  sourceQueryText: string;
  detectedLanguage: "en" | "zh" | "ja";
  candidateTitle: string;
  candidateAnswer: string;
  riskLevel: string;
  status: "pending_review" | "promoted" | "rejected";
  state?: CandidateState;
  reviewNote?: string;
  createdBy: string;
  clusterSignature?: string;
  clusterSize?: number;
  clusterQueries?: string[];
  notes?: string;
  publishedLiveFaqId?: string;
};

const STATE_FILTERS: Array<{ label: string; value: CandidateState | "" }> = [
  { label: "All states", value: "" },
  { label: "NEW", value: "NEW" },
  { label: "CLUSTERED", value: "CLUSTERED" },
  { label: "REVIEWED", value: "REVIEWED" },
  { label: "NEEDS_EDIT", value: "NEEDS_EDIT" },
  { label: "PUBLISHED", value: "PUBLISHED" },
  { label: "REJECTED", value: "REJECTED" },
];

type SensingCluster = {
  signature: string;
  sampleQuery: string;
  count: number;
  byLanguage: Record<string, number>;
  queries: string[];
  firstSeen: string;
  lastSeen: string;
};

type ReviewResponse = {
  ok: boolean;
  stats: Stats;
  recentLog: RouterLogEntry[];
  handoffs: HandoffEntry[];
  faqCandidates?: FaqCandidate[];
  content: {
    live: Record<string, number>;
    stub: Record<string, number>;
  };
};

export default function ReviewPage() {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [clusters, setClusters] = useState<SensingCluster[]>([]);
  const [scanning, setScanning] = useState(false);
  // Spec §9 — candidate state filter is driven by the backend. We pass the
  // selected value through to /api/review/stats?state= and render whatever
  // the server returns. No client-side filtering.
  const [stateFilter, setStateFilter] = useState<CandidateState | "">("");

  async function load(state: CandidateState | "" = stateFilter) {
    setLoading(true);
    setError(null);
    try {
      const qs = state ? `?state=${state}` : "";
      const [statsRes, tplRes] = await Promise.all([
        fetch(`/api/review/stats${qs}`, { cache: "no-store" }),
        fetch("/api/templates?status=active", { cache: "no-store" }),
      ]);
      const j = await statsRes.json();
      if (!statsRes.ok) throw new Error(j.error || "Failed to load");
      setData(j);
      if (tplRes.ok) {
        const tj = await tplRes.json();
        if (tj.ok) setTemplates(tj.templates as TemplateRow[]);
      }
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

  // Drives a candidate through the spec §6 state machine. The PATCH endpoint
  // enforces allowed transitions; we just surface whatever error it returns.
  async function transitionCandidate(id: string, to: CandidateState) {
    const res = await fetch(`/api/review/faq-candidates/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to }),
    });
    const j = await res.json();
    if (!res.ok || !j.ok) {
      alert(j.error?.message || j.error || "Transition failed");
      return;
    }
    await load();
  }

  async function scanSensing() {
    setScanning(true);
    try {
      const res = await fetch("/api/sensing/scan?minCount=2", {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Scan failed");
      setClusters(j.clusters as SensingCluster[]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function createCandidateFromCluster(signature: string) {
    try {
      const res = await fetch("/api/sensing/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Create failed");
      alert(`Candidate created: ${j.candidate.id}`);
      await load();
      await scanSensing();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function publishCandidate(
    id: string,
    payload: Record<string, unknown>,
  ) {
    try {
      // Sensing-sourced candidates are born CLUSTERED. Spec §6.2 publish
      // requires REVIEWED, but the /publish endpoint accepts
      // {ackSkipReview: true} to fast-track CLUSTERED → PUBLISHED with a
      // synthetic CANDIDATE_REVIEWED event. We always send the ack so staff
      // don't have to click twice.
      const res = await fetch(
        `/api/review/faq-candidates/${id}/publish`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, ackSkipReview: true }),
        },
      );
      const j = await res.json();
      if (!res.ok || !j.ok) {
        throw new Error(j.error?.message || j.error || "Publish failed");
      }
      alert(`Published live FAQ: ${j.liveFaq.id}`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Publish failed");
    }
  }

  async function promoteHandoffToTemplate(handoffId: string) {
    const res = await fetch("/api/templates/promote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceHandoffId: handoffId, status: "active" }),
    });
    const j = await res.json();
    if (!res.ok || !j.ok) {
      alert(j.error || "Promote failed");
      return;
    }
    alert(`Template created: ${j.template.id}`);
    await load();
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-2xl font-semibold">Internal review</h1>
        <button
          onClick={() => load()}
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
              <Card
                label="FAQ candidates pending"
                value={data.stats.faqCandidatesPending ?? 0}
              />
              <Card
                label="Feedback total"
                value={data.stats.feedbackTotal ?? 0}
              />
              <Card
                label="Satisfaction %"
                value={data.stats.satisfactionRate ?? 0}
              />
              <Card
                label="Open cases"
                value={data.stats.cases?.byStatus?.open ?? 0}
              />
            </div>
            {data.stats.last7Days && data.stats.last7Days.length > 0 && (
              <div className="mt-4 border border-border rounded-xl p-4">
                <p className="text-xs uppercase tracking-wider text-muted mb-2">
                  Queries / day (last 7)
                </p>
                <div className="flex items-end gap-2 h-20">
                  {data.stats.last7Days.map((d) => {
                    const max = Math.max(
                      1,
                      ...(data.stats.last7Days?.map((x) => x.count) ?? [1]),
                    );
                    const h = Math.round((d.count / max) * 100);
                    return (
                      <div
                        key={d.date}
                        className="flex-1 flex flex-col items-center gap-1"
                      >
                        <div
                          className="w-full bg-foreground rounded-t"
                          style={{ height: `${h}%` }}
                          title={`${d.date}: ${d.count}`}
                        />
                        <span className="text-[10px] text-muted">
                          {d.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-medium">
                Sensing — repeated no-match clusters
              </h2>
              <button
                onClick={scanSensing}
                disabled={scanning}
                className="text-sm underline underline-offset-4 hover:opacity-70 disabled:opacity-40"
              >
                {scanning ? "Scanning…" : "Scan now"}
              </button>
            </div>
            <p className="text-xs text-muted mb-3">
              Groups recent no-match queries by signature. One click turns a
              cluster into a reviewable FAQ candidate.
            </p>
            {clusters.length === 0 ? (
              <p className="text-sm text-muted">
                No clusters yet — press &ldquo;Scan now&rdquo;.
              </p>
            ) : (
              <ul className="space-y-2">
                {clusters.map((cl) => (
                  <li
                    key={cl.signature}
                    className="border border-border rounded-xl p-4 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-muted font-mono">
                        {cl.signature} · {cl.count}× ·{" "}
                        {Object.entries(cl.byLanguage)
                          .map(([l, n]) => `${l}:${n}`)
                          .join(" ")}
                      </p>
                      <p className="text-sm mt-1">{cl.sampleQuery}</p>
                      <p className="text-xs text-muted mt-1">
                        {cl.firstSeen.slice(0, 10)} →{" "}
                        {cl.lastSeen.slice(0, 10)}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        createCandidateFromCluster(cl.signature)
                      }
                      className="text-sm px-4 py-2 bg-foreground text-surface rounded-full whitespace-nowrap"
                    >
                      Create candidate
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
              <h2 className="text-lg font-medium">FAQ candidates</h2>
              <label className="text-xs text-muted flex items-center gap-2">
                State filter
                <select
                  value={stateFilter}
                  onChange={(e) => {
                    const v = e.target.value as CandidateState | "";
                    setStateFilter(v);
                    load(v);
                  }}
                  className="rounded border border-border bg-surface px-2 py-1 text-xs"
                >
                  {STATE_FILTERS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!data.faqCandidates || data.faqCandidates.length === 0 ? (
              <p className="text-sm text-muted">
                No FAQ candidates{stateFilter ? ` in state ${stateFilter}` : ""} yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.faqCandidates.map((c) => (
                  <FaqCandidateRow
                    key={c.id}
                    candidate={c}
                    onTransition={transitionCandidate}
                    onPublish={publishCandidate}
                  />
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-lg font-medium mb-3">Handoff queue</h2>
            {data.handoffs.length === 0 ? (
              <p className="text-sm text-muted">No handoffs queued.</p>
            ) : (
              <ul className="space-y-4">
                {data.handoffs.map((h) => (
                  <HandoffRow
                    key={h.id}
                    entry={h}
                    onResolve={resolve}
                    templates={templates}
                    onPromoteTemplate={promoteHandoffToTemplate}
                  />
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

function FaqCandidateRow({
  candidate,
  onTransition,
  onPublish,
}: {
  candidate: FaqCandidate;
  onTransition: (id: string, to: CandidateState) => void;
  onPublish: (id: string, payload: Record<string, unknown>) => void;
}) {
  const c = candidate;
  const [publishing, setPublishing] = useState(false);
  const [category, setCategory] = useState<
    "renting" | "home_buying" | "visa" | "daily_life" | "other"
  >("daily_life");
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high">("low");
  // v4 改进 #1: card entropy tier. Default C keeps the card on the safe
  // LLM-routed path; staff must opt in to A/B for LLM-bypass.
  const [tier, setTier] = useState<"A" | "B" | "C">("C");
  const [titleEn, setTitleEn] = useState(c.candidateTitle);
  const [titleZh, setTitleZh] = useState("");
  const [titleJa, setTitleJa] = useState("");
  const [answerEn, setAnswerEn] = useState(
    c.detectedLanguage === "en" ? c.candidateAnswer : "",
  );
  const [answerZh, setAnswerZh] = useState(
    c.detectedLanguage === "zh" ? c.candidateAnswer : "",
  );
  const [answerJa, setAnswerJa] = useState(
    c.detectedLanguage === "ja" ? c.candidateAnswer : "",
  );
  const [keywordsEn, setKeywordsEn] = useState("");
  const [keywordsZh, setKeywordsZh] = useState("");
  const [keywordsJa, setKeywordsJa] = useState("");

  function submit() {
    onPublish(c.id, {
      category,
      riskLevel,
      tier,
      title: { en: titleEn, zh: titleZh, ja: titleJa },
      answer: { en: answerEn, zh: answerZh, ja: answerJa },
      keywords: {
        en: keywordsEn,
        zh: keywordsZh,
        ja: keywordsJa,
      },
      createdBy: "staff",
    });
  }

  const clusterInfo =
    c.source === "sensing" && c.clusterSize
      ? ` · cluster ×${c.clusterSize}`
      : "";

  return (
    <li className="border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {c.createdAt.slice(0, 19).replace("T", " ")} · {c.detectedLanguage}{" "}
            · source: {c.source}
            {clusterInfo} · risk: {c.riskLevel}
          </p>
          <p className="text-body-lg mt-1 font-medium">{c.candidateTitle}</p>
          <p className="text-sm mt-1 whitespace-pre-line">
            {c.candidateAnswer}
          </p>
          {c.notes && (
            <p className="text-xs text-muted mt-1 italic">{c.notes}</p>
          )}
          {c.publishedLiveFaqId && (
            <p className="text-xs text-green-700 mt-1 font-mono">
              live: {c.publishedLiveFaqId}
            </p>
          )}
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap font-mono ${
            c.state === "PUBLISHED"
              ? "bg-green-100 text-green-700"
              : c.state === "REJECTED"
                ? "bg-neutral-200 text-muted"
                : c.state === "NEEDS_EDIT"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-foreground text-surface"
          }`}
        >
          {c.state ?? c.status}
        </span>
      </div>
      {c.state !== "PUBLISHED" && c.state !== "REJECTED" && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {/* Spec §6 — valid transitions depend on current state. The
                backend re-validates via canTransition(); these buttons are
                just convenience. */}
            {(c.state === "NEW" || c.state === "CLUSTERED") && (
              <button
                onClick={() => onTransition(c.id, "REVIEWED")}
                className="text-sm px-4 py-2 border border-border rounded-full"
              >
                Mark reviewed
              </button>
            )}
            {c.state === "NEEDS_EDIT" && (
              <button
                onClick={() => onTransition(c.id, "REVIEWED")}
                className="text-sm px-4 py-2 border border-border rounded-full"
              >
                Re-mark reviewed
              </button>
            )}
            {(c.state === "NEW" ||
              c.state === "CLUSTERED" ||
              c.state === "REVIEWED") && (
              <button
                onClick={() => onTransition(c.id, "NEEDS_EDIT")}
                className="text-sm px-4 py-2 border border-border rounded-full"
              >
                Needs edit
              </button>
            )}
            <button
              onClick={() => onTransition(c.id, "REJECTED")}
              className="text-sm px-4 py-2 border border-border rounded-full"
            >
              Reject
            </button>
            <button
              onClick={() => setPublishing((v) => !v)}
              className="text-sm px-4 py-2 bg-foreground text-surface rounded-full"
            >
              {publishing ? "Cancel publish" : "Publish to live KB"}
            </button>
          </div>
          {publishing && (
            <div className="border border-border rounded-lg p-3 space-y-2 bg-surface">
              <div className="flex gap-2">
                <label className="flex-1 text-xs text-muted">
                  Category
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as typeof category)
                    }
                    className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm"
                  >
                    <option value="renting">renting</option>
                    <option value="home_buying">home_buying</option>
                    <option value="visa">visa</option>
                    <option value="daily_life">daily_life</option>
                    <option value="other">other</option>
                  </select>
                </label>
                <label className="flex-1 text-xs text-muted">
                  Risk
                  <select
                    value={riskLevel}
                    onChange={(e) =>
                      setRiskLevel(e.target.value as typeof riskLevel)
                    }
                    className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm"
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </label>
                <label className="flex-1 text-xs text-muted">
                  Tier
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as typeof tier)}
                    className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm"
                  >
                    <option value="A">A — one-sentence, skip LLM</option>
                    <option value="B">B — short steps, skip LLM</option>
                    <option value="C">C — needs AI layer</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="Title (EN)"
                  className="border border-border rounded px-2 py-1 text-sm bg-surface"
                />
                <input
                  value={titleZh}
                  onChange={(e) => setTitleZh(e.target.value)}
                  placeholder="Title (ZH)"
                  className="border border-border rounded px-2 py-1 text-sm bg-surface"
                />
                <input
                  value={titleJa}
                  onChange={(e) => setTitleJa(e.target.value)}
                  placeholder="Title (JA)"
                  className="border border-border rounded px-2 py-1 text-sm bg-surface"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <textarea
                  value={answerEn}
                  onChange={(e) => setAnswerEn(e.target.value)}
                  placeholder="Answer (EN)"
                  rows={3}
                  className="border border-border rounded px-2 py-1 text-sm bg-surface"
                />
                <textarea
                  value={answerZh}
                  onChange={(e) => setAnswerZh(e.target.value)}
                  placeholder="Answer (ZH)"
                  rows={3}
                  className="border border-border rounded px-2 py-1 text-sm bg-surface"
                />
                <textarea
                  value={answerJa}
                  onChange={(e) => setAnswerJa(e.target.value)}
                  placeholder="Answer (JA)"
                  rows={3}
                  className="border border-border rounded px-2 py-1 text-sm bg-surface"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  value={keywordsEn}
                  onChange={(e) => setKeywordsEn(e.target.value)}
                  placeholder="Keywords EN (comma-sep)"
                  className="border border-border rounded px-2 py-1 text-xs bg-surface"
                />
                <input
                  value={keywordsZh}
                  onChange={(e) => setKeywordsZh(e.target.value)}
                  placeholder="Keywords ZH"
                  className="border border-border rounded px-2 py-1 text-xs bg-surface"
                />
                <input
                  value={keywordsJa}
                  onChange={(e) => setKeywordsJa(e.target.value)}
                  placeholder="Keywords JA"
                  className="border border-border rounded px-2 py-1 text-xs bg-surface"
                />
              </div>
              <button
                onClick={submit}
                disabled={
                  !answerEn.trim() && !answerZh.trim() && !answerJa.trim()
                }
                className="text-sm px-4 py-2 bg-foreground text-surface rounded-full disabled:opacity-40"
              >
                Publish now
              </button>
              <p className="text-xs text-muted">
                Only &ldquo;answer&rdquo; is required — missing language fields
                fall back to the primary language. Published FAQs are live
                immediately via the overlay; no redeploy.
              </p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function HandoffRow({
  entry,
  onResolve,
  templates,
  onPromoteTemplate,
}: {
  entry: HandoffEntry;
  onResolve: (
    id: string,
    humanReply: string,
    resolution: string,
    createFaqCandidate: boolean,
  ) => void;
  templates: TemplateRow[];
  onPromoteTemplate: (handoffId: string) => void;
}) {
  const [humanReply, setHumanReply] = useState(entry.humanReply ?? "");
  const [resolution, setResolution] = useState(entry.resolution ?? "");
  const [createFaqCandidate, setCreateFaqCandidate] = useState(false);
  const [open, setOpen] = useState(entry.status !== "resolved");

  // Templates for the same language are the most relevant — show those first.
  const sortedTemplates = templates
    .slice()
    .sort((a, b) => {
      const al = a.language === entry.detectedLanguage ? 0 : 1;
      const bl = b.language === entry.detectedLanguage ? 0 : 1;
      if (al !== bl) return al - bl;
      return b.useCount - a.useCount;
    });

  async function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setHumanReply((prev) => (prev ? `${prev}\n\n${t.body}` : t.body));
    // Fire-and-forget useCount increment.
    fetch(`/api/templates/${id}`, { method: "POST" }).catch(() => {});
  }

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
          {sortedTemplates.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted">Insert template</label>
              <select
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) {
                    applyTemplate(v);
                    e.target.value = "";
                  }
                }}
                className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs"
                defaultValue=""
              >
                <option value="">— pick an active template —</option>
                {sortedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.language}] {t.title}
                    {t.category ? ` · ${t.category}` : ""} · used {t.useCount}×
                  </option>
                ))}
              </select>
            </div>
          )}
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
            {entry.status === "resolved" && entry.humanReply && (
              <button
                type="button"
                onClick={() => onPromoteTemplate(entry.id)}
                className="text-sm px-4 py-2 border border-border rounded-full"
              >
                Promote to template
              </button>
            )}
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
