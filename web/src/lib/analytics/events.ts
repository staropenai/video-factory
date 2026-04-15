/**
 * src/lib/analytics/events.ts
 *
 * Single source of truth for every analytics event name.
 * Derived from JTG V3 spec §5.1 — must-track events.
 *
 * Usage:
 *   import { track, Events } from "@/lib/analytics/events";
 *   track(Events.FAQ_CLICK, { cardId: "deposit-refund", locale: "zh-Hans" });
 *
 * The track() function is fire-and-forget — it never throws or blocks the UI.
 * Replace the stub implementation with your real analytics backend.
 */

export const Events = {
  // Page lifecycle
  HOME_VIEW:               "home_view",
  HOME_DWELL:              "home_dwell",

  // Entry point clicks
  PRIMARY_ENTRY_CLICK:     "primary_entry_click",
  SECONDARY_ENTRY_CLICK:   "secondary_entry_click",

  // FAQ
  FAQ_CLICK:               "faq_click",
  FAQ_TAB_CLICK:           "faq_tab_click",

  // AI zone
  AI_OPEN:                 "ai_open",

  // Listing analysis — three input paths (§3.3 / §5.2)
  UPLOAD_SCREENSHOT:       "upload_screenshot",
  PASTE_LISTING_URL:       "paste_listing_url",
  TEXT_LISTING_SUBMIT:     "text_listing_submit",

  // Human help — two distinct paths (§3.4)
  HUMAN_HELP_CLICK:        "human_help_click",      // generic (before channel choice)
  CONTACT_CONFIRM_SUBMIT:  "contact_confirm_submit", // info-send path confirmed
  PHONE_CLICK:             "phone_click",            // direct call path

  // External navigation
  EXTERNAL_PLATFORM_CLICK: "external_platform_click",

  // Auth
  LOGIN_CLICK:             "login_click",

  // Language
  LANG_SWITCH:             "lang_switch",

  // V5 additions
  STAT_BANNER_CLICK:       "stat_banner_click",
  GUIDE_EXPAND:            "guide_expand",
  AI_STREAM_COMPLETE:      "ai_stream_complete",
  UPGRADE_HINT_SHOWN:      "upgrade_hint_shown",
  UPGRADE_HINT_CLICK:      "upgrade_hint_click",

  // V6 Trust & Transparency events
  TRUST_DASHBOARD_VIEW:    "trust_dashboard_view",
  TRUST_PROMISE_CLICK:     "trust_promise_click",
  EVIDENCE_VIEW:           "evidence_view",
  TRANSPARENCY_EXPAND:     "transparency_expand",
  RISK_DETAIL_VIEW:        "risk_detail_view",
  VERIFY_CENTER_VISIT:     "verify_center_visit",
  CONFIRM_SCOPE_MODIFY:    "confirm_scope_modify",
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

export interface TrackPayload {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Fire-and-forget analytics call.
 * Never throws. Never blocks the UI thread.
 * Sends events to /api/behavior for server-side persistence.
 */
export function track(event: EventName, payload?: TrackPayload): void {
  if (process.env.NODE_ENV !== "production") {
    try {
      const { devLog } = require("@/lib/utils/dev-log");
      devLog("[analytics]", event, payload ?? "");
    } catch {
      // dev-log unavailable (e.g. edge runtime) — silently skip
    }
  }

  fetch("/api/behavior", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, ...payload, ts: Date.now() }),
    keepalive: true,
  }).catch(() => {});
}
