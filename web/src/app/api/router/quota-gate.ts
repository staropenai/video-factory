/**
 * app/api/router/quota-gate.ts
 *
 * Extracted quota enforcement logic for the /api/router endpoint.
 *
 * Two enforcement paths:
 *   Path A — Session token: client called /api/ai/session/open, quota was
 *            consumed there. Router only verifies the token.
 *   Path B — Direct call (legacy/debug/curl): consume quota inline.
 *            MONITOR: Track via audit log; deprecate once all clients
 *            migrate to session tokens.
 *
 * Also enforces message length validation (2000 chars max).
 */

import { verifySessionToken } from "@/lib/auth/session-token";
import { consumeQuota } from "@/lib/quota/tracker";
import {
  checkRateLimit,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rate-limit";
import { fail, rateLimited, unauthorized } from "@/lib/utils/api-response";
import type { Identity } from "@/lib/auth/identity";
import type { Language } from "@/lib/ai/types";

interface QuotaGateSuccess {
  ok: true;
}

interface QuotaGateFailure {
  ok: false;
  response: Response;
}

export type QuotaGateResult = QuotaGateSuccess | QuotaGateFailure;

/**
 * Per-IP rate limit check for AI routes (30 req/min).
 */
export function enforceRateLimit(clientIp: string): QuotaGateResult {
  const result = checkRateLimit(`ai:${clientIp}`, RATE_LIMIT_PRESETS.ai);
  if (!result.allowed) {
    const retryAfterSec = Math.ceil((result.retryAfterMs ?? 60000) / 1000);
    return {
      ok: false,
      response: rateLimited(retryAfterSec),
    };
  }
  return { ok: true };
}

/**
 * Validate message length. Returns a 400 response if too long.
 */
export function validateMessageLength(
  message: string,
  requestId: string,
  maxLength = 2000
): QuotaGateResult {
  if (message.length > maxLength) {
    return {
      ok: false,
      response: fail("message_too_long", 400, "MESSAGE_TOO_LONG"),
    };
  }
  return { ok: true };
}

/**
 * Enforce quota via session token (Path A) or direct consumption (Path B).
 *
 * @param sessionToken - From request body, if client obtained one from session/open
 * @param identity     - Resolved caller identity
 * @param lang         - Detected language for resetAtText localisation
 * @param requestId    - For debug response
 */
export async function enforceQuota(
  sessionToken: string | undefined,
  identity: Identity & { isNewUid: boolean },
  lang: Language,
  requestId: string,
  idempotencyKey?: string
): Promise<QuotaGateResult> {
  if (sessionToken) {
    // Path A: verify session token — quota already consumed at session/open
    const check = verifySessionToken(sessionToken, identity.uid);
    if (!check.valid) {
      return {
        ok: false,
        response: unauthorized(),
      };
    }
    return { ok: true };
  }

  // Path B: direct call — consume quota inline
  // V5 T4: pass idempotency key for dedup when Redis is available
  const status = await consumeQuota(identity.uid, identity.isAuthenticated, lang, idempotencyKey);
  if (status.blocked) {
    const retryAfterSec = 3600; // ~1 hour for daily quota reset
    return {
      ok: false,
      response: rateLimited(retryAfterSec),
    };
  }

  return { ok: true };
}
