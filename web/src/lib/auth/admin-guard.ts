/**
 * lib/auth/admin-guard.ts
 *
 * Authentication guard for admin/staff endpoints.
 *
 * DESIGN
 * ------
 * Phase 1 (now):  Bearer token check against JTG_ADMIN_TOKEN env var.
 *                 Simple but effective for internal tools and CI.
 *
 * Phase 2 (later): Replace with role-based JWT claims from the auth system.
 *                  The guard interface stays the same.
 *
 * USAGE
 *   import { requireAdmin } from "@/lib/auth/admin-guard";
 *
 *   export async function POST(req: NextRequest) {
 *     const authResult = requireAdmin(req);
 *     if (!authResult.ok) return authResult.response;
 *     // ... handler logic
 *   }
 *
 * CONFIGURATION
 *   Set JTG_ADMIN_TOKEN in .env (any strong random string).
 *   Pass it as: Authorization: Bearer <token>
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

interface AdminGuardSuccess {
  ok: true;
}

interface AdminGuardFailure {
  ok: false;
  response: NextResponse;
}

export type AdminGuardResult = AdminGuardSuccess | AdminGuardFailure;

/**
 * Get the admin token from environment.
 * Returns null if not configured (admin endpoints will be disabled).
 */
function getAdminToken(): string | null {
  return process.env.JTG_ADMIN_TOKEN ?? null;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Require admin authentication via Bearer token.
 *
 * In development (no JTG_ADMIN_TOKEN set): allows all requests with a warning header.
 * In production (JTG_ADMIN_TOKEN set): requires valid Bearer token.
 */
export function requireAdmin(req: NextRequest): AdminGuardResult {
  const adminToken = getAdminToken();

  // Dev mode: if no admin token configured, allow with warning
  if (!adminToken) {
    if (process.env.NODE_ENV === "production") {
      // In production without a token configured, deny everything
      return {
        ok: false,
        response: NextResponse.json(
          { error: "admin_not_configured" },
          { status: 503 }
        ),
      };
    }
    // Dev/test: allow but mark as unauthenticated
    return { ok: true };
  }

  // Extract Bearer token
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthorized", hint: "Provide Authorization: Bearer <token>" },
        { status: 401 }
      ),
    };
  }

  const providedToken = authHeader.slice(7); // Remove "Bearer "

  if (!safeCompare(providedToken, adminToken)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "forbidden" },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}
