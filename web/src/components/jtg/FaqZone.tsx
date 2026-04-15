"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { FaqZoneData, FaqCard, FaqCategory } from "@/lib/jtg/types";
import { searchFaq } from "@/lib/jtg/api";
import type { Locale } from "@/lib/jtg/types";
import {
  trackFaqClick,
  trackFaqDwell,
  trackSearchSubmit,
} from "@/lib/jtg/track";

interface Props {
  data: FaqZoneData;
  locale: Locale;
}

export function FaqZone({ data, locale }: Props) {
  const [activeTab, setActiveTab] = useState<FaqCategory["key"]>(
    data.activeCategoryKey
  );
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FaqCard[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const filteredCards =
    searchResults ??
    data.cards.filter((c) => c.categoryKey === activeTab);

  const handleSearch = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setSearchResults(null);
        return;
      }
      setSearching(true);
      searchFaq(q, locale, activeTab)
        .then((res) => {
          setSearchResults(res.items);
          trackSearchSubmit(q, locale.split("-")[0], res.resultCount);
        })
        .catch(() => {
          // Fallback to local filter
          const lower = q.toLowerCase();
          setSearchResults(
            data.cards.filter(
              (c) =>
                c.title.toLowerCase().includes(lower) ||
                c.summary.toLowerCase().includes(lower)
            )
          );
        })
        .finally(() => setSearching(false));
    },
    [locale, activeTab, data.cards]
  );

  function onInputChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(val), 300);
  }

  function onTabChange(key: FaqCategory["key"]) {
    setActiveTab(key);
    setSearchResults(null);
    setQuery("");
  }

  return (
    <section id="faq-zone" className="mx-auto max-w-4xl px-4 py-12">
      <h2 className="text-2xl font-bold text-foreground">常见问题</h2>

      {/* Trending */}
      {data.trendingItems.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {data.trendingItems.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-accent hover:text-accent transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="mt-6">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={data.searchPlaceholder}
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-4 text-sm placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
        {data.categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => onTabChange(cat.key)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
              activeTab === cat.key && !searchResults
                ? "bg-accent text-white"
                : "text-muted hover:bg-accent-light"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Cards or empty state */}
      {filteredCards.length === 0 ? (
        <EmptyState data={data.searchEmptyState} />
      ) : (
        <div className="mt-4 space-y-3">
          {filteredCards.map((card) => (
            <FaqCardItem key={card.id} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}

function FaqCardItem({ card }: { card: FaqCard }) {
  const enterTime = useRef(0);

  function onEnter() {
    enterTime.current = Date.now();
  }

  function onLeave() {
    if (enterTime.current > 0) {
      trackFaqDwell(card.id, Date.now() - enterTime.current);
      enterTime.current = 0;
    }
  }

  return (
    <a
      href={card.href || "#"}
      onClick={() => trackFaqClick(card.id, card.categoryKey)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="block rounded-lg border border-border bg-surface p-4 transition-all hover:border-accent/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-foreground">{card.title}</h3>
          <p className="mt-1 text-sm text-muted line-clamp-2">{card.summary}</p>
        </div>
        <span className="shrink-0 rounded-md bg-accent-light px-2 py-0.5 text-xs text-accent">
          {card.contentTypeLabel}
        </span>
      </div>
      {card.machineTranslated && (
        <p className="mt-2 text-xs text-warning">
          机器翻译，仅供参考
        </p>
      )}
    </a>
  );
}

function EmptyState({
  data,
}: {
  data: FaqZoneData["searchEmptyState"];
}) {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-border bg-accent-light/30 p-8 text-center">
      <p className="text-base font-medium text-foreground">{data.title}</p>
      <ul className="mt-3 space-y-1">
        {data.hints.map((h, i) => (
          <li key={i} className="text-sm text-muted">
            {h}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center justify-center gap-4">
        <a
          href={data.aiLinkHref}
          className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90"
        >
          {data.aiLinkLabel}
        </a>
        <a
          href={data.humanHelpHref}
          className="text-sm text-accent underline underline-offset-2"
        >
          {data.humanHelpLabel}
        </a>
      </div>
    </div>
  );
}
