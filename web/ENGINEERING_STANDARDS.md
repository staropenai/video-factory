# JTG Engineering Standards v1

> Effective: 2026-04-12
> Authority: V6 执行文件 §P0-4

---

## 1. Naming Conventions

### 1.1 Core Object Types (PascalCase)

```
KnowledgeCard        EvidenceRecord       QueryRoute
LanguageBridgeOutput ReviewDecision        ProviderEnvelope
WritebackEvent       SecurityEvent        MetricSnapshot
FaqCandidateRow      LiveFaqRow           UserQueryRow
```

### 1.2 Functions (camelCase, verb + noun)

```
// Routing
classifyQueryLayer()   decideRoute()        reconcileDecision()
computeLayerHitRates() checkAlerts()        captureSnapshot()

// Knowledge
renderCard()           isCardStale()        scoreQueryAgainstSeeds()
retrieveFromLocal()    retrieveFromLocalMulti()

// Evidence
searchEvidenceRecords()  findExpiredRecords()  confidenceRank()
linkEvidenceToCard()

// Writeback
recordLayerHit()       shouldAutoPropose()  autoProposeFaqCandidate()
buildLayerHitEvent()   buildProposalMetadata()
detectKnowledgeGaps()  identifyGaps()       rankGapsByUrgency()

// Security
checkPromptInjection() sanitizeForLog()     logSecurityEvent()
buildSecurityEvent()   classifySecuritySeverity()

// Validation
validateAnswerPayload()  validateBridgeInput()  validateBridgeOutput()
validateReviewDecision() validateProviderEnvelope()
```

### 1.3 Constants (UPPER_SNAKE_CASE)

```
SOURCE_TYPES           CANDIDATE_STATES     EVENT_TYPES
KNOWLEDGE_CARD_TIERS   BLOCK_REASONS        BRIDGE_ERROR_CODES
WRITEBACK_ERROR_CODES  PROVIDER_ERROR_CODES LAYER_TARGETS
ALERT_THRESHOLDS       INJECTION_PATTERNS   HIGH_RISK_KEYWORDS
```

### 1.4 Prohibited Names

```
process()    // Too vague — process what?
handle()     // No description of what it handles
doThing()    // Not a real name
data         // As a variable name — name the specific data
temp / tmp   // Name the purpose, not the lifetime
```

---

## 2. Module Architecture

### 2.1 Pure / I/O Separation (mandatory for all domain + pipeline modules)

Every module that contains business logic MUST separate:

1. **Pure functions** (top of file) — take data in, return data out, no side effects
2. **I/O wrappers** (bottom of file) — thin functions that read from JSONL/API, call the pure functions, return results

This pattern ensures:
- All business logic is testable without mocking
- Tests run in <1s with no filesystem or network
- I/O can be swapped (JSONL → Postgres) without touching business logic

### 2.2 Validator Pattern (discriminated union)

All validators return `{ ok: true, ... } | { ok: false, code, message }`:

```typescript
// Error codes as stable const map
export const ERROR_CODES = {
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_VALUE: 'INVALID_VALUE',
} as const

// Validator returns discriminated union
export function validateThing(input): ThingOk | ThingErr {
  if (!input.field) return { ok: false, code: 'MISSING_FIELD', message: '...' }
  return { ok: true, thing: { ... } }
}
```

### 2.3 Error Code Convention

- Error codes are UPPER_SNAKE_CASE strings
- Stored in `as const` maps for type safety
- Stable across versions — never rename a code, only add new ones
- Tests match on codes, not messages (messages can change)

---

## 3. Directory Structure

```
web/src/
├── app/api/                    # Next.js route handlers (thin — delegates to lib/)
│   ├── router/route.ts         # Core routing pipeline
│   ├── bridge/route.ts         # Language bridge endpoint
│   ├── review/                 # Staff review endpoints
│   └── sensing/scan/route.ts   # Cluster sensing
├── lib/
│   ├── domain/                 # Pure domain types + validators
│   │   ├── enums.ts            # Single source of truth for all enums
│   │   ├── contracts.ts        # SourceTag + OutputBlock + AnswerPayload
│   │   ├── knowledge-card.ts   # Tier A/B/C render contract
│   │   ├── language-bridge.ts  # Bridge I/O contract + risk classifier
│   │   ├── writeback.ts        # ReviewDecision + DailyReviewSummary
│   │   └── providers.ts        # Provider envelope + registry
│   ├── db/
│   │   └── tables.ts           # JSONL persistence (all table schemas + CRUD)
│   ├── evidence/
│   │   └── registry.ts         # Evidence search + expiry detection
│   ├── routing/
│   │   ├── layer-stats.ts      # Layer hit-rate computation
│   │   └── metrics.ts          # Alert thresholds + metric snapshots
│   ├── pipeline/
│   │   ├── writeback-hooks.ts  # Layer 7 infrastructure hooks
│   │   └── gap-detector.ts     # Knowledge gap identification
│   ├── security/
│   │   ├── prompt-injection.ts # Injection pattern detection
│   │   └── event-log.ts        # Independent security event log
│   ├── ai/                     # OpenAI integration (understand + generate)
│   ├── audit/                  # Structured audit logging
│   ├── knowledge/              # FAQ retrieval + scoring
│   ├── router/                 # Rule engine + decision logic
│   ├── rules/                  # Built-in safety rules
│   ├── sensing/                # Cluster detection
│   └── validation/             # Guardrails + decision validation
└── tests/nlpm/                 # Regression test suites
    ├── jtg-core.test.ts        # 5 tests  — core pipeline
    ├── jtg-spec.test.ts        # 8 tests  — spec v1
    ├── jtg-p1.test.ts          # 18 tests — P1 domain contracts
    ├── jtg-p2.test.ts          # 24 tests — P2 infrastructure
    └── jtg-v6-p0.test.ts       # ~20 tests — V6 security + metrics + gaps
```

---

## 4. Function Documentation Standard

Every exported function MUST include:

```typescript
/**
 * [One-line purpose — what it does, not how]
 *
 * [Key invariant or constraint, if any]
 *
 * Pure — no I/O.  (or)  I/O — reads from [source].
 */
```

Example:
```typescript
/**
 * Classify a router pathTrace into a canonical layer label (L1..L6).
 *
 * ESCALATION takes priority over all other classifications.
 *
 * Pure — no I/O.
 */
export function classifyQueryLayer(trace: PathTraceInput): LayerLabel {
```

---

## 5. Testing Standards

### 5.1 Test Pattern

- All test files use `async function main()` wrapper (ES2017 target)
- Dynamic imports inside main() for module isolation
- Each test has: id, description, assertions record, failures array
- Runner prints `[PASS]` / `[FAIL]` with assertion metadata
- Process exits with code 1 if any test fails

### 5.2 Test Coverage Requirements

- Every new domain module: minimum 4 tests (happy path, error path, edge case, boundary)
- Every new validator: test every error code at least once
- Every pure function: test with representative input + boundary input
- No test may touch the filesystem or network (pure inputs only)

### 5.3 Running Tests

```bash
cd web
npx tsx tests/nlpm/jtg-core.test.ts     # Core pipeline
npx tsx tests/nlpm/jtg-spec.test.ts     # Spec v1
npx tsx tests/nlpm/jtg-p1.test.ts       # P1 domains
npx tsx tests/nlpm/jtg-p2.test.ts       # P2 infrastructure
npx tsx tests/nlpm/jtg-v6-p0.test.ts    # V6 security + metrics
npx next build                          # TypeScript type-check
```

---

## 6. Security Standards (V6)

### 6.1 Input Validation

- ALL user text input passes through `checkPromptInjection()` BEFORE any LLM call
- High-severity injection → request blocked with 400, security event logged
- Medium-severity injection → request proceeds but warning logged
- Input length capped at route handler level (router: 500 chars stored, bridge: validated)

### 6.2 Output Validation

- ALL LLM-generated output passes through contract validators before being returned
- `validateAnswerPayload()` blocks empty payloads, mixed sources, missing timestamps
- `validateBridgeOutput()` blocks missing escalation on HIGH risk
- If validation fails, fallback to deterministic template (never return unvalidated LLM output)

### 6.3 Audit Trail

- Main audit: `insertEvent()` in `tables.ts` — durable JSONL, queryable
- Security audit: `logSecurityEvent()` in `security/event-log.ts` — separate JSONL
- Console audit: `logRouterDecision()` — structured JSON to stdout for log drain
- Security events also emit to stderr for monitoring separation

### 6.4 High-Risk Query Handling

- Multilingual keyword detection (en/zh/ja) in `builtins.ts` highRiskGateRule
- HIGH risk → mandatory escalation suggestion (bridge) or handoff (router)
- AI hints can only TIGHTEN risk level, never loosen (tighten-only reconciliation)

---

## 7. Commit Message Convention

```
feat: [feature] [affected module] [expected metric change]
fix: [bug description] [root cause] [fix approach]
security: [vulnerability] [risk level] [fix approach]
refactor: [scope] [reason for refactor]
docs: [what changed] [why]
test: [what's covered] [test count]
```

Example:
```
feat: add prompt injection filter [security/prompt-injection.ts] [blocks ~15 known attack patterns]
```

---

*Standards version: JTG-ES-v1*
*Last updated: 2026-04-12*
