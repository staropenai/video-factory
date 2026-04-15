// POST /api/behavior
// Fire-and-forget behavior event ingestion — persists to events table.

import { NextRequest } from "next/server";
import {
  checkRateLimit,
  extractClientIp,
} from "@/lib/security/rate-limit";
import { insertEvent } from "@/lib/db/tables";
import { ok, rateLimited } from "@/lib/utils/api-response";

const ALLOWED_EVENTS = new Set([
  "home_view", "home_dwell", "primary_entry_click", "secondary_entry_click",
  "faq_click", "faq_tab_click", "ai_open", "upload_screenshot", "paste_listing_url",
  "text_listing_submit", "human_help_click", "contact_confirm_submit",
  "phone_click", "external_platform_click", "login_click", "lang_switch",
  "stat_banner_click", "guide_expand", "ai_stream_complete",
  "upgrade_hint_shown", "upgrade_hint_click", "trust_dashboard_view",
  "trust_promise_click", "evidence_view", "transparency_expand",
  "risk_detail_view", "verify_center_visit", "confirm_scope_modify",
]);

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(
    `behavior:${extractClientIp(request.headers)}`,
    { windowMs: 60_000, maxRequests: 60 },
  );
  if (!rl.allowed) {
    return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));
  }

  try {
    const body = await request.json();
    const event = typeof body?.event === "string" ? body.event : null;
    if (!event || !ALLOWED_EVENTS.has(event)) return ok(null);

    const { event: _e, ts: _ts, ...rest } = body;
    insertEvent({
      eventType: "BEHAVIOR",
      route: "/api/behavior",
      relatedIds: {},
      metadata: { action: event, ...rest },
    });
    return ok(null);
  } catch {
    return ok(null);
  }
}
