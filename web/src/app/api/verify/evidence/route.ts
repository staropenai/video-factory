/**
 * GET /api/verify/evidence?hash={sha256_hex}
 *
 * maturity: skeleton
 * notEquivalentTo: not a blockchain explorer. Queries local evidence_records.
 *   When evidence_records is not yet populated, returns found: false for all queries.
 *
 * Rate limit: 10 req/min per IP (more restrictive — hash enumeration prevention)
 */

import { NextRequest } from "next/server";
import { ok, fail, rateLimited } from "@/lib/utils/api-response";
import {
  checkRateLimit,
  extractClientIp,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rate-limit";

export async function GET(req: NextRequest) {
  // Strict rate limit — prevent hash enumeration
  const rl = checkRateLimit(
    `verify:${extractClientIp(req.headers)}`,
    RATE_LIMIT_PRESETS.strict,
  );
  if (!rl.allowed) {
    return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));
  }

  const hash = req.nextUrl.searchParams.get("hash");

  // Validate: must be a 64-char hex string (SHA-256)
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
    return fail("invalid_hash_format", 400);
  }

  // TODO: query evidence_records table when it is populated
  // For now return skeleton response
  return ok({
    found: false,
    verificationMethod:
      "Compute SHA-256 of the original analysis JSON and compare with the provided hash. An exact match confirms the content has not changed since the record was created.",
    // note: Do NOT return: raw analysis content, user identifiers, internal IDs
  });
}
