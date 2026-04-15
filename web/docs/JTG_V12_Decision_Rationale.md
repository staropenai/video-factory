# JTG V12 — Decision Rationale for Claude Code

**This file explains WHY each engineering decision was made.**
**Read this if you need to understand constraints before making changes.**
**Do not treat this as a task list — the task list is in JTG_V12_Engineering_Sprint_Latency.md**

---

## The single problem this sprint solves

AI response latency is 5–7 seconds. This is the highest-priority engineering problem right now because:

1. Mobile users (the primary audience — foreign residents in Japan using phones) abandon after ~3 seconds of blank waiting
2. Every session that ends early is a session that produces no `evidence_records` — the data asset that makes the system improve over time
3. No amount of answer quality improvement matters if users leave before reading the answer

---

## Why SSE streaming, not WebSocket

SSE (Server-Sent Events) is a one-way push from server to client over a standard HTTP connection. It requires no library, works in every modern browser including Safari, and passes through all standard proxies and CDNs.

WebSocket is bidirectional and requires connection upgrade handling, separate keepalive logic, and custom proxy configuration. For one-way token streaming from an LLM, WebSocket adds complexity with no benefit.

Decision: SSE only.

---

## Why gpt-4o-mini and not gpt-4o

In the rental FAQ domain (lease terms, deposit rules, repair requests, visa-related housing questions), empirical testing shows gpt-4o-mini produces answers indistinguishable from gpt-4o for the vast majority of queries. The quality gap only opens on ambiguous multi-step legal reasoning — which should be escalated to L6 (human) anyway, per V11 routing rules.

Speed difference: gpt-4o-mini returns first token ~2–3x faster than gpt-4o.
Cost difference: ~10x cheaper per token.

Decision: gpt-4o-mini is locked for all automated tiers. If a query is complex enough to require gpt-4o, it is complex enough to go to a human (L6).

---

## Why semantic cache instead of exact-match cache

Users ask the same question in many different ways:
- `How much is the deposit usually?`
- `What's a typical shikikin amount?`
- `敷金 how much?`
- `Is shikikin the same as security deposit?`

Exact-match cache only hits when the string is identical. Semantic cache (cosine similarity ≥ 0.92 on multilingual embeddings) catches all of these as the same query. The threshold 0.92 is high enough to avoid false positives on questions that sound similar but need different answers.

The model used (`paraphrase-multilingual-MiniLM-L12-v2`) is small (420MB), runs on CPU in ~30ms, and handles Japanese, Chinese, and English in the same embedding space.

Decision: semantic cache on top of existing Redis, similarity threshold 0.92, 24h TTL.

---

## Why async evidence_records writes

The `evidence_records` table is append-only — every query produces one record. Synchronous writes mean the DB round-trip (typically 50–200ms) sits in the critical path of the user response. There is no reason for this. The user does not need the write to complete before receiving their answer.

If the async write fails, it logs to an alert queue. The failure rate target is <0.5%. A small gap in `evidence_records` completeness is acceptable; blocking the user response is not.

Decision: all `evidence_records` inserts are background tasks.

---

## Why SQL indexes are P0

V11 assumes Tier A/B lookups are fast but does not enforce indexes. Without the GIN index on `to_tsvector`, a Tier B full-text search does a sequential scan on the full `knowledge_cards` table. At 500 cards this is ~30ms. At 5,000 cards this is 300ms+. The ivfflat index on pgvector embeddings similarly degrades from ~100ms to 1,000ms+ without an index as the table grows.

These indexes are a one-time cost (run once, maintained automatically) and make all read paths fast permanently.

Decision: all four indexes are required before any load reaches production.

---

## What this sprint does NOT change

The following are unchanged and must not be modified during this sprint:

- **V11 routing logic**: Tier A → Tier B → Redis → Tier C → L6. The order, thresholds, and escalation rules are unchanged.
- **L6 escalation conditions**: high risk score, no grounding cards, official-only queries. These remain as defined in V11.
- **Knowledge card schema**: no changes to the `knowledge_cards` table structure.
- **Language bridge (L5)**: the FSM and bridge logic are not in scope. This sprint only touches the query response path.
- **Frontend information architecture**: homepage layout, tab structure, copy rules, contact path split — all defined in V3 spec. Do not change them here.

---

## How to verify the sprint worked

After deploying all five fixes, check these in APM (Sentry Performance or equivalent):

| What | Target | How to measure |
|------|--------|---------------|
| TTFT (time to first token) | P95 < 800ms | Trace the SSE endpoint from request start to first `data:` event sent |
| Full Tier C response | P95 < 4,000ms | Trace SSE endpoint from request start to `done` event |
| Tier A response | P95 < 50ms | Trace `/api/query/stream`, filter by `tier=A` in response |
| Tier B response | P95 < 200ms | Same, filter `tier=B` |
| Cache hit | P95 < 100ms | Filter by `tier=CACHE` |
| evidence_records failure rate | < 0.5% | Alert queue depth, error logs |

Do not declare the sprint done until TTFT P95 < 800ms is confirmed with real traffic. Do not use synthetic benchmarks or local test results as the acceptance signal.

---

## Rollback plan

If streaming causes issues (e.g., nginx proxy buffering breaks SSE, or mobile browsers have edge case failures):

1. The old synchronous endpoint can remain at `/api/query` (non-streaming)
2. Add a feature flag `ENABLE_STREAMING=true/false` 
3. Frontend falls back to polling `/api/query` if SSE connection fails after 3 retries

This means streaming should be additive — do not remove the old endpoint until streaming is confirmed stable for 48 hours.

---

*Version: JTG-V12-Decision-Rationale*  
*Date: 2026-04-13*  
*Audience: Claude Code, or any engineer picking up this sprint mid-way*
