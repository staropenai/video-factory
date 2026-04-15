// JTG Homepage V2 — API Client

import type {
  Locale,
  HomepageConfig,
  FaqSearchResponse,
  UsageTodayResponse,
  AiSessionOpenResponse,
  FaqCategory,
} from "./types";

const BASE = "";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return res.json();
}

// 1. Homepage config
export function fetchHomepageConfig(locale: Locale): Promise<HomepageConfig> {
  return get(`/api/homepage/config?locale=${locale}`);
}

// 2. FAQ search
export function searchFaq(
  q: string,
  locale: Locale,
  category?: FaqCategory["key"]
): Promise<FaqSearchResponse> {
  const params = new URLSearchParams({ q, locale });
  if (category) params.set("category", category);
  return get(`/api/faq/search?${params}`);
}

// 3. Usage today
export function fetchUsageToday(): Promise<UsageTodayResponse> {
  return get("/api/usage/today");
}

// 4. AI session open
export function openAiSession(
  locale: Locale,
  sourceZone: string
): Promise<AiSessionOpenResponse> {
  return post("/api/ai/session/open", { locale, sourceZone });
}

// 5. Behavior event (fire-and-forget)
export function sendBehavior(event: Record<string, unknown>): void {
  try {
    fetch(`${BASE}/api/behavior`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Silent — tracking must never block UI
  }
}

// 6. Language switch
export function switchLanguage(
  fromLocale: Locale,
  toLocale: Locale
): Promise<{ ok: boolean; locale: Locale }> {
  return post("/api/i18n/switch", { fromLocale, toLocale });
}

// 7. Pricing summary
export function fetchPricingSummary(locale: Locale) {
  return get(`/api/pricing/summary?locale=${locale}`);
}
