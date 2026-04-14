// JTG Homepage V2 — Behavior Tracking (fire-and-forget, never blocks UI)

import type { EventType, Locale } from "./types";
import { sendBehavior } from "./api";

let _sessionId = "";
let _locale: Locale = "zh-Hans";
let _pageName: "home" = "home";

export function initTracking(sessionId: string, locale: Locale) {
  _sessionId = sessionId;
  _locale = locale;
}

function emit(
  eventType: EventType,
  payload: Record<string, unknown> = {},
  elementId?: string
) {
  sendBehavior({
    eventType,
    pageName: _pageName,
    elementId,
    locale: _locale,
    sessionId: _sessionId,
    timestamp: new Date().toISOString(),
    payload,
  });
}

export function trackPageView() {
  emit("page_view");
}

export function trackHeroEntryClick(
  entryName: string,
  sourceZone: "hero" | "nav"
) {
  emit("hero_entry_click", { entryName, sourceZone }, entryName);
}

export function trackFaqClick(cardId: string, category: string) {
  emit("faq_click", { cardId, category }, cardId);
}

export function trackFaqDwell(cardId: string, dwellMs: number) {
  if (dwellMs < 3000) return; // Threshold: 3000ms
  emit("faq_dwell", { cardId, dwellMs }, cardId);
}

export function trackSearchSubmit(
  query: string,
  queryLanguage: string,
  resultCount: number,
  selectedResultId?: string
) {
  emit("search_submit", { query, queryLanguage, resultCount, selectedResultId });
}

export function trackAiOpen(sourceZone: string) {
  emit("ai_open", { sourceZone });
}

export function trackHumanHelpClick(sourceZone: string) {
  emit("human_help_click", { sourceZone });
}

export function trackLangSwitch(fromLocale: Locale, toLocale: Locale) {
  // Note: emit with the NEW locale
  _locale = toLocale;
  emit("lang_switch_manual", { fromLocale, toLocale });
}
