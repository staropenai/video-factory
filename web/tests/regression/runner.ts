/**
 * TypeScript regression runner — uses real router modules.
 *
 * Run from web/ directory: npx tsx tests/regression/runner.ts
 * Exit code 0 = all pass, 1 = failures.
 */

import fs from 'node:fs'
import path from 'node:path'
import { decideRoute } from '../../src/lib/router/decide'
import { retrieveFromLocal } from '../../src/lib/knowledge/retrieve'
import { validateDecision } from '../../src/lib/validation/guardrails'
import type { RetrievalSummary, TaskState } from '../../src/lib/router/types'

const casesPath = path.join(process.cwd(), 'tests/regression/cases.json')

interface RegressionCase {
  name: string
  queryText: string
  taskState: Record<string, unknown>
  clarificationRounds: number
  retrieval?: RetrievalSummary
  expected: {
    answerMode?: string
    shouldEscalate?: boolean
    selectedRuleKeys?: string[]
    knowledgeFound?: boolean
  }
}

const cases: RegressionCase[] = JSON.parse(fs.readFileSync(casesPath, 'utf8'))
let passed = 0
let failed = 0

for (const c of cases) {
  const retrieval: RetrievalSummary = c.retrieval || retrieveFromLocal(c.queryText).summary

  const rawDecision = decideRoute({
    queryText: c.queryText,
    normalizedQuery: c.queryText,
    taskState: c.taskState as TaskState,
    retrieval,
    clarificationRounds: c.clarificationRounds,
  })
  const result = validateDecision(rawDecision)

  let caseFailed = false

  if (c.expected.answerMode && result.answerMode !== c.expected.answerMode) {
    caseFailed = true
    console.error(`  [FAIL] ${c.name} answerMode: expected=${c.expected.answerMode} got=${result.answerMode}`)
  }

  if (typeof c.expected.shouldEscalate === 'boolean' && result.shouldEscalate !== c.expected.shouldEscalate) {
    caseFailed = true
    console.error(`  [FAIL] ${c.name} shouldEscalate: expected=${c.expected.shouldEscalate} got=${result.shouldEscalate}`)
  }

  if (Array.isArray(c.expected.selectedRuleKeys)) {
    for (const key of c.expected.selectedRuleKeys) {
      if (!result.selectedRuleKeys.includes(key)) {
        caseFailed = true
        console.error(`  [FAIL] ${c.name} missing rule: ${key} (got: ${result.selectedRuleKeys.join(', ')})`)
      }
    }
  }

  if (typeof c.expected.knowledgeFound === 'boolean' && result.knowledgeTrace.knowledgeFound !== c.expected.knowledgeFound) {
    caseFailed = true
    console.error(`  [FAIL] ${c.name} knowledgeFound: expected=${c.expected.knowledgeFound} got=${result.knowledgeTrace.knowledgeFound}`)
  }

  if (caseFailed) {
    failed++
  } else {
    passed++
    console.log(`  [PASS] ${c.name} [${result.answerMode}]`)
  }
}

console.log(`\nRegression: ${passed} passed, ${failed} failed, ${cases.length} total`)

if (failed > 0) {
  process.exit(1)
}

console.log('All regression tests passed.')
