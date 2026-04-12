"use client";

/**
 * /cases — Phase 3 lightweight case tracking surface.
 *
 * Operator view of the `cases` table. Lists all cases, supports filter by
 * status, and lets staff change status / assignee / due date / notes /
 * resolution summary inline.
 *
 * [KNOWN LIMITATION] Backed by file-JSONL (`/tmp` on Vercel, `.data/`
 * locally). Cold starts on Vercel wipe state. Phase 1/2 trade-off — see
 * KNOWN_LIMITATIONS.md.
 */

import { useEffect, useState } from "react";

type CaseStatus =
  | "open"
  | "in_progress"
  | "waiting_user"
  | "resolved"
  | "closed";

type CaseRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  queryText: string;
  language: "en" | "zh" | "ja";
  category: string | null;
  subtopic: string | null;
  status: CaseStatus;
  riskLevel: string;
  assignee: string | null;
  dueDate: string | null;
  notes: string | null;
  sourceUserQueryId: string | null;
  sourceHandoffId: string | null;
  resolutionSummary: string | null;
  resolvedAt: string | null;
};

const STATUSES: CaseStatus[] = [
  "open",
  "in_progress",
  "waiting_user",
  "resolved",
  "closed",
];

const STATUS_LABEL: Record<CaseStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_user: "Waiting User",
  resolved: "Resolved",
  closed: "Closed",
};

export default function CasesPage() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<CaseStatus | "all">("all");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterAssignee.trim()) params.set("assignee", filterAssignee.trim());
      const res = await fetch(`/api/cases?${params.toString()}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Failed to load");
      setCases(j.cases as CaseRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterAssignee]);

  async function patchCase(id: string, patch: Partial<CaseRow>) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/cases/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Update failed");
      setCases((prev) =>
        prev.map((c) => (c.id === id ? (j.case as CaseRow) : c)),
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  }

  const grouped: Record<CaseStatus, CaseRow[]> = {
    open: [],
    in_progress: [],
    waiting_user: [],
    resolved: [],
    closed: [],
  };
  for (const c of cases) grouped[c.status]?.push(c);

  return (
    <main className="mx-auto max-w-7xl p-6 font-sans text-sm">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cases</h1>
          <p className="text-neutral-500">
            Phase 3 lightweight case tracking. Auto-created on every handoff.
          </p>
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2">
            <span className="text-neutral-600">Status</span>
            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as CaseStatus | "all")
              }
              className="rounded border border-neutral-300 px-2 py-1"
            >
              <option value="all">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-neutral-600">Assignee</span>
            <input
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              placeholder="any"
              className="w-40 rounded border border-neutral-300 px-2 py-1"
            />
          </label>
          <button
            type="button"
            onClick={load}
            className="rounded bg-neutral-900 px-3 py-1 text-white hover:bg-neutral-700"
          >
            Refresh
          </button>
        </div>
      </header>

      {loading && <p className="text-neutral-500">Loading…</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      {!loading && !error && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {STATUSES.map((s) => (
              <div
                key={s}
                className="rounded border border-neutral-200 bg-neutral-50 p-3"
              >
                <div className="text-xs uppercase text-neutral-500">
                  {STATUS_LABEL[s]}
                </div>
                <div className="text-2xl font-semibold">
                  {grouped[s].length}
                </div>
              </div>
            ))}
          </div>

          {cases.length === 0 ? (
            <p className="text-neutral-500">No cases match the filter.</p>
          ) : (
            <ul className="space-y-3">
              {cases.map((c) => (
                <li
                  key={c.id}
                  className="rounded border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5">
                      {c.id}
                    </code>
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                      {c.language}
                    </span>
                    {c.category && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
                        {c.category}
                        {c.subtopic ? ` / ${c.subtopic}` : ""}
                      </span>
                    )}
                    <span
                      className={
                        "rounded px-1.5 py-0.5 " +
                        (c.riskLevel === "high"
                          ? "bg-red-100 text-red-700"
                          : c.riskLevel === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-neutral-100 text-neutral-700")
                      }
                    >
                      risk: {c.riskLevel}
                    </span>
                    {c.sourceHandoffId && (
                      <span className="rounded bg-purple-50 px-1.5 py-0.5 text-purple-700">
                        from handoff
                      </span>
                    )}
                  </div>
                  <p className="mb-3 text-base">{c.queryText}</p>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-neutral-500">Status</span>
                      <select
                        value={c.status}
                        disabled={savingId === c.id}
                        onChange={(e) =>
                          patchCase(c.id, {
                            status: e.target.value as CaseStatus,
                          })
                        }
                        className="rounded border border-neutral-300 px-2 py-1"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-neutral-500">Assignee</span>
                      <input
                        defaultValue={c.assignee ?? ""}
                        disabled={savingId === c.id}
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== c.assignee) patchCase(c.id, { assignee: v });
                        }}
                        className="rounded border border-neutral-300 px-2 py-1"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-neutral-500">Due date</span>
                      <input
                        type="date"
                        defaultValue={c.dueDate ?? ""}
                        disabled={savingId === c.id}
                        onBlur={(e) => {
                          const v = e.target.value || null;
                          if (v !== c.dueDate) patchCase(c.id, { dueDate: v });
                        }}
                        className="rounded border border-neutral-300 px-2 py-1"
                      />
                    </label>
                    <div className="text-xs text-neutral-500">
                      Updated {new Date(c.updatedAt).toLocaleString()}
                      {c.resolvedAt && (
                        <>
                          <br />
                          Resolved {new Date(c.resolvedAt).toLocaleString()}
                        </>
                      )}
                    </div>
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-neutral-600">
                      Notes &amp; resolution
                    </summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-neutral-500">Notes</span>
                        <textarea
                          defaultValue={c.notes ?? ""}
                          disabled={savingId === c.id}
                          onBlur={(e) => {
                            const v = e.target.value.trim() || null;
                            if (v !== c.notes) patchCase(c.id, { notes: v });
                          }}
                          rows={3}
                          className="rounded border border-neutral-300 px-2 py-1"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-neutral-500">
                          Resolution summary
                        </span>
                        <textarea
                          defaultValue={c.resolutionSummary ?? ""}
                          disabled={savingId === c.id}
                          onBlur={(e) => {
                            const v = e.target.value.trim() || null;
                            if (v !== c.resolutionSummary)
                              patchCase(c.id, { resolutionSummary: v });
                          }}
                          rows={3}
                          className="rounded border border-neutral-300 px-2 py-1"
                        />
                      </label>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
