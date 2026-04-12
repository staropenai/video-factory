/**
 * JTG Core NL-TDD runner — v4 改进 #5.
 *
 * Runs the five specs documented in `.nlpm-test/jtg-core.spec.md` against
 * the real retrieve + decide modules. No network, no OpenAI, no I/O other
 * than reading the live_faqs overlay file (which is fine in a test run).
 *
 * Run from web/ directory: `npx tsx tests/nlpm/jtg-core.test.ts`
 * Exit code 0 = all pass, 1 = failures.
 *
 * This file is intentionally minimal — it's the entry to a suite that should
 * grow every time a new edge case is found (Wu Jun's "sample completeness"
 * principle applied to natural-language artifacts).
 */

import { retrieveFromLocal } from '../../src/lib/knowledge/retrieve'
import { decideRoute } from '../../src/lib/router/decide'
import { validateDecision } from '../../src/lib/validation/guardrails'
import type { TaskState } from '../../src/lib/router/types'

interface Spec {
  id: string
  description: string
  run: () => string[] // returns array of failure messages; empty = pass
}

function assertEq<T>(
  label: string,
  actual: T,
  expected: T,
  failures: string[],
): void {
  if (actual !== expected) {
    failures.push(`${label}: expected=${String(expected)} got=${String(actual)}`)
  }
}

function decideFor(queryText: string) {
  const retrieval = retrieveFromLocal(queryText)
  const rawDecision = decideRoute({
    queryText,
    normalizedQuery: queryText.toLowerCase(),
    taskState: {} as TaskState,
    retrieval: retrieval.summary,
    clarificationRounds: 0,
  })
  const decision = validateDecision(rawDecision)
  // The route handler computes `canShortcut` — mirror it here so the spec
  // verifies the same shortcut decision the handler would make.
  const shortcut = retrieval.summary.shortcut ?? 'none'
  const canShortcut =
    shortcut !== 'none' &&
    decision.answerMode === 'direct_answer' &&
    !decision.shouldEscalate &&
    decision.riskLevel !== 'high' &&
    retrieval.matches.length > 0
  return { retrieval, decision, shortcut, canShortcut }
}

const specs: Spec[] = [
  {
    id: 'Test-01',
    description: 'Tier A shortcut bypasses the LLM (hanko)',
    run: () => {
      const failures: string[] = []
      const { retrieval, canShortcut } = decideFor('hanko inkan seal stamp')
      assertEq('topTier', retrieval.summary.topTier, 'A', failures)
      assertEq(
        'shortcut',
        retrieval.summary.shortcut,
        'tier_a_shortcut',
        failures,
      )
      assertEq('canShortcut', canShortcut, true, failures)
      return failures
    },
  },
  {
    id: 'Test-02',
    description: 'Tier C queries still flow through the AI layer',
    run: () => {
      const failures: string[] = []
      const { retrieval, canShortcut } = decideFor(
        'my landlord wants to raise my rent, what are my rights?',
      )
      // Either retrieval misses or the top match is a Tier C card. Either
      // way the shortcut MUST NOT fire.
      if (
        retrieval.summary.topTier &&
        retrieval.summary.topTier !== 'C'
      ) {
        failures.push(
          `topTier: expected 'C' or unset, got '${retrieval.summary.topTier}'`,
        )
      }
      assertEq('canShortcut', canShortcut, false, failures)
      return failures
    },
  },
  {
    id: 'Test-03',
    description: 'High-risk Policy Gate zero tolerance',
    run: () => {
      const failures: string[] = []
      const { decision, canShortcut } = decideFor(
        'my landlord is threatening to sue me',
      )
      // We want SOME safety response — handoff OR official_only OR elevated
      // risk. The key invariant is: shortcut MUST NOT fire, and the answer
      // mode must NOT be a plain direct_answer.
      if (decision.answerMode === 'direct_answer') {
        failures.push(
          `answerMode on legal-threat query: expected safety escalation, got 'direct_answer'`,
        )
      }
      assertEq('canShortcut', canShortcut, false, failures)
      return failures
    },
  },
  {
    id: 'Test-04',
    description: 'STATIC provenance on every hit',
    run: () => {
      const failures: string[] = []
      const { retrieval } = decideFor('hanko')
      if (retrieval.matches.length === 0) {
        failures.push('expected at least one retrieval hit for "hanko"')
      } else {
        assertEq(
          'topSourceType',
          retrieval.summary.topSourceType,
          'STATIC',
          failures,
        )
      }
      return failures
    },
  },
  {
    id: 'Test-05',
    description: 'Tier B procedural shortcut (garbage)',
    run: () => {
      const failures: string[] = []
      const { retrieval, canShortcut } = decideFor(
        'how do I sort garbage in my neighborhood',
      )
      assertEq('topTier', retrieval.summary.topTier, 'B', failures)
      assertEq(
        'shortcut',
        retrieval.summary.shortcut,
        'tier_b_shortcut',
        failures,
      )
      assertEq('canShortcut', canShortcut, true, failures)
      return failures
    },
  },
]

let passed = 0
let failed = 0
for (const spec of specs) {
  const failures = spec.run()
  if (failures.length === 0) {
    console.log(`  [PASS] ${spec.id} — ${spec.description}`)
    passed++
  } else {
    console.error(`  [FAIL] ${spec.id} — ${spec.description}`)
    for (const f of failures) console.error(`         ${f}`)
    failed++
  }
}

console.log(`\nJTG core NL-TDD: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
