// JTG — Locale detection & cookie management
// Priority: URL locale > cookie jtg_lang > browser language > fallback zh-Hans
// NO IP detection, NO nationality guessing

import type { Locale } from "./types";
import { LOCALES } from "./types";

export function isValidLocale(v: string): v is Locale {
  return LOCALES.includes(v as Locale);
}

export function detectLocale(
  urlLocale?: string,
  cookieLocale?: string,
  browserLangs?: readonly string[]
): Locale {
  // 1. URL
  if (urlLocale && isValidLocale(urlLocale)) return urlLocale;
  // 2. Cookie
  if (cookieLocale && isValidLocale(cookieLocale)) return cookieLocale;
  // 3. Browser
  if (browserLangs) {
    for (const lang of browserLangs) {
      const normalized = normalizeBrowserLang(lang);
      if (normalized) return normalized;
    }
  }
  // 4. Fallback
  return "zh-Hans";
}

function normalizeBrowserLang(lang: string): Locale | null {
  const lower = lang.toLowerCase();
  if (lower.startsWith("zh")) return "zh-Hans";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("en")) return "en";
  if (lower.startsWith("ko")) return "ko";
  if (lower.startsWith("vi")) return "vi";
  if (lower.startsWith("th")) return "th";
  return null;
}

export function setLocaleCookie(locale: Locale) {
  document.cookie = `jtg_lang=${locale};path=/;max-age=${365 * 24 * 3600};samesite=lax`;
}

export function getLocaleCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|; )jtg_lang=([^;]*)/);
  return match?.[1];
}
