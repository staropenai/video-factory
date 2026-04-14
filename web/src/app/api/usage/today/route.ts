/**
 * GET /api/usage/today
 *
 * Returns the current user's daily AI usage status.
 * Called by the /try page on load to populate the quota display.
 *
 * QUERY PARAMS
 *   lang (optional): locale string for resetAtText localisation.
 *
 * RESPONSE (200 OK)
 *   { ok, ...QuotaResponse }
 *
 * Uses buildQuotaResponse() to ensure consistent field names across
 * all quota-related endpoints.
 */

import { NextRequest } from "next/server";
import { resolveIdentity, buildCookieOptions } from "@/lib/auth/identity";
import { getUsageStatus } from "@/lib/quota/tracker";
import { buildQuotaResponse, deriveIdentityType } from "@/lib/quota/response";
import { toLang } from "@/lib/i18n/pick-localized";
import { ok, rateLimited } from "@/lib/utils/api-response";
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit';

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`usage-today:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const lang = toLang(req.nextUrl.searchParams.get("lang") ?? "zh");

  const identity = await resolveIdentity();
  const status = await getUsageStatus(
    identity.uid,
    identity.isAuthenticated,
    lang
  );

  const identityType = deriveIdentityType(identity.isAuthenticated);
  const quotaResponse = buildQuotaResponse(status, identityType);

  const res = ok(quotaResponse);

  // Set UID cookie if this is a first visit
  if (identity.isNewUid) {
    res.cookies.set("jtg_uid", identity.uid, buildCookieOptions());
  }

  return res;
}
