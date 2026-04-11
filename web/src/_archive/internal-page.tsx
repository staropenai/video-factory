"use client";

import { useEffect, useState } from "react";
import {
  fetchStats,
  fetchEscalations,
  fetchValidation,
  fetchEscalation,
  fetchRules,
  transitionEscalation,
  type APIStats,
  type APIEscalation,
  type APIRule,
} from "@/lib/api-client";

type Tab = "overview" | "escalations" | "validation" | "rules";

export default function InternalDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<APIStats | null>(null);
  const [escalations, setEscalations] = useState<APIEscalation[]>([]);
  const [validation, setValidation] = useState<Record<string, { count: number; rows: unknown[] }> | null>(null);
  const [rules, setRules] = useState<APIRule[]>([]);
  const [selectedEsc, setSelectedEsc] = useState<APIEscalation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [s, e, v, r] = await Promise.all([
          fetchStats(),
          fetchEscalations(),
          fetchValidation(),
          fetchRules(),
        ]);
        setStats(s);
        setEscalations(e);
        setValidation(v);
        setRules(r);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Failed to load. Is the backend running?"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleAssign = async (eid: string) => {
    try {
      await transitionEscalation(eid, "assigned", "dashboard_user", {
        event_data: { assigned_via: "internal_dashboard" },
      });
      const updated = await fetchEscalations();
      setEscalations(updated);
      if (selectedEsc?.escalation_id === eid) {
        const detail = await fetchEscalation(eid);
        setSelectedEsc(detail);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Transition failed");
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="p-6 rounded-2xl border border-danger/20 bg-red-50 text-sm">
          <p className="font-medium text-danger mb-2">Dashboard unavailable</p>
          <p className="text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-24 text-muted text-center">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-headline">Internal Dashboard</h1>
        <p className="text-sm text-muted mt-1">
          Operations review — not user-facing
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-border">
        {(["overview", "escalations", "validation", "rules"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && stats && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { label: "FAQ items", value: stats.faq_items },
              { label: "Active rules", value: stats.rules },
              { label: "Sources", value: stats.sources },
              { label: "Decisions logged", value: stats.decisions },
              { label: "Open escalations", value: stats.escalations_open },
              { label: "Total escalations", value: stats.escalations_total },
              { label: "Regression cases", value: stats.regression_cases },
              { label: "Pending writebacks", value: stats.writeback_pending },
            ].map((s) => (
              <div
                key={s.label}
                className="p-5 rounded-xl border border-border"
              >
                <p className="text-2xl font-semibold">{s.value}</p>
                <p className="text-xs text-muted mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Escalations */}
      {tab === "escalations" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Queue list */}
          <div>
            <h3 className="text-sm font-medium mb-4">
              Escalation Queue ({escalations.length})
            </h3>
            <div className="space-y-2">
              {escalations.map((esc) => (
                <button
                  key={esc.escalation_id}
                  onClick={async () => {
                    try {
                      const detail = await fetchEscalation(esc.escalation_id);
                      setSelectedEsc(detail);
                    } catch {
                      setSelectedEsc(esc);
                    }
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedEsc?.escalation_id === esc.escalation_id
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        esc.priority_band === "critical"
                          ? "bg-red-100 text-red-700"
                          : esc.priority_band === "high"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-zinc-100 text-muted"
                      }`}
                    >
                      {esc.priority_band}
                    </span>
                    <span className="text-xs text-muted">
                      {esc.queue_status}
                    </span>
                    <span className="text-xs text-muted ml-auto">
                      {esc.escalation_id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-sm truncate">{esc.query_text}</p>
                </button>
              ))}
              {escalations.length === 0 && (
                <p className="text-muted text-sm text-center py-8">
                  No open escalations
                </p>
              )}
            </div>
          </div>

          {/* Detail panel */}
          <div>
            {selectedEsc ? (
              <div className="p-6 rounded-xl border border-border">
                <h3 className="font-medium mb-4">Escalation Detail</h3>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted">ID</dt>
                    <dd className="font-mono text-xs">{selectedEsc.escalation_id}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Query</dt>
                    <dd>{selectedEsc.query_text}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Reason</dt>
                    <dd>{selectedEsc.escalation_reason}</dd>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <dt className="text-xs text-muted">Risk</dt>
                      <dd>{selectedEsc.risk_level}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Confidence</dt>
                      <dd>{selectedEsc.confidence_band}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Priority</dt>
                      <dd>{selectedEsc.priority_band}</dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Status</dt>
                    <dd className="font-medium">{selectedEsc.queue_status}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Created</dt>
                    <dd className="text-xs">{selectedEsc.created_at}</dd>
                  </div>
                </dl>

                {/* Events */}
                {selectedEsc.events && selectedEsc.events.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-border">
                    <h4 className="text-xs font-medium text-muted mb-3">
                      Events ({selectedEsc.events.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedEsc.events.map((evt) => (
                        <div
                          key={evt.event_id}
                          className="text-xs p-2 rounded bg-zinc-50"
                        >
                          <span className="font-medium">{evt.event_type}</span>
                          <span className="text-muted ml-2">
                            by {evt.actor}
                          </span>
                          <span className="text-muted ml-2">
                            {evt.created_at}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {selectedEsc.queue_status === "open" && (
                  <div className="mt-6 pt-4 border-t border-border">
                    <button
                      onClick={() => handleAssign(selectedEsc.escalation_id)}
                      className="px-4 py-2 bg-foreground text-surface rounded-lg text-sm hover:opacity-90 transition-opacity"
                    >
                      Assign to me
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 rounded-xl border border-dashed border-border text-center text-muted text-sm">
                Select an escalation to view details
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rules */}
      {tab === "rules" && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium mb-4">
            Active Rules ({rules.length})
          </h3>
          {rules.map((rule) => (
            <div
              key={rule.rule_key}
              className="p-4 rounded-xl border border-border"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-muted">
                  {rule.rule_key}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  rule.category === "safety"
                    ? "bg-red-100 text-red-700"
                    : rule.category === "escalation"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-zinc-100 text-muted"
                }`}>
                  {rule.category}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  rule.risk_level === "high"
                    ? "bg-red-100 text-red-700"
                    : "bg-zinc-100 text-muted"
                }`}>
                  {rule.risk_level} risk
                </span>
              </div>
              <p className="text-sm font-medium">{rule.title}</p>
              <p className="text-xs text-muted mt-1">{rule.description}</p>
            </div>
          ))}
          {rules.length === 0 && (
            <p className="text-muted text-sm text-center py-8">
              No active rules found
            </p>
          )}
        </div>
      )}

      {/* Validation */}
      {tab === "validation" && validation && (
        <div className="space-y-4">
          {Object.entries(validation).map(([viewName, data]) => {
            const isIssue =
              viewName !== "v_writeback_traceability" &&
              viewName !== "v_regression_coverage" &&
              data.count > 0;
            return (
              <div
                key={viewName}
                className={`p-4 rounded-xl border ${
                  isIssue ? "border-danger/20 bg-red-50" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium font-mono">
                    {viewName}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      isIssue
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {data.count} rows
                  </span>
                </div>
                {data.count > 0 && data.rows.length > 0 && (
                  <pre className="mt-3 text-xs text-muted overflow-x-auto bg-zinc-50 p-3 rounded">
                    {JSON.stringify(data.rows.slice(0, 3), null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
