# V5 Checklist vs Current State — V6 Gap Analysis

> Generated: 2026-04-12
> Method: Automated codebase scan + line-by-line evidence

## Status Legend

- `done` = Implemented with verifiable evidence (file path + export)
- `partial` = Infrastructure exists but incomplete (missing UI, alerting, or wiring)
- `not_done` = Not started
- `v6_new` = Not in V5, required by V6

---

## V5 Improvements vs Current State

| # | V5 Improvement | Module | Status | Evidence | Gap | V6 Action |
|---|---|---|---|---|---|---|
| 1 | Layer hit-rate pyramid (numeric targets) | Routing | `done` | `src/lib/routing/layer-stats.ts` exports `LAYER_TARGETS` (L1>=55%, L3<=25%, L4<=10%, L5<=15%, L6<=5%), `computeLayerHitRates()`, `classifyQueryLayer()` | No alerting when thresholds breached; no scheduled metric snapshots | P0-2: Add alert thresholds + metrics endpoint |
| 2 | `route_query()` pseudocode implementation | Core Router | `done` | `src/app/api/router/route.ts` (520 lines): understand -> retrieve -> decideRoute -> reconcile -> render -> audit. `src/lib/router/decide.ts`: deterministic rule pipeline | Rules are hardcoded in TS, not externalized to YAML | P1: Consider YAML externalization (low priority - TS rules are type-safe) |
| 3 | Triggered evidence presentation design | Frontend UI | `not_done` | No frontend component exists. `src/lib/domain/contracts.ts` has `SourceTag` with evidence fields but no UI renders them conditionally | Full frontend gap | P1-4: Build trust triangle card component |
| 4 | Language bridge scenario flow charts | Language Bridge | `partial` | `src/lib/domain/language-bridge.ts`: full bridge contract + validators + risk classifier. `src/app/api/bridge/route.ts`: working endpoint with LLM + deterministic fallback | No scenario flow chart templates (12 scenarios); no friction elimination checklist | P1-3: Build scenario template library |
| 5 | Layer 7 as full-pipeline infrastructure | Writeback | `done` | `src/lib/pipeline/writeback-hooks.ts`: `recordLayerHit()`, `shouldAutoPropose()`, `autoProposeFaqCandidate()`, `buildLayerHitEvent()`. `src/lib/domain/writeback.ts`: `ReviewDecision` validator, `DailyReviewSummary` | Hooks built but not yet wired into live router POST handler | P0-1: Wire `recordLayerHit` into router |
| 6 | Evidence Registry JSON structure | Knowledge | `done` | `src/lib/db/tables.ts`: `EvidenceRecord` (type, topicTags, location, confidenceLevel, expiryDate, linkedCardIds) + full CRUD. `src/lib/evidence/registry.ts`: `searchEvidenceRecords()`, `findExpiredRecords()`, `confidenceRank()` | No admin route for evidence CRUD; no scheduled expiry scan; no auto-attach to high-risk answers | P1-2: Build `/api/evidence` route + expiry cron |
| 7 | Three-tier commercialization tracking | Commercial | `not_done` | No conversion funnel tracking exists | Full gap | P2-4: Build funnel tracking |

## V6 New Requirements

| # | V6 Requirement | Status | Evidence | V6 Action |
|---|---|---|---|---|
| V6-1 | First principles validation (Hypothesis 1-4) | `v6_new` | No formalized hypothesis verification process | P0-1: Document in ENGINEERING_STANDARDS.md |
| V6-2 | Barrier quantification map | `v6_new` | No barrier thickness measurement system | P1: Build barrier metrics |
| V6-3 | Code fingerprint system (naming + directory + comments) | `partial` | ESLint config exists (`eslint.config.mjs`). Consistent patterns observed (camelCase funcs, PascalCase types, UPPER_SNAKE consts, JSDoc with section refs). No written standard. No pre-commit hooks. | P0-4: Create ENGINEERING_STANDARDS.md + pre-commit |
| V6-4 | Text fingerprint system (AI output style) | `not_done` | No `jtg_output_style_guide.yaml`. No brand glossary. | P1-1: Build style guide + automated checker |
| V6-5 | Blue team defense baseline | `partial` | Guardrails exist (`src/lib/validation/guardrails.ts`, `src/lib/guardrails/policy.ts`). Audit logging exists (`src/lib/audit/logger.ts`). High-risk keyword detection exists (`src/lib/rules/builtins.ts`). **Missing:** prompt injection filter, rate limiting, security event log, WAF config | P0-3: Build injection filter + security log |
| V6-6 | Red team attack playbook | `not_done` | No red team test suite or findings doc | P2-1: Build red team test cases |
| V6-7 | Metrics baseline document | `v6_new` | No quantified baseline exists | Task 0.2: Create metrics_baseline_v6.md |
| V6-8 | Knowledge card TF-IDF value scoring | `not_done` | Current scoring is deterministic keyword matching (`src/lib/knowledge/seed.ts` `scoreQueryAgainstSeeds()`). No frequency * scarcity * freshness formula. | P2-2: Build value scoring function |

## File Inventory Summary

### Domain Modules (src/lib/domain/)
| File | P-Level | Tests |
|---|---|---|
| `enums.ts` | P0 | jtg-spec |
| `contracts.ts` | P0 | jtg-spec, jtg-core |
| `knowledge-card.ts` | P1 | jtg-p1 (Tests 01-06) |
| `language-bridge.ts` | P1 | jtg-p1 (Tests 07-12) |
| `writeback.ts` | P1 | jtg-p1 (Tests 13-14) |
| `providers.ts` | P1 | jtg-p1 (Tests 15-18) |

### Infrastructure Modules
| File | P-Level | Tests |
|---|---|---|
| `evidence/registry.ts` | P2 | jtg-p2 (Tests 01-08) |
| `routing/layer-stats.ts` | P2 | jtg-p2 (Tests 09-16) |
| `pipeline/writeback-hooks.ts` | P2 | jtg-p2 (Tests 17-22) |
| `security/prompt-injection.ts` | V6-P0 | **TO BUILD** |
| `security/event-log.ts` | V6-P0 | **TO BUILD** |
| `routing/metrics.ts` | V6-P0 | **TO BUILD** |
| `pipeline/gap-detector.ts` | V6-P0 | **TO BUILD** |

### Test Suites
| File | Tests | Status |
|---|---|---|
| `jtg-core.test.ts` | 5 | Green |
| `jtg-spec.test.ts` | 8 | Green |
| `jtg-p1.test.ts` | 18 | Green |
| `jtg-p2.test.ts` | 24 | Green |
| `jtg-v6-p0.test.ts` | ~20 | **TO BUILD** |
| **Total** | **55 + ~20** | |

---

*Next: Task 0.2 (metrics_baseline_v6.md), then P0-1 through P0-4 execution.*
