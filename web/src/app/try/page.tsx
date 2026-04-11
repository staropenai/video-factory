"use client";

import { useState } from "react";

type RouterResponse = {
  decision?: {
    queryType?: string;
    riskLevel?: string;
    confidenceBand?: string;
    answerMode?: string;
    shouldEscalate?: boolean;
    reasons?: string[];
    traceTags?: string[];
  };
  error?: string;
  [key: string]: unknown;
};

export default function TryPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RouterResponse | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setErrorText(null);
    setResult(null);
    try {
      const res = await fetch("/api/router", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ queryText: query, taskState: {} }),
      });
      const text = await res.text();
      try {
        setResult(JSON.parse(text));
      } catch {
        setErrorText(`HTTP ${res.status}: ${text.slice(0, 500)}`);
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-semibold mb-2">Staging: Router Probe</h1>
      <p className="text-sm text-neutral-600 mb-8">
        Minimal UI to exercise <code>/api/router</code>. Staging only. No persistence. No logging.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 mb-8">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a query — e.g. 'I need urgent legal help'"
          rows={3}
          className="w-full border border-neutral-300 rounded-md px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="self-start bg-neutral-900 text-white px-5 py-2 rounded-md disabled:opacity-40"
        >
          {loading ? "Routing…" : "Send to /api/router"}
        </button>
      </form>

      {errorText && (
        <div className="border border-red-300 bg-red-50 text-red-900 p-4 rounded-md mb-6 text-sm font-mono whitespace-pre-wrap">
          {errorText}
        </div>
      )}

      {result && (
        <section className="border border-neutral-300 rounded-md p-5 bg-neutral-50">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600 mb-3">
            Decision
          </h2>
          {result.decision && (
            <dl className="grid grid-cols-2 gap-y-2 text-sm mb-4">
              <dt className="text-neutral-500">answerMode</dt>
              <dd className="font-mono">{String(result.decision.answerMode ?? "—")}</dd>
              <dt className="text-neutral-500">queryType</dt>
              <dd className="font-mono">{String(result.decision.queryType ?? "—")}</dd>
              <dt className="text-neutral-500">riskLevel</dt>
              <dd className="font-mono">{String(result.decision.riskLevel ?? "—")}</dd>
              <dt className="text-neutral-500">confidenceBand</dt>
              <dd className="font-mono">{String(result.decision.confidenceBand ?? "—")}</dd>
              <dt className="text-neutral-500">shouldEscalate</dt>
              <dd className="font-mono">{String(result.decision.shouldEscalate ?? "—")}</dd>
              {result.decision.reasons && result.decision.reasons.length > 0 && (
                <>
                  <dt className="text-neutral-500">reasons</dt>
                  <dd className="font-mono text-xs">{result.decision.reasons.join(" · ")}</dd>
                </>
              )}
              {result.decision.traceTags && result.decision.traceTags.length > 0 && (
                <>
                  <dt className="text-neutral-500">traceTags</dt>
                  <dd className="font-mono text-xs">{result.decision.traceTags.join(" · ")}</dd>
                </>
              )}
            </dl>
          )}
          <details>
            <summary className="cursor-pointer text-xs text-neutral-500">Raw JSON</summary>
            <pre className="mt-3 text-xs font-mono whitespace-pre-wrap bg-white p-3 border border-neutral-200 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </section>
      )}
    </main>
  );
}
