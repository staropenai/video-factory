/**
 * POST /api/ai/session/open
 *
 * Gate that must be called before opening an AI session.
 * Consumes one quota unit. If the user is over their daily limit,
 * returns 429 and the front-end must disable submission.
 *
 * REQUEST BODY (JSON)
 *   { lang?: string }
 *
 * RESPONSE (200 OK) — quota consumed
 *   { ok, sessionToken, ...QuotaResponse }
 *
 * RESPONSE (429 Too Many Requests)
 *   { ok: false, error: "quota_exceeded", remaining: 0, resetAtText }
 *
 * SESSION TOKEN
 *   A short-lived HMAC token: base64url(JSON({ payload, sig })).
 *   /api/router verifies this token to confirm that session/open was called.
 *   TTL: 5 minutes. Includes nonce for sub-millisecond uniqueness.
 */

import { NextRequest } from "next/server";
import { resolveIdentity, buildCookieOptions } from "@/lib/auth/identity";
import { consumeQuota } from "@/lib/quota/tracker";
import { buildQuotaResponse, deriveIdentityType } from "@/lib/quota/response";
import { issueSessionToken } from "@/lib/auth/session-token";
import { toLang } from "@/lib/i18n/pick-localized";
import {
  checkRateLimit,
  extractClientIp,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rate-limit";
import { ok, fail, rateLimited } from "@/lib/utils/api-response";

// --- Handler ---

export async function POST(req: NextRequest) {
  // Per-IP rate limit — AI routes (30 req/min)
  const clientIp = extractClientIp(req.headers);
  const rateCheck = checkRateLimit(`ai:${clientIp}`, RATE_LIMIT_PRESETS.ai);
  if (!rateCheck.allowed) {
    return rateLimited(Math.ceil(rateCheck.retryAfterMs / 1000));
  }

  let lang = "zh";
  try {
    const body = await req.json();
    lang = typeof body?.lang === "string" ? body.lang : lang;
  } catch {
    // body is optional
  }

  const resolvedLang = toLang(lang);
  const identity = await resolveIdentity();

  const status = await consumeQuota(
    identity.uid,
    identity.isAuthenticated,
    resolvedLang
  );

  // Build base response with UID cookie if needed
  const setCookieOpts = identity.isNewUid
    ? [["jtg_uid", identity.uid, buildCookieOptions()] as const]
    : [];

  if (status.blocked) {
    const res = fail("quota_exceeded", 429);
    for (const [name, value, opts] of setCookieOpts) {
      res.cookies.set(name, value, opts);
    }
    return res;
  }

  const sessionToken = issueSessionToken(identity.uid);
  const identityType = deriveIdentityType(identity.isAuthenticated);
  const quotaResponse = buildQuotaResponse(status, identityType);

  const res = ok({
    sessionToken,
    ...quotaResponse,
  });

  for (const [name, value, opts] of setCookieOpts) {
    res.cookies.set(name, value, opts);
  }

  return res;
}
