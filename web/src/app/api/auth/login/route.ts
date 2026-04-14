/**
 * POST /api/auth/login
 *
 * Accepts a contact form submission (email or phone) and issues a
 * signed JWT auth cookie, upgrading the user from anonymous (30/day)
 * to authenticated (50/day) quota.
 *
 * REQUEST BODY (JSON)
 *   { email?: string; phone?: string }  — at least one required
 *
 * RESPONSE (200 OK)
 *   Sets cookies: jtg_uid, jtg_auth_token
 *   { ok: true, uid: string, quota: 50 }
 *
 * RESPONSE (400 Bad Request)
 *   { ok: false, error: "email_or_phone_required" }
 */

import { NextRequest } from "next/server";
import {
  resolveIdentity,
  issueAuthToken,
  buildCookieOptions,
} from "@/lib/auth/identity";
import { QUOTA_AUTHENTICATED } from "@/lib/quota/tracker";
import {
  checkRateLimit,
  extractClientIp,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rate-limit";
import { ok, fail, rateLimited } from "@/lib/utils/api-response";

// --- Validation helpers ---

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-().]{6,19}$/;

function isValidEmail(v: string) {
  return EMAIL_RE.test(v.trim());
}
function isValidPhone(v: string) {
  return PHONE_RE.test(v.trim().replace(/\s+/g, " "));
}

// --- Handler ---

export async function POST(req: NextRequest) {
  // Per-IP rate limit — auth routes are stricter (10 req/min)
  const clientIp = extractClientIp(req.headers);
  const rateCheck = checkRateLimit(`auth:${clientIp}`, RATE_LIMIT_PRESETS.auth);
  if (!rateCheck.allowed) {
    return rateLimited(Math.ceil(rateCheck.retryAfterMs / 1000));
  }

  let body: { email?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_json");
  }

  const email = typeof body.email === "string" ? body.email.trim() : undefined;
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;

  const emailOk = email && isValidEmail(email);
  const phoneOk = phone && isValidPhone(phone);

  if (!emailOk && !phoneOk) {
    return fail("email_or_phone_required");
  }

  const identity = await resolveIdentity();
  const uid = identity.uid;

  const token = await issueAuthToken({
    uid,
    ...(emailOk ? { email } : {}),
    ...(phoneOk ? { phone } : {}),
  });

  const cookieOpts = buildCookieOptions();

  const res = ok({
    uid,
    quota: QUOTA_AUTHENTICATED,
  });

  res.cookies.set("jtg_uid", uid, cookieOpts);
  res.cookies.set("jtg_auth_token", token, cookieOpts);

  return res;
}
