"use client";

import { useState } from "react";
import type { AiZoneData, UsageMeter, UpgradeHint, Locale } from "@/lib/jtg/types";
import { openAiSession } from "@/lib/jtg/api";
import { trackAiOpen } from "@/lib/jtg/track";

interface Props {
  data: AiZoneData;
  locale: Locale;
  onUsageUpdate?: (usage: UsageMeter) => void;
}

export function AiZone({ data, locale, onUsageUpdate }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState(data.usage);
  const [hint, setHint] = useState<UpgradeHint>(data.upgradeHint);
  const disabled = data.disabled || usage.remaining <= 0;

  async function handleSubmit() {
    if (disabled || !input.trim() || loading) return;
    setLoading(true);
    trackAiOpen("home_ai_zone");
    try {
      const res = await openAiSession(locale, "home_ai_zone");
      setUsage(res.usage);
      setHint(res.upgradeHint);
      onUsageUpdate?.(res.usage);
      // Navigate to AI chat with the question
      window.location.href = `/try?q=${encodeURIComponent(input)}&session=${res.sessionId}`;
    } catch {
      // Fallback: navigate without session
      window.location.href = `/try?q=${encodeURIComponent(input)}`;
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="ai-zone" className="mx-auto max-w-4xl px-4 py-12">
      <h2 className="text-2xl font-bold text-foreground">{data.title}</h2>
      <p className="mt-1 text-sm text-muted">{data.description}</p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={data.inputPlaceholder}
            disabled={disabled}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSubmit}
            disabled={disabled || loading || !input.trim()}
            className="shrink-0 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              data.submitLabel
            )}
          </button>
        </div>

        {/* Usage meter */}
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span>
            {usage.remaining > 0
              ? `今日剩余 ${usage.remaining}/${usage.limit} 次`
              : data.disabledReason || "今日额度已用完"}
          </span>
          <span>{usage.resetAtText}</span>
        </div>

        {/* Progress bar */}
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full transition-all ${
              usage.remaining <= 0 ? "bg-danger" : "bg-accent"
            }`}
            style={{ width: `${(usage.used / usage.limit) * 100}%` }}
          />
        </div>

        {/* Upgrade hint — lightweight inline, NOT a modal */}
        {hint.visible && hint.title && (
          <div className="mt-4 rounded-lg bg-accent-light px-4 py-3">
            <p className="text-sm font-medium text-foreground">{hint.title}</p>
            {hint.description && (
              <p className="mt-0.5 text-xs text-muted">{hint.description}</p>
            )}
            {hint.ctaLabel && hint.ctaHref && (
              <a
                href={hint.ctaHref}
                className="mt-2 inline-block text-xs font-medium text-accent underline underline-offset-2"
              >
                {hint.ctaLabel}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
