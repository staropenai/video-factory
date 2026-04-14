# Metrics Baseline V6

> Generated: 2026-04-12
> Source: Codebase analysis + configuration values (no live traffic data yet)

## Methodology

This baseline is derived from **code-level configuration values and test assertions**, not from production traffic. The system runs on JSONL file-backed persistence (`/tmp` on Vercel, `.data/` locally) and has no production traffic history to query. All "current" values below are the system's configured defaults and thresholds.

Once production traffic flows, these should be replaced with real measurements from the events table via `getLayerHitRates()` and `getReviewStats()`.

---

## Query Routing Metrics

```yaml
layer1_hit_rate:
  current: "unknown (no production traffic)"
  target: ">=55%"
  source: "src/lib/routing/layer-stats.ts LAYER_TARGETS.L1_STATIC"
  alert_threshold: "<40%"
  measurement: "getLayerHitRates(since).find(r => r.layer === 'L1_STATIC').rate"

layer3_processing_rate:
  current: "unknown"
  target: "<=25%"
  source: "src/lib/routing/layer-stats.ts LAYER_TARGETS.L3_AI"
  alert_threshold: ">35%"
  measurement: "getLayerHitRates(since).find(r => r.layer === 'L3_AI').rate"

layer4_realtime_rate:
  current: "0% (PROVIDER_REGISTRY is empty — no live adapters wired)"
  target: "<=10%"
  source: "src/lib/domain/providers.ts PROVIDER_REGISTRY"

layer5_bridge_rate:
  current: "unknown"
  target: "<=15%"
  source: "src/lib/routing/layer-stats.ts LAYER_TARGETS.L5_BRIDGE"

layer6_escalation_rate:
  current: "unknown"
  target: "<=5%"
  source: "src/lib/routing/layer-stats.ts LAYER_TARGETS.L6_ESCALATION"
  alert_threshold: ">8%"

tier_shortcut_min_score:
  current: "[REDACTED — patent-sensitive, see source code]"
  source: "src/lib/knowledge/retrieve.ts (internal constant)"
  note: "Tier A/B cards exceeding threshold bypass LLM entirely (value in env/code only)"
```

## AI Quality Metrics

```yaml
answer_satisfaction_rate:
  current: "unknown (no production feedback data)"
  target: ">=80% (users not clicking 'human')"
  measurement: "getReviewStats().satisfactionRate"
  source: "src/lib/db/tables.ts getReviewStats()"

hallucination_incidents:
  current: "0/month (no production traffic)"
  target: "0/month"
  measurement: "Manual review of RETRIEVE_HIT_AI_INFERRED events"

bridge_risk_classification_accuracy:
  current: "deterministic (keyword-based, no false positives possible)"
  source: "src/lib/domain/language-bridge.ts classifyRisk()"
  note: "HIGH_RISK_KEYWORDS covers en/zh/ja legal terms"
```

## System Stability

```yaml
p95_response_time:
  current: "unknown (no APM configured)"
  target: "<=2000ms"
  note: "Tier A/B shortcut path should be <100ms (no LLM call)"

error_rate:
  current: "unknown"
  target: "<=1%"
  measurement: "Count of 500 responses / total requests"

build_status:
  current: "green"
  evidence: "npx next build: Compiled + TypeScript clean + 25/25 static pages"
  last_verified: "2026-04-12"
```

## Security Baseline

```yaml
has_https:
  current: true
  note: "Vercel enforces HTTPS on all deployments"

has_audit_log:
  current: true
  source: "src/lib/audit/logger.ts (logRouterDecision, logEscalation, logError)"

has_rate_limiting:
  current: false
  action: "P0-3: Implement rate limiting middleware"

has_prompt_injection_filter:
  current: false
  action: "P0-3A: Build src/lib/security/prompt-injection.ts"

has_security_event_log:
  current: false
  action: "P0-3B: Build src/lib/security/event-log.ts"

has_waf:
  current: "Vercel default (basic DDoS protection)"
  note: "No custom WAF rules configured"

last_security_review:
  current: "never"
  action: "P2-1: First red team exercise"

has_input_length_limit:
  current: true
  evidence: "Router clips message to 500 chars for storage; bridge validates input type"

has_output_validation:
  current: true
  evidence: "src/lib/domain/contracts.ts validateAnswerPayload() blocks malformed outputs"

high_risk_detection:
  current: true
  evidence: "src/lib/rules/builtins.ts highRiskGateRule (multilingual regex)"
  coverage: "en/zh/ja keywords for legal, deportation, domestic violence, fraud"
```

## Knowledge Assets

```yaml
total_knowledge_cards:
  current: "seed set only (src/lib/knowledge/seed.ts)"
  note: "Seed FAQs cover renting/home_buying/visa/daily_life categories"

evidence_records:
  current: 0
  note: "EvidenceRecord CRUD exists in tables.ts, no records inserted yet"
  action: "P1-2: Begin evidence ingestion"

writeback_events_this_month:
  current: 0
  note: "Event infrastructure exists (insertEvent + listEvents), no production traffic"

faq_candidates_total:
  current: 0
  note: "Candidate pipeline exists (insert + setCandidateState + publish), no production data"

live_faqs_published:
  current: 0
  note: "LiveFaq CRUD + publish endpoint exist, no production publishes yet"
```

## Test Coverage

```yaml
test_suites:
  jtg-core: 5
  jtg-spec: 8
  jtg-p1: 18
  jtg-p2: 24
  total: 55
  status: "all green"

build_check:
  typescript: "clean (0 errors)"
  static_pages: "25/25 generated"
  routes_discovered: 17 dynamic + 8 static
```

---

*This baseline will be updated after P0-3 (security modules) and after first production traffic.*
