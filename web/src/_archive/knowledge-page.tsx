"use client";

import { useEffect, useState } from "react";
import { fetchFAQList, fetchFAQDetail, type APIFAQItem } from "@/lib/api-client";

const categoryLabels: Record<string, string> = {
  costs: "Costs & Fees",
  cost: "Costs & Fees",
  guarantor: "Guarantor",
  utilities: "Utilities",
  setup: "Utilities",
  insurance: "Insurance",
  registration: "Registration",
  contract: "Contract",
  move_out: "Move-out",
  process: "Process",
  rental_process: "Rental Process",
  service: "Services",
};

export default function KnowledgePage() {
  const [items, setItems] = useState<APIFAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<APIFAQItem | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchFAQList(searchQuery || undefined);
        setItems(data);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Failed to load knowledge base. Is the backend running?"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [searchQuery]);

  const handleExpand = async (slug: string) => {
    if (expandedSlug === slug) {
      setExpandedSlug(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedSlug(slug);
    try {
      const detail = await fetchFAQDetail(slug);
      setExpandedDetail(detail);
    } catch {
      // Fall back to list data
      setExpandedDetail(null);
    }
  };

  const categories = [...new Set(items.map((f) => f.category))];

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="p-6 rounded-2xl border border-danger/20 bg-red-50 text-sm">
          <p className="font-medium text-danger mb-2">Unable to load knowledge base</p>
          <p className="text-muted">{error}</p>
          <p className="mt-4 text-muted">
            Start the backend:{" "}
            <code className="bg-white px-2 py-0.5 rounded text-xs">python -m housing_os.api</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div className="max-w-2xl mb-16">
        <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
          Knowledge base
        </p>
        <h1 className="text-headline">
          Housing knowledge for foreigners in Japan
        </h1>
        <p className="mt-4 text-body-lg text-muted">
          Verified information organized by topic. Every answer traces to a
          source.
        </p>
      </div>

      {/* Search */}
      <div className="mb-12">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setLoading(true);
          }}
          placeholder="Search topics..."
          className="w-full max-w-md px-4 py-3 border border-border rounded-xl bg-surface text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
        />
      </div>

      {loading && (
        <p className="text-muted text-center py-12">Loading...</p>
      )}

      {!loading && categories.map((cat) => {
        const catItems = items.filter((f) => f.category === cat);
        return (
          <div key={cat} className="mb-12" id={cat}>
            <h2 className="text-title mb-6 pb-2 border-b border-border">
              {categoryLabels[cat] || cat}
            </h2>
            <div className="space-y-3">
              {catItems.map((item) => {
                const isExpanded = expandedSlug === item.faq_slug;
                const detail = isExpanded ? expandedDetail : null;
                return (
                  <div
                    key={item.faq_slug}
                    className="border border-border rounded-xl overflow-hidden transition-all"
                  >
                    <button
                      onClick={() => handleExpand(item.faq_slug)}
                      className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-accent-light/30 transition-colors"
                    >
                      <span className="font-medium pr-4">{item.title}</span>
                      <span
                        className={`text-lg transition-transform ${isExpanded ? "rotate-45" : ""}`}
                      >
                        +
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="px-6 pb-6 border-t border-border/50 animate-fade-in">
                        <div className="pt-4 text-sm text-muted leading-relaxed whitespace-pre-line">
                          {item.content}
                        </div>

                        {/* Source info from detail endpoint */}
                        {detail?.sources && detail.sources.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-border/50">
                            <p className="text-xs font-medium text-muted mb-2">
                              Sources ({detail.sources.length})
                            </p>
                            {detail.sources.map((src) => (
                              <div
                                key={src.source_key}
                                className="flex items-center gap-2 text-xs text-muted mb-1"
                              >
                                <span className="px-2 py-0.5 rounded-full bg-accent-light text-accent">
                                  {src.source_name}
                                </span>
                                <span>[{src.review_status}]</span>
                                {src.source_url && (
                                  <a
                                    href={src.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent hover:underline"
                                  >
                                    Visit &rarr;
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                          <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-muted">
                            Updated {item.updated_at}
                          </span>
                          {item.applicability_boundary && (
                            <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-muted">
                              {item.applicability_boundary}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!loading && items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted mb-4">
            No matching topics found{searchQuery ? ` for "${searchQuery}"` : ""}.
          </p>
          {searchQuery && (
            <div className="space-y-2">
              <p className="text-xs text-muted">
                Try a broader term, or browse by category above.
              </p>
              <button
                onClick={() => { setSearchQuery(""); setLoading(true); }}
                className="text-sm text-accent hover:underline"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
