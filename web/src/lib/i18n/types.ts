/**
 * Centralized i18n type definitions.
 * Single source of truth — import from here, not from page files.
 */

/** Languages supported by the knowledge base (seed data). */
export type Lang = "en" | "zh" | "ja";

/** Localized text object used across knowledge cards, UI labels, etc. */
export type LocalizedText = {
  en: string;
  zh: string;
  ja: string;
};

/** Partial localized text — for contexts where not all languages are required. */
export type PartialLocalizedText = Partial<LocalizedText>;

/** All URL locales supported by the JTG homepage. */
export const SUPPORTED_LOCALES = [
  "zh-Hans",
  "en",
  "ja",
  "ko",
  "vi",
  "th",
] as const;

export type UrlLocale = (typeof SUPPORTED_LOCALES)[number];
