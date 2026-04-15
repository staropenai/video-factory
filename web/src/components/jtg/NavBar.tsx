"use client";

import { useState, useRef, useEffect } from "react";
import type { NavBarData, Locale } from "@/lib/jtg/types";
import { setLocaleCookie } from "@/lib/jtg/locale";
import { switchLanguage } from "@/lib/jtg/api";
import { trackHeroEntryClick, trackLangSwitch } from "@/lib/jtg/track";

interface Props {
  data: NavBarData;
  onLocaleChange: (locale: Locale) => void;
}

export function NavBar({ data, onLocaleChange }: Props) {
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleLocaleSwitch(code: Locale) {
    trackLangSwitch(data.currentLocale, code);
    setLocaleCookie(code);
    switchLanguage(data.currentLocale, code).catch(() => {});
    onLocaleChange(code);
    setLangOpen(false);
  }

  const currentLabel =
    data.localeOptions.find((o) => o.code === data.currentLocale)?.shortLabel ??
    "中文";

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <a href="/" className="text-lg font-bold text-accent">
          {data.logoText}
        </a>

        {/* Desktop entries */}
        <div className="hidden items-center gap-6 md:flex">
          {data.entries.map((e) => (
            <a
              key={e.key}
              href={e.href}
              className="text-sm text-foreground/80 hover:text-accent transition-colors"
              onClick={() => trackHeroEntryClick(e.key, "nav")}
            >
              {e.label}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Language switcher */}
          <div ref={langRef} className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent-light transition-colors"
              aria-label="Switch language"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c2.5 2.8 4 6 4 9s-1.5 6.2-4 9c-2.5-2.8-4-6-4-9s1.5-6.2 4-9z" />
              </svg>
              {currentLabel}
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-border bg-surface shadow-lg">
                {data.localeOptions.map((opt) => (
                  <button
                    key={opt.code}
                    onClick={() => handleLocaleSwitch(opt.code)}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-accent-light transition-colors ${
                      opt.code === data.currentLocale
                        ? "font-medium text-accent"
                        : "text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Help link */}
          <a
            href={data.helpLink.href}
            className="hidden text-xs text-muted hover:text-accent md:block"
          >
            {data.helpLink.label}
          </a>

          {/* Account link */}
          {data.accountLink.visible && (
            <a
              href={data.accountLink.href}
              className="hidden rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 transition-colors md:block"
            >
              {data.accountLink.label}
            </a>
          )}

          {/* Mobile menu */}
          <button
            className="md:hidden p-1"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="border-t border-border bg-surface px-4 py-3 md:hidden">
          {data.entries.map((e) => (
            <a
              key={e.key}
              href={e.href}
              className="block py-2 text-sm text-foreground/80"
              onClick={() => trackHeroEntryClick(e.key, "nav")}
            >
              {e.label}
            </a>
          ))}
          <a href={data.helpLink.href} className="block py-2 text-sm text-muted">
            {data.helpLink.label}
          </a>
          {data.accountLink.visible && (
            <a href={data.accountLink.href} className="mt-2 block rounded-md bg-accent px-3 py-2 text-center text-sm text-white">
              {data.accountLink.label}
            </a>
          )}
        </div>
      )}
    </nav>
  );
}
