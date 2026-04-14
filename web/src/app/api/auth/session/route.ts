/**
 * GET /api/auth/session
 *
 * Returns the current user's auth session status.
 * Used by the frontend to check if user is authenticated
 * and to display identity info.
 *
 * RESPONSE (200 OK)
 *   {
 *     ok: true,
 *     uid: string,
 *     isAuthenticated: boolean,
 *     email?: string,
 *     phone?: string,
 *     identityType: "anonymous" | "lead" | "authenticated"
 *   }
 */

import { NextRequest } from "next/server";
import { resolveIdentity, buildCookieOptions } from "@/lib/auth/identity";
import { deriveIdentityType } from "@/lib/quota/response";
import { ok, rateLimited } from "@/lib/utils/api-response";
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit';

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`auth-session:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.auth);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const identity = await resolveIdentity();

  const identityType = deriveIdentityType(identity.isAuthenticated);

  const res = ok({
    uid: identity.uid,
    isAuthenticated: identity.isAuthenticated,
    ...(identity.email ? { email: identity.email } : {}),
    ...(identity.phone ? { phone: identity.phone } : {}),
    identityType,
  });

  // Set UID cookie if first visit
  if (identity.isNewUid) {
    res.cookies.set("jtg_uid", identity.uid, buildCookieOptions());
  }

  return res;
}
