// POST /api/i18n/switch
// Records language switch event server-side

import { NextRequest } from "next/server";
import { LOCALES } from "@/lib/jtg/types";
import type { Locale } from "@/lib/jtg/types";
import { ok, fail, rateLimited } from "@/lib/utils/api-response";
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit';

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`i18n-switch:${extractClientIp(request.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const body = await request.json();
  const { toLocale } = body as { fromLocale: Locale; toLocale: Locale };

  if (!LOCALES.includes(toLocale)) {
    return fail("Invalid locale");
  }

  // In production: update user preference in DB
  return ok({ locale: toLocale });
}
