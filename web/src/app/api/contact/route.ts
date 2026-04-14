/**
 * POST /api/contact — persist a contact-form submission.
 *
 * Currently writes to the in-memory event table so it shows up in the
 * admin audit log. In production, swap with a real email / CRM sink.
 *
 * No auth required — this is a public form.
 * Rate limited with the "auth" preset (10 req/min) to discourage spam.
 */

import { NextRequest } from "next/server";
import { insertEvent } from "@/lib/db/tables";
import {
  checkRateLimit,
  extractClientIp,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rate-limit";
import { devLog } from "@/lib/utils/dev-log";
import { ok, fail } from "@/lib/utils/api-response";
import { sanitizeInput, isValidEmail, stripControlChars } from "@/lib/utils/sanitize";

export async function POST(req: NextRequest) {
  // Per-IP rate limit — use "auth" preset (10 req/min).
  const clientIp = extractClientIp(req.headers);
  const rateCheck = checkRateLimit(`contact:${clientIp}`, RATE_LIMIT_PRESETS.auth);
  if (!rateCheck.allowed) {
    return fail("rate_limited", 429);
  }

  let name = "";
  let email = "";
  let message = "";

  try {
    const body = await req.json();
    name = stripControlChars(sanitizeInput(String(body.name ?? ""), 200));
    email = sanitizeInput(String(body.email ?? ""), 200);
    message = stripControlChars(sanitizeInput(String(body.message ?? ""), 5000));
  } catch {
    return fail("invalid_body");
  }

  if (!name || !email || !message) {
    return fail("missing_fields");
  }

  if (!isValidEmail(email)) {
    return fail("invalid_email");
  }

  // Persist as an auditable event.
  insertEvent({
    eventType: "CONTACT_FORM_SUBMIT",
    route: "/api/contact",
    relatedIds: {},
    metadata: { name, email, messageLength: message.length },
  });

  devLog("[contact_api]", { name, email, messageLength: message.length });

  return ok(null);
}
