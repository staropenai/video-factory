"use client";

import { useState, useEffect, useCallback } from "react";
import type { HomepageConfig, Locale, UsageMeter } from "@/lib/jtg/types";
import { fetchHomepageConfig, fetchUsageToday } from "@/lib/jtg/api";
import { initTracking, trackPageView } from "@/lib/jtg/track";
import { detectLocale, getLocaleCookie } from "@/lib/jtg/locale";
import { MOCK_CONFIG, MOCK_USAGE } from "@/lib/jtg/mock";

import { NavBar } from "./NavBar";
import { HeroZone } from "./HeroZone";
import { FaqZone } from "./FaqZone";
import { TrustZone } from "./TrustZone";
import { AiZone } from "./AiZone";
import { HumanHelpZone } from "./HumanHelpZone";
import { FooterZone } from "./FooterZone";

type LoadState = "loading" | "loaded" | "error";

interface Props {
  urlLocale?: string;
}

export function HomePage({ urlLocale }: Props) {
  const [config, setConfig] = useState<HomepageConfig | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [locale, setLocale] = useState<Locale>(() =>
    detectLocale(urlLocale, getLocaleCookie())
  );

  const loadConfig = useCallback(
    async (loc: Locale) => {
      setLoadState("loading");
      try {
        const [cfg, usage] = await Promise.all([
          fetchHomepageConfig(loc).catch(() => null),
          fetchUsageToday().catch(() => null),
        ]);

        const finalCfg = cfg ?? { ...MOCK_CONFIG, pageMeta: { ...MOCK_CONFIG.pageMeta, locale: loc } };
        if (usage) {
          finalCfg.aiZone = {
            ...finalCfg.aiZone,
            usage: usage.ai,
            disabled: usage.ai.remaining <= 0,
            disabledReason: usage.ai.remaining <= 0 ? "今日额度已用完" : undefined,
            upgradeHint: {
              visible: usage.ai.used >= 2,
              title: usage.ai.used >= 2 ? "你今天已经问了好几个问题" : undefined,
              description: usage.ai.used >= 2 ? "如果接下来还会频繁使用，可以升级更省事。" : undefined,
              ctaLabel: usage.ai.used >= 2 ? "查看升级说明" : undefined,
              ctaHref: usage.ai.used >= 2 ? "/pricing" : undefined,
            },
          };
        }

        setConfig(finalCfg);
        setLoadState("loaded");
        initTracking(finalCfg.pageMeta.sessionId, loc);
        trackPageView();
      } catch {
        // Use mock data as fallback
        setConfig({ ...MOCK_CONFIG, pageMeta: { ...MOCK_CONFIG.pageMeta, locale: loc } });
        setLoadState("error");
        initTracking(MOCK_CONFIG.pageMeta.sessionId, loc);
      }
    },
    []
  );

  useEffect(() => {
    loadConfig(locale);
  }, [locale, loadConfig]);

  function handleLocaleChange(newLocale: Locale) {
    setLocale(newLocale);
  }

  function handleUsageUpdate(usage: UsageMeter) {
    if (!config) return;
    setConfig({
      ...config,
      aiZone: {
        ...config.aiZone,
        usage,
        disabled: usage.remaining <= 0,
      },
    });
  }

  if (loadState === "loading" && !config) {
    return <LoadingSkeleton />;
  }

  if (!config) {
    return <ErrorState onRetry={() => loadConfig(locale)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar
        data={{ ...config.navBar, currentLocale: locale }}
        onLocaleChange={handleLocaleChange}
      />
      <HeroZone data={config.hero} />
      <FaqZone data={config.faqZone} locale={locale} />
      <TrustZone data={config.trustZone} />
      <AiZone
        data={config.aiZone}
        locale={locale}
        onUsageUpdate={handleUsageUpdate}
      />
      <HumanHelpZone data={config.humanHelp} />
      <FooterZone data={config.footer} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav skeleton */}
      <div className="h-14 border-b border-border bg-surface" />
      {/* Hero skeleton */}
      <div className="bg-gradient-to-b from-accent-light to-background px-4 pb-12 pt-16">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto h-8 w-64 animate-pulse rounded-md bg-border" />
          <div className="mx-auto mt-3 h-8 w-48 animate-pulse rounded-md bg-border" />
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-surface" />
            ))}
          </div>
        </div>
      </div>
      {/* FAQ skeleton */}
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="h-6 w-32 animate-pulse rounded bg-border" />
        <div className="mt-6 h-10 animate-pulse rounded-lg bg-border" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-lg font-medium text-foreground">页面加载失败</p>
        <p className="mt-1 text-sm text-muted">请检查网络后重试</p>
        <button
          onClick={onRetry}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90"
        >
          重试
        </button>
      </div>
    </div>
  );
}
