/**
 * components/QuotaDisplay.tsx
 *
 * Drop-in UI component that renders the quota state bar
 * in the /try (AI chat) page.
 *
 * COPY RULES (strictly from spec)
 * - Show remaining count
 * - Show resetAtText when blocked
 * - Show upgrade hint when used >= 20 (soft, restrained)
 * - Never: "限时" "最后机会" "不升级无法继续" "立刻购买"
 */

"use client";

import React from "react";
import type { QuotaState } from "@/lib/hooks/useQuota";

// --- Copy strings ---

const COPY: Record<
  string,
  {
    remaining: (n: number, limit: number) => string;
    blocked: (resetAt: string) => string;
    hint: string;
    hintLink: string;
  }
> = {
  zh: {
    remaining: (n, l) => `今日剩余 ${n}/${l} 次`,
    blocked: (r) => `今日额度已用完。${r}`,
    hint: "使用较频繁，如需更多次数可以了解升级选项。",
    hintLink: "了解更多",
  },
  en: {
    remaining: (n, l) => `${n} of ${l} daily uses left`,
    blocked: (r) => `Daily limit reached. ${r}`,
    hint: "You've been solving a lot. Upgrading makes it easier.",
    hintLink: "See plans",
  },
  ja: {
    remaining: (n, l) => `本日の残り回数 ${n}/${l}`,
    blocked: (r) => `本日の回数制限に達しました。${r}`,
    hint: "最近よく使っていますね。アップグレードすると便利です。",
    hintLink: "プランを見る",
  },
  ko: {
    remaining: (n, l) => `오늘 남은 횟수 ${n}/${l}`,
    blocked: (r) => `오늘 한도를 모두 사용했습니다. ${r}`,
    hint: "자주 사용하고 계시네요. 업그레이드하면 더 편리합니다.",
    hintLink: "플랜 보기",
  },
  vi: {
    remaining: (n, l) => `Còn ${n}/${l} lượt hôm nay`,
    blocked: (r) => `Đã hết lượt hôm nay. ${r}`,
    hint: "Bạn đang xử lý nhiều vấn đề. Nâng cấp để tiện hơn.",
    hintLink: "Xem gói",
  },
  th: {
    remaining: (n, l) => `เหลือ ${n}/${l} ครั้งวันนี้`,
    blocked: (r) => `ใช้ครบโควต้าวันนี้แล้ว ${r}`,
    hint: "คุณใช้บ่อยมากเลย อัปเกรดจะสะดวกกว่า",
    hintLink: "ดูแผน",
  },
  "zh-Hant": {
    remaining: (n, l) => `今日剩餘 ${n}/${l} 次`,
    blocked: (r) => `今日額度已用完。${r}`,
    hint: "使用較頻繁，如需更多次數可以了解升級選項。",
    hintLink: "了解更多",
  },
};

function getCopy(lang: string) {
  return COPY[lang] ?? COPY["zh"];
}

// --- Component ---

interface Props {
  quota: QuotaState;
  lang?: string;
  /** href for the upgrade hint link; defaults to "/contact" */
  upgradeHref?: string;
}

export default function QuotaDisplay({
  quota,
  lang = "zh",
  upgradeHref = "/contact",
}: Props) {
  // Don't render until we have real data from the server
  if (!quota.ready) return null;

  const copy = getCopy(lang);
  const pct = Math.max(0, Math.min(100, (quota.remaining / quota.limit) * 100));

  // Blocked state
  if (quota.blocked) {
    return (
      <div
        className="px-3 py-2.5 rounded-lg bg-neutral-100 text-neutral-500 text-xs"
        role="status"
        aria-live="polite"
      >
        <span>{copy.blocked(quota.resetAtText)}</span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-1.5 text-xs text-neutral-500"
      role="status"
      aria-live="polite"
    >
      {/* Count row */}
      <div className="flex items-center gap-2">
        {/* Progress bar */}
        <div
          className="flex-1 h-1 rounded-full bg-neutral-200 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              backgroundColor:
                pct > 30 ? "var(--accent, #1b5e3b)" : "#e57373",
            }}
          />
        </div>
        <span className="whitespace-nowrap">
          {copy.remaining(quota.remaining, quota.limit)}
        </span>
      </div>

      {/* Upgrade hint (shown at >= 20 uses, not at hard block) */}
      {quota.showUpgradeHint && (
        <div className="flex gap-1 items-baseline">
          <span>{copy.hint}</span>
          <a
            href={upgradeHref}
            className="text-[var(--accent,#1b5e3b)] underline whitespace-nowrap"
          >
            {copy.hintLink}
          </a>
        </div>
      )}
    </div>
  );
}
