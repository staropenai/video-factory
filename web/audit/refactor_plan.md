# JTG Refactor Plan
Generated: 2026-04-15T00:00:00Z

## Items Already Present (No Action Needed)

The following items from the V4 spec already exist in the codebase and require no changes:

| Spec Item | Existing File | Status |
|-----------|--------------|--------|
| A-1: .gitignore | .gitignore (has .env*, .env*.local) | SKIP |
| A-2: .env.example | .env.example | SKIP |
| A-4: CODEOWNERS | ../.github/CODEOWNERS (with @staropenai) | SKIP |
| A-6: logger utility | src/lib/utils/dev-log.ts + src/lib/audit/logger.ts | SKIP |
| A-7: console.log cleanup | Only in logger utilities, no raw console.log in business code | SKIP |
| A-8: sanitize utility | src/lib/utils/sanitize.ts | SKIP |
| A-9: api-response utility | src/lib/utils/api-response.ts | SKIP |
| A-11: GitHub workflows | .github/workflows/daily-inspection.yml + protected-paths.yml | SKIP |
| A-12: streaming CSS | src/styles/streaming.css (already imported) | SKIP — verify existence |
| B-1: Rate limit utility | src/lib/security/rate-limit.ts (Redis + in-memory) | EXISTS — but need to wire to ungated routes |
| B-2: Quota manager | src/lib/quota/tracker.ts (Redis + in-memory) | SKIP |
| B-3: Auth session skeleton | src/lib/auth/identity.ts + session-token.ts + auth routes | SKIP |
| B-4: SSE streaming endpoint | src/app/api/router/stream/route.ts | SKIP |
| B-5: useStreamQuery hook | src/hooks/useStreamQuery.ts | SKIP |
| B-6: SQL indexes | Tier C — blocked | SKIP |
| Pre-commit hook | .husky/pre-commit (already has secret scanning) | SKIP |

## Planned Actions

- id: PLAN-001
  auditRef: AUDIT-005
  priority: P0
  files: [26 ungated API route files — see list below]
  goal: Add rate limiting to all ungated API routes
  approach: Import checkRateLimit + extractClientIp + RATE_LIMIT_PRESETS from @/lib/security/rate-limit and add rate limit check at top of each handler. Use appropriate presets: `api` (60/min) for general routes, `ai` (30/min) for AI-adjacent routes, `strict` (5/min) for sensitive routes, `auth` (10/min) for auth routes.
  risks: Legitimate high-frequency internal calls may be blocked. Mitigated by generous limits.
  behaviorImpact: Abusive clients will receive 429 responses
  dbMigrationNeeded: no
  testsNeeded: existing rate-limit tests cover the utility; route-level testing via integration
  approvalTier: B
  maturity: production-ready
  notEquivalentTo: n/a

  Routes to gate (grouped by preset):

  **api preset (60/min):**
  - src/app/api/metrics/route.ts
  - src/app/api/homepage/config/route.ts
  - src/app/api/health/route.ts
  - src/app/api/i18n/switch/route.ts
  - src/app/api/usage/today/route.ts
  - src/app/api/analytics/route.ts
  - src/app/api/pricing/summary/route.ts
  - src/app/api/knowledge/graph/route.ts
  - src/app/api/cases/route.ts
  - src/app/api/cases/[id]/route.ts

  **ai preset (30/min):**
  - src/app/api/bridge/route.ts
  - src/app/api/bridge/session/route.ts
  - src/app/api/router/route.ts
  - src/app/api/router/stream/route.ts
  - src/app/api/judgment/route.ts
  - src/app/api/sensing/scan/route.ts
  - src/app/api/evidence/route.ts
  - src/app/api/evidence/expired/route.ts
  - src/app/api/handoff/resolve/route.ts

  **auth preset (10/min):**
  - src/app/api/auth/logout/route.ts
  - src/app/api/auth/session/route.ts

  **api preset (60/min) — admin/review routes:**
  - src/app/api/review/route.ts
  - src/app/api/review/stats/route.ts
  - src/app/api/review/daily-summary/route.ts
  - src/app/api/review/faq-candidates/[id]/route.ts
  - src/app/api/review/faq-candidates/[id]/publish/route.ts
  - src/app/api/templates/route.ts
  - src/app/api/templates/promote/route.ts
  - src/app/api/templates/[id]/route.ts

- id: PLAN-002
  auditRef: AUDIT-003
  priority: P2
  files: [.gitleaks.toml]
  goal: Add gitleaks configuration for CI secret scanning
  approach: Create .gitleaks.toml with OpenAI and Supabase key patterns
  risks: none
  behaviorImpact: none
  dbMigrationNeeded: no
  testsNeeded: no
  approvalTier: A
  maturity: production-ready
  notEquivalentTo: n/a

- id: PLAN-003
  auditRef: AUDIT-005
  priority: P2
  files: [audit/github_manual_steps.md]
  goal: Document manual GitHub configuration steps
  approach: Create checklist for repo owner (branch protection, secret scanning, etc.)
  risks: none
  behaviorImpact: none
  dbMigrationNeeded: no
  testsNeeded: no
  approvalTier: A
  maturity: production-ready
  notEquivalentTo: n/a

- id: PLAN-004
  auditRef: AUDIT-016
  priority: P2
  files: [audit/files_to_review.md]
  goal: Generate list of files needing review (stubs, small files, debt items)
  approach: Scan for <5 line files and remaining TODO/FIXME
  risks: none
  behaviorImpact: none
  dbMigrationNeeded: no
  testsNeeded: no
  approvalTier: A
  maturity: production-ready
  notEquivalentTo: n/a

- id: PLAN-005
  auditRef: AUDIT-012
  priority: P3
  files: [SQL index statements]
  goal: Add pgvector/GIN indexes to knowledge_cards
  approach: Blocked — Tier C (DB schema changes)
  risks: n/a
  behaviorImpact: n/a
  dbMigrationNeeded: yes
  testsNeeded: n/a
  approvalTier: C
  maturity: n/a
  notEquivalentTo: n/a

## Approval Summary

| Tier | Items | Auto-execute? |
|------|-------|---------------|
| A | PLAN-002, PLAN-003, PLAN-004 | Yes |
| B | PLAN-001 (rate limit wiring) | Requires approval |
| C | PLAN-005 (SQL indexes) | Blocked |
