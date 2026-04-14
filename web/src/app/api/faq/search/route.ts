/**
 * GET /api/faq/search?q=xxx&locale=zh-Hans&category=prep
 *
 * Searches FAQ cards from two sources:
 *   1. Mock config cards (UI-ready, zh-Hans titles)
 *   2. Knowledge base seeds (multilingual, scored by synonym expansion)
 *
 * Results are deduplicated by id and merged, with knowledge base matches
 * augmenting the mock card set for broader coverage (especially for
 * en/ja queries that wouldn't match zh-Hans mock titles).
 */

import { NextRequest } from "next/server";
import { MOCK_CONFIG } from "@/lib/jtg/mock";
import { scoreQueryAgainstSeeds, type FaqEntry } from "@/lib/knowledge/seed";
import type { Locale, FaqCategory } from "@/lib/jtg/types";
import {
  checkRateLimit,
  extractClientIp,
} from "@/lib/security/rate-limit";
import { ok, rateLimited } from "@/lib/utils/api-response";
import { sanitizeInput, stripControlChars } from "@/lib/utils/sanitize";

/** Map knowledge base categories to mock card category keys. */
const KB_TO_MOCK_CATEGORY: Record<string, FaqCategory["key"] | null> = {
  renting: "prep",           // broad mapping — renting covers prep through checkout
  home_buying: "buy_longstay",
  visa: "prep",
  daily_life: "after_movein",
};

/** Convert a knowledge base FaqEntry into the same shape as mock FaqCard. */
function seedToCard(faq: FaqEntry, locale: Locale) {
  const lang = locale === "zh-Hans" ? "zh" : locale === "ja" ? "ja" : "en";
  return {
    id: faq.id,
    categoryKey: KB_TO_MOCK_CATEGORY[faq.category] ?? "prep",
    title: faq.representative_title[lang] || faq.representative_title.en,
    summary: faq.pain_point[lang] || faq.pain_point.en,
    contentTypeLabel: faq.risk_level === "high" ? "important" : "info",
    supportLevel: "full" as const,
    machineTranslated: false,
    href: `/${locale}/faq/${faq.id}`,
    source: "knowledge_base" as const,
  };
}

export async function GET(request: NextRequest) {
  // Per-IP rate limit — public search, use "api" preset (30 req/min custom).
  const rl = checkRateLimit(
    `faq-search:${extractClientIp(request.headers)}`,
    { windowMs: 60_000, maxRequests: 30 },
  );
  if (!rl.allowed) {
    return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));
  }

  const q = stripControlChars(sanitizeInput(request.nextUrl.searchParams.get("q") ?? "", 500));
  const locale = (request.nextUrl.searchParams.get("locale") ?? "zh-Hans") as Locale;
  const category = request.nextUrl.searchParams.get("category") as FaqCategory["key"] | null;

  if (!q.trim()) {
    return ok({ query: q, locale, resultCount: 0, items: [] });
  }

  const lower = q.toLowerCase();

  // ── Source 1: Mock config cards (fast, UI-ready) ──────────────────
  let mockCards = MOCK_CONFIG.faqZone.cards;
  if (category) {
    mockCards = mockCards.filter((c) => c.categoryKey === category);
  }

  const mockMatches = mockCards.filter(
    (c) =>
      c.title.toLowerCase().includes(lower) ||
      c.summary.toLowerCase().includes(lower)
  );

  // ── Source 2: Knowledge base seeds (multilingual, scored) ─────────
  const kbScored = scoreQueryAgainstSeeds(q);
  const kbMatches = kbScored
    .filter((s) => s.score > 0.3) // Only include meaningful matches
    .filter((s) => {
      if (!category) return true;
      return KB_TO_MOCK_CATEGORY[s.faq.category] === category;
    })
    .slice(0, 10) // Cap at 10 KB results
    .map((s) => ({
      ...seedToCard(s.faq, locale),
      _score: s.score,
    }));

  // ── Merge & deduplicate ───────────────────────────────────────────
  const seen = new Set<string>();
  const items: Array<Record<string, unknown>> = [];

  // Mock cards first (they have better UI metadata)
  for (const card of mockMatches) {
    seen.add(card.id);
    items.push({ ...card, source: "mock" });
  }

  // Then KB results that aren't already covered
  for (const card of kbMatches) {
    if (!seen.has(card.id)) {
      seen.add(card.id);
      const { _score, ...rest } = card;
      items.push(rest);
    }
  }

  return ok({
    query: q,
    locale,
    resultCount: items.length,
    items,
  });
}
