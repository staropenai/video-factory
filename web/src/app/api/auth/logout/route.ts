/**
 * POST /api/auth/logout
 *
 * Clears the auth token cookie, reverting the user to anonymous identity.
 * The UID cookie is preserved so quota history is maintained.
 *
 * RESPONSE (200 OK)
 *   { ok: true }
 */

import { NextRequest } from "next/server";
import { ok, rateLimited } from "@/lib/utils/api-response";
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit';

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`auth-logout:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.auth);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const res = ok({ loggedOut: true });

  // Clear auth token by setting it to empty with immediate expiry
  res.cookies.set("jtg_auth_token", "", {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });

  return res;
}
