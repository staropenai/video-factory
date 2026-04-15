/**
 * lib/auth/session-token.ts
 *
 * Standalone HMAC session token module.
 * No jose dependency — uses only Node.js crypto.
 *
 * PURPOSE
 * -------
 * After /api/ai/session/open consumes a quota unit, it issues a short-lived
 * session token. The /api/router verifies this token to confirm quota was
 * already consumed, preventing double-counting.
 *
 * TOKEN FORMAT
 *   base64url(JSON({ payload: "uid:timestamp:nonce", sig: HMAC-SHA256 }))
 *
 * SECURITY NOTES
 * - 5-minute TTL (>= boundary: token at exactly TTL is expired)
 * - Nonce prevents same-millisecond collision
 * - Constant-time comparison via timingSafeEqual
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// --- Constants ---

export const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

// --- Secret ---

function getHmacSecret(): string {
  const secret =
    process.env.JTG_SESSION_SECRET ??
    process.env.JTG_JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error(
      "JTG_SESSION_SECRET (or JTG_JWT_SECRET) environment variable is not set"
    );
  }
  return secret ?? "dev-only-session-secret";
}

// --- Issue ---

/**
 * Issue a session token for the given UID.
 * Includes a random nonce to guarantee uniqueness even for
 * sub-millisecond concurrent calls.
 */
export function issueSessionToken(uid: string): string {
  const ts = Date.now();
  const nonce = randomBytes(8).toString("hex");
  const payload = `${uid}:${ts}:${nonce}`;
  const sig = createHmac("sha256", getHmacSecret())
    .update(payload)
    .digest("base64url");
  return Buffer.from(JSON.stringify({ payload, sig })).toString("base64url");
}

// --- Verify ---

/**
 * Verify a session token.
 * Returns { valid: true } on success, or { valid: false, reason } on failure.
 *
 * Uses constant-time comparison to prevent timing attacks on the signature.
 * TTL uses >= (token at exactly TTL milliseconds is expired).
 */
export function verifySessionToken(
  token: string,
  expectedUid: string
): { valid: boolean; reason?: string } {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const { payload, sig } = JSON.parse(decoded);

    if (typeof payload !== "string" || typeof sig !== "string") {
      return { valid: false, reason: "malformed" };
    }

    // Parse "uid:timestamp:nonce"
    const parts = (payload as string).split(":");
    if (parts.length < 2) return { valid: false, reason: "malformed" };

    const uid = parts[0];
    const ts = Number(parts[1]);

    if (!uid || isNaN(ts)) return { valid: false, reason: "malformed" };
    if (uid !== expectedUid) return { valid: false, reason: "uid_mismatch" };

    // TTL check: >= means token at exactly TTL is expired
    if (Date.now() - ts >= SESSION_TTL_MS) {
      return { valid: false, reason: "expired" };
    }

    // Constant-time signature comparison
    const expected = createHmac("sha256", getHmacSecret())
      .update(payload)
      .digest("base64url");

    const sigBuf = Buffer.from(sig, "utf-8");
    const expectedBuf = Buffer.from(expected, "utf-8");

    if (sigBuf.length !== expectedBuf.length) {
      return { valid: false, reason: "bad_sig" };
    }

    if (!timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false, reason: "bad_sig" };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "malformed" };
  }
}
