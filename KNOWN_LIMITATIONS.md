# Known Limitations — V1.4

Last updated: 2026-04-09

## Data

- **8 FAQ items only.** Coverage is limited to initial costs, guarantor, utilities, registration, fire insurance, move-out, contract renewal, and viewing appointments. Many common topics (pets, share houses, corporate housing, specific neighborhoods) are not yet covered.
- **6 sources.** Source registry is minimal. Many FAQ items have only 1-2 backing sources. `v_stale_mappings` will flag items as stale after 30 days without re-verification.
- **No dynamic data.** Property listings, current availability, and market prices are not fetched. All cost estimates use static defaults.
- **Tokyo-centric defaults.** Cost formula assumes Tokyo-area norms (deposit/key money 1 month each). Other regions may differ significantly.

## Backend

- **In-memory sessions.** Sessions live in the Python process memory. Restarting the API server loses all sessions. Production needs DB-backed sessions.
- **No authentication.** The internal dashboard (`/internal`) has no access control. Anyone with the URL can view operational data and transition escalations.
- **Single-threaded HTTP server.** Uses stdlib `http.server` with no concurrency. Not suitable for production traffic.
- **Truncated UUIDs.** Decision IDs and escalation IDs use first 12 chars of UUID4. Collision risk is low but non-zero at scale.
- **Email not sent.** Escalation submissions log the email but never actually send notifications. Status is always `logged_not_sent`.

## Frontend

- **No locale switching.** Trilingual strings exist in `faq.ts` but the UI has no language toggle. All pages render in English.
- **No offline support.** All data requires the backend API to be running. No caching, service worker, or fallback data.
- **Session not persisted across tabs.** Uses `sessionStorage` (per-tab). Opening a new tab creates a new session.
- **No pagination.** FAQ list, escalation queue, and validation results all load everything at once.

## Decision Engine

- **Keyword-based classifier.** Query type classification uses simple string matching, not ML. Edge cases and multilingual queries may misclassify.
- **No learning loop.** Regression cases exist but the system doesn't automatically improve from corrections. Write-back candidates must be applied manually.
- **Source freshness is seeded.** All `last_verified_at` timestamps are set to seed time. No automated re-verification process exists.

## Security

- **CORS allows all origins.** The API sends `Access-Control-Allow-Origin: *`. Production must restrict this.
- **No rate limiting.** Any client can create unlimited sessions, escalations, and decisions.
- **No input sanitization beyond SQL parameterization.** XSS is mitigated by React's default escaping, but no server-side sanitization exists.
