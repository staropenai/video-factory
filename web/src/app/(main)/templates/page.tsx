"use client";

/**
 * /templates — Phase 3 reusable answer-template library.
 *
 * Operator surface for the `templates` table. List / filter / create /
 * edit / archive / delete. Promoted writebacks also show up here.
 *
 * [KNOWN LIMITATION] Backed by file-JSONL (`/tmp` on Vercel, `.data/`
 * locally). Cold starts on Vercel wipe state.
 */

import { useEffect, useState } from "react";

type TemplateStatus = "draft" | "active" | "archived";

type TemplateRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  body: string;
  language: "en" | "zh" | "ja";
  category: string | null;
  tags: string[];
  status: TemplateStatus;
  useCount: number;
  createdBy: string;
  sourceHandoffId: string | null;
  sourceFeedbackId: string | null;
};

const STATUSES: TemplateStatus[] = ["draft", "active", "archived"];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<TemplateStatus | "all">(
    "all",
  );
  const [filterLang, setFilterLang] = useState<"all" | "en" | "zh" | "ja">(
    "all",
  );
  const [filterQ, setFilterQ] = useState("");

  // Create form
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newLang, setNewLang] = useState<"en" | "zh" | "ja">("en");
  const [newCategory, setNewCategory] = useState("");
  const [newTags, setNewTags] = useState("");
  const [creating, setCreating] = useState(false);

  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterLang !== "all") params.set("language", filterLang);
      if (filterQ.trim()) params.set("q", filterQ.trim());
      const res = await fetch(`/api/templates?${params.toString()}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Failed to load");
      setTemplates(j.templates as TemplateRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterLang]);

  async function createTemplate() {
    if (!newTitle.trim() || !newBody.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          body: newBody.trim(),
          language: newLang,
          category: newCategory.trim() || null,
          tags: newTags.trim(),
          status: "draft",
          createdBy: "staff",
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Create failed");
      setNewTitle("");
      setNewBody("");
      setNewCategory("");
      setNewTags("");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function patchTemplate(id: string, patch: Partial<TemplateRow>) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Update failed");
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? (j.template as TemplateRow) : t)),
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  }

  async function removeTemplate(id: string) {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Delete failed");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSavingId(null);
    }
  }

  const counts = {
    all: templates.length,
    active: templates.filter((t) => t.status === "active").length,
    draft: templates.filter((t) => t.status === "draft").length,
    archived: templates.filter((t) => t.status === "archived").length,
  };

  return (
    <main className="mx-auto max-w-6xl p-6 font-sans text-sm">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Answer templates</h1>
        <p className="text-neutral-500">
          Phase 3 reusable answer library. Staff can insert a template into a
          handoff reply, or promote a successful writeback into a new template.
        </p>
      </header>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-xs uppercase text-neutral-500">Total</div>
          <div className="text-2xl font-semibold">{counts.all}</div>
        </div>
        <div className="rounded border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-xs uppercase text-neutral-500">Active</div>
          <div className="text-2xl font-semibold">{counts.active}</div>
        </div>
        <div className="rounded border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-xs uppercase text-neutral-500">Draft</div>
          <div className="text-2xl font-semibold">{counts.draft}</div>
        </div>
        <div className="rounded border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-xs uppercase text-neutral-500">Archived</div>
          <div className="text-2xl font-semibold">{counts.archived}</div>
        </div>
      </div>

      {/* Create form */}
      <section className="mb-8 rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Create new template</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title"
            className="rounded border border-neutral-300 px-2 py-1"
          />
          <div className="flex gap-2">
            <select
              value={newLang}
              onChange={(e) =>
                setNewLang(e.target.value as "en" | "zh" | "ja")
              }
              className="rounded border border-neutral-300 px-2 py-1"
            >
              <option value="en">EN</option>
              <option value="zh">ZH</option>
              <option value="ja">JA</option>
            </select>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Category (optional)"
              className="flex-1 rounded border border-neutral-300 px-2 py-1"
            />
          </div>
        </div>
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder="Template body — the reply text staff can reuse."
          rows={4}
          className="mt-3 w-full rounded border border-neutral-300 px-2 py-1"
        />
        <div className="mt-3 flex items-center gap-3">
          <input
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="Tags (comma-separated)"
            className="flex-1 rounded border border-neutral-300 px-2 py-1"
          />
          <button
            type="button"
            onClick={createTemplate}
            disabled={creating || !newTitle.trim() || !newBody.trim()}
            className="rounded bg-neutral-900 px-4 py-1.5 text-white hover:bg-neutral-700 disabled:opacity-40"
          >
            {creating ? "…" : "Create as draft"}
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="mb-4 flex flex-wrap gap-3">
        <label className="flex items-center gap-2">
          <span className="text-neutral-600">Status</span>
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as TemplateStatus | "all")
            }
            className="rounded border border-neutral-300 px-2 py-1"
          >
            <option value="all">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-neutral-600">Language</span>
          <select
            value={filterLang}
            onChange={(e) =>
              setFilterLang(e.target.value as "all" | "en" | "zh" | "ja")
            }
            className="rounded border border-neutral-300 px-2 py-1"
          >
            <option value="all">All</option>
            <option value="en">EN</option>
            <option value="zh">ZH</option>
            <option value="ja">JA</option>
          </select>
        </label>
        <label className="flex flex-1 items-center gap-2">
          <span className="text-neutral-600">Search</span>
          <input
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
            }}
            placeholder="title / body / tag"
            className="flex-1 rounded border border-neutral-300 px-2 py-1"
          />
        </label>
        <button
          type="button"
          onClick={load}
          className="rounded bg-neutral-900 px-3 py-1 text-white hover:bg-neutral-700"
        >
          Refresh
        </button>
      </section>

      {loading && <p className="text-neutral-500">Loading…</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      {!loading && !error && (
        <>
          {templates.length === 0 ? (
            <p className="text-neutral-500">
              No templates yet. Create one above, or promote a handoff writeback
              from /review.
            </p>
          ) : (
            <ul className="space-y-3">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="rounded border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5">
                      {t.id}
                    </code>
                    <span
                      className={
                        "rounded px-1.5 py-0.5 " +
                        (t.status === "active"
                          ? "bg-green-100 text-green-700"
                          : t.status === "archived"
                            ? "bg-neutral-200 text-neutral-600"
                            : "bg-amber-100 text-amber-700")
                      }
                    >
                      {t.status}
                    </span>
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                      {t.language}
                    </span>
                    {t.category && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
                        {t.category}
                      </span>
                    )}
                    <span>used {t.useCount}×</span>
                    <span>{new Date(t.updatedAt).toLocaleString()}</span>
                    {(t.sourceHandoffId || t.sourceFeedbackId) && (
                      <span className="rounded bg-purple-50 px-1.5 py-0.5 text-purple-700">
                        promoted
                      </span>
                    )}
                  </div>

                  <input
                    defaultValue={t.title}
                    disabled={savingId === t.id}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== t.title) patchTemplate(t.id, { title: v });
                    }}
                    className="mb-2 w-full rounded border border-neutral-200 px-2 py-1 text-base font-medium"
                  />
                  <textarea
                    defaultValue={t.body}
                    disabled={savingId === t.id}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== t.body) patchTemplate(t.id, { body: v });
                    }}
                    rows={4}
                    className="w-full rounded border border-neutral-200 px-2 py-1 text-sm whitespace-pre-line"
                  />

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-xs">
                      Status
                      <select
                        value={t.status}
                        disabled={savingId === t.id}
                        onChange={(e) =>
                          patchTemplate(t.id, {
                            status: e.target.value as TemplateStatus,
                          })
                        }
                        className="rounded border border-neutral-300 px-2 py-1"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      Category
                      <input
                        defaultValue={t.category ?? ""}
                        disabled={savingId === t.id}
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== t.category)
                            patchTemplate(t.id, {
                              category: v as string | null,
                            });
                        }}
                        className="w-36 rounded border border-neutral-300 px-2 py-1"
                      />
                    </label>
                    <label className="flex flex-1 items-center gap-1 text-xs">
                      Tags
                      <input
                        defaultValue={t.tags.join(", ")}
                        disabled={savingId === t.id}
                        onBlur={(e) => {
                          const next = e.target.value
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean);
                          if (next.join(",") !== t.tags.join(","))
                            patchTemplate(t.id, {
                              tags: next,
                            });
                        }}
                        className="flex-1 rounded border border-neutral-300 px-2 py-1"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeTemplate(t.id)}
                      disabled={savingId === t.id}
                      className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
