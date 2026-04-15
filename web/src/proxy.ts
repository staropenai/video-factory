/**
 * proxy.ts — Next.js 16 Proxy (formerly middleware.ts)
 *
 * Security layer: CORS enforcement + security headers on all responses.
 * Runs before routes are rendered.
 *
 * JTG Security V2: S6 (CORS whitelist) + T3 (security headers)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/* ── CORS origin whitelist ─────────────────────────────────────────
 * Set ALLOWED_ORIGINS in Vercel env vars (comma-separated).
 * Example: "https://jtg.example.com,https://staging.jtg.example.com"
 * If not set, same-origin requests only (no cross-origin allowed).
 * NEVER use wildcard "*" — that defeats the purpose.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CORS_METHODS = "GET, POST, OPTIONS";
const CORS_HEADERS = "Content-Type, Authorization, x-idempotency-key";

/* ── Security headers (applied to ALL responses) ───────────────── */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-DNS-Prefetch-Control": "on",
};

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin);

  // ── Handle CORS preflight (OPTIONS) ────────────────────────────
  if (request.method === "OPTIONS") {
    const preflightHeaders: Record<string, string> = {
      "Access-Control-Allow-Methods": CORS_METHODS,
      "Access-Control-Allow-Headers": CORS_HEADERS,
      "Access-Control-Max-Age": "86400",
      ...SECURITY_HEADERS,
    };
    if (isAllowedOrigin) {
      preflightHeaders["Access-Control-Allow-Origin"] = origin;
    }
    return NextResponse.json({}, { headers: preflightHeaders });
  }

  // ── Normal request: attach security headers + CORS ─────────────
  const response = NextResponse.next();

  // Security headers on every response
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // CORS: only set Allow-Origin for whitelisted origins
  if (isAllowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
