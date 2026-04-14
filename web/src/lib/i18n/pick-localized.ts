/**
 * Locale resolution helpers — single source of truth.
 *
 * Resolves URL locales (zh-Hans, en, ja, ko, vi, th) to seed-data
 * language keys (zh, en, ja) and picks the best available text.
 */

import type { Lang, PartialLocalizedText } from "./types";

/**
 * Map a URL locale (e.g. "zh-Hans") to a seed-data language key.
 * ko/vi/th fall back to "en".
 */
export function toLang(locale: string): Lang {
  if (locale === "zh-Hans" || locale === "zh") return "zh";
  if (locale === "ja") return "ja";
  return "en";
}

/**
 * Pick the best available localized string.
 * Fallback chain: requested lang → zh → en → ja → ""
 */
export function pickLocalized(
  obj: PartialLocalizedText | undefined,
  locale: string
): string {
  if (!obj) return "";
  const lang = toLang(locale);
  return obj[lang] || obj.zh || obj.en || obj.ja || "";
}
