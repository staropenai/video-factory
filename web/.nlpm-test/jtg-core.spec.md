# JTG Core Behavior — NL-TDD Spec (v4)

> Minimum-viable NL-TDD suite per v4 改进 #5. Each test below is a
> natural-language specification of a behavior that the router MUST satisfy.
> The runnable equivalent lives at `tests/nlpm/jtg-core.test.ts` and exits
> non-zero on any spec failure.
>
> Score threshold for the suite: **95** (high-risk behaviors — no tolerance).

## Test-01 — Tier A shortcut bypasses the LLM

**Input**: `"hanko inkan seal stamp"` (any language)

**Expected**:

- `retrieval.summary.topTier === 'A'`
- `retrieval.summary.shortcut === 'tier_a_shortcut'`
- The router takes the shortcut path and does NOT call
  `renderFinalAnswer`. `rendered.source === 'tier_shortcut'`.

**Rationale**: `hanko` is a one-sentence, static, unambiguous answer. The
whole point of v4 改进 #1 is that this query type never burns LLM tokens.

---

## Test-02 — Tier C queries still flow through the AI layer

**Input**: `"my landlord wants to raise my rent, what are my rights?"`

**Expected**:

- `retrieval.summary.topTier` is `'C'` OR retrieval miss
- `retrieval.summary.shortcut === 'none'`
- Router does NOT take the shortcut (unit test checks
  `canShortcut === false`).

**Rationale**: Negotiation + rights questions carry judgement. They must be
routed through the AI understanding + tighten-only reconcile path.

---

## Test-03 — High-risk Policy Gate zero tolerance

**Input**: `"my landlord is threatening to sue me"`

**Expected**:

- `decision.answerMode === 'handoff'` (rule engine escalates)
- `decision.shouldEscalate === true`
- EVEN IF a Tier-A card matched, the shortcut MUST NOT fire — high-risk
  wins over the efficiency path.

**Rationale**: The cost of a false-positive shortcut on a legal-risk query
is far greater than the LLM token savings. v4 改进 #5 sets this test's
threshold to 95 precisely to encode "do not trade safety for cost".

---

## Test-04 — STATIC provenance on every retrieval

**Input**: Any query that hits a seed FAQ or published live FAQ.

**Expected**:

- `retrieval.summary.topSourceType === 'STATIC'`

**Rationale**: v4 改进 #6 requires every piece of knowledge entering the
answer layer to carry an explicit provenance tag. Seed + published-live
rows are both STATIC. REALTIME and AI_INFERRED are produced by pipelines
that don't exist yet, so STATIC is currently the only value we should see.

---

## Test-05 — Tier B procedural shortcut

**Input**: `"how do I sort garbage in my neighborhood"`

**Expected**:

- `retrieval.summary.topTier === 'B'`
- `retrieval.summary.shortcut === 'tier_b_shortcut'`

**Rationale**: Short procedural answers (sort into N buckets, put out on
these days) are deterministic and static. Tier B lets the router return a
canned 3-5 step procedure without the LLM.
