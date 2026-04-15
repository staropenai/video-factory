// POST /api/behavior
// Fire-and-forget behavior event ingestion
// In production: write to PostgreSQL or analytics pipeline

import { NextRequest } from "next/server";
import {
  checkRateLimit,
  extractClientIp,
} from "@/lib/security/rate-limit";
import { ok, rateLimited } from "@/lib/utils/api-response";

export async function POST(request: NextRequest) {
  // Per-IP rate limit — telemetry ingestion, generous 60 req/min.
  const rl = checkRateLimit(
    `behavior:${extractClientIp(request.headers)}`,
    { windowMs: 60_000, maxRequests: 60 },
  );
  if (!rl.allowed) {
    return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));
  }

  try {
    await request.json();
    // In production: validate event shape, write to DB
    return ok(null);
  } catch {
    // Never return error to client — tracking must not break UI
    return ok(null);
  }
}
