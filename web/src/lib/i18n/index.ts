/**
 * Internationalization — locale management and string lookup.
 *
 * Infrastructure is reusable. All old housing strings removed.
 * New domain strings should be added as needed.
 */

import type { Locale } from "@/lib/types";

export const defaultLocale: Locale = "en";
export const locales: Locale[] = ["en", "zh", "ja"];

const strings: Record<Locale, Record<string, string>> = {
  en: {
    "site.name": "StartOpenAI",
    "nav.about": "About",
    "nav.work": "Work",
    "nav.contact": "Contact",
    "cta.get_in_touch": "Get in touch",
  },
  zh: {
    "site.name": "StartOpenAI",
    "nav.about": "TBD_ZH",
    "nav.work": "TBD_ZH",
    "nav.contact": "TBD_ZH",
    "cta.get_in_touch": "TBD_ZH",
  },
  ja: {
    "site.name": "StartOpenAI",
    "nav.about": "TBD_JA",
    "nav.work": "TBD_JA",
    "nav.contact": "TBD_JA",
    "cta.get_in_touch": "TBD_JA",
  },
};

export function t(key: string, locale: Locale = defaultLocale): string {
  return strings[locale]?.[key] ?? strings[defaultLocale]?.[key] ?? key;
}

export function getLocalizedField<T>(
  field: Record<Locale, T> | undefined,
  locale: Locale = defaultLocale
): T | undefined {
  if (!field) return undefined;
  return field[locale] ?? field[defaultLocale];
}
