# Release Checklist — V1.4

## Pre-flight

- [ ] `python3 init_db.py` — DB initializes without errors
- [ ] `python3 -m housing_os.api` — API starts, `/api/health` returns `{"status":"ok"}`
- [ ] `cd web && npm run build` — Next.js build completes with 0 errors
- [ ] `cd web && npx tsc --noEmit` — TypeScript passes with 0 errors

## Core Loop Verification

- [ ] Create session: `POST /api/session` returns session_id
- [ ] Read session: `GET /api/session/:id` returns session state
- [ ] Update intake: `PUT /api/session/:id` with intake data persists
- [ ] Route query: `POST /api/route` with query_text returns decision with decision_id
- [ ] Decision linked to session: session.decisions array includes decision_id
- [ ] Escalation submit: `POST /api/escalation` creates queue entry + decision
- [ ] Escalation visible in dashboard: `GET /api/escalation` includes new entry
- [ ] Escalation transition: `POST /api/escalation/:id/transition` changes queue_status
- [ ] Stats reflect changes: `GET /api/stats` counts match DB state

## Frontend Pages

- [ ] `/` — Homepage loads, links work
- [ ] `/knowledge` — FAQ list loads from backend, search works, expand shows sources
- [ ] `/start` — 4-step intake wizard completes, session persisted
- [ ] `/guidance` — Loads with session context, shows decision trace, cost estimate, FAQ
- [ ] `/cost` — Calculator renders, inputs update breakdown, assumptions visible
- [ ] `/escalation` — Form submits, success shows escalation_id, error shows message
- [ ] `/internal` — All 4 tabs load (overview, escalations, validation, rules)
- [ ] `/method` — Static content renders

## Validation Views

- [ ] `v_faq_incomplete` — 0 rows (all FAQ items have required fields)
- [ ] `v_low_confidence_violations` — 0 rows (no policy violations)
- [ ] `v_escalation_state_violations` — 0 rows (no invalid state transitions)
- [ ] `v_orphan_events` — 0 rows (all events reference valid escalations)
- [ ] `v_rule_integrity` — 0 rows (all rules have valid JSON fields)

## Regression

- [ ] `python3 -m housing_os.cli regression` — all 10 cases pass

## Known Issues Acknowledged

- [ ] Read `KNOWN_LIMITATIONS.md` — team aware of current gaps
- [ ] In-memory sessions acceptable for this release
- [ ] Email notifications are logged, not sent
- [ ] No authentication on internal dashboard
