// GET /api/homepage/config?locale=zh-Hans
// Returns full homepage configuration for the given locale
// In production: fetch from CMS/DB. Now: returns mock data.

import { NextRequest } from "next/server";
import { ok, fail, rateLimited } from "@/lib/utils/api-response";
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit';
import { MOCK_CONFIG } from "@/lib/jtg/mock";
import type { Locale } from "@/lib/jtg/types";
import { LOCALES, FULL_SUPPORT_LOCALES } from "@/lib/jtg/types";

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(`homepage-config:${extractClientIp(request.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const locale = (request.nextUrl.searchParams.get("locale") ?? "zh-Hans") as Locale;

  if (!LOCALES.includes(locale)) {
    return fail("Invalid locale");
  }

  const supportLevel = FULL_SUPPORT_LOCALES.includes(locale)
    ? "full"
    : "core";

  const sessionId = `sess_${crypto.randomUUID().slice(0, 8)}`;

  // In production, build config per locale from DB/CMS.
  // For now, return mock with locale overrides.
  const config = {
    ...MOCK_CONFIG,
    pageMeta: {
      ...MOCK_CONFIG.pageMeta,
      locale,
      supportLevel,
      sessionId,
    },
    navBar: {
      ...MOCK_CONFIG.navBar,
      currentLocale: locale,
    },
  };

  return ok(config);
}
