/**
 * JTG V5 — Regression suite for:
 *   1. Four-layer friction reduction framework (friction-reducer.ts)
 *   2. Trust signal trigger detector (trigger-detector.ts)
 *   3. Conversion signal tracker (conversion-tracker.ts)
 *
 * Run from web/ directory: `npx tsx tests/nlpm/jtg-bridge-friction.test.ts`
 *
 * All tests are pure — no DB, no network, no filesystem.
 */

export {}

async function main(): Promise<number> {
  // Dynamic imports (avoid top-level await for ES2017 target).
  const {
    FRICTION_SCENARIOS,
    getScenariosByFrictionCategory,
    getFrictionReducedScenario,
    getDefaultScenarioForCategory,
    getFrictionCategories,
    searchFrictionScenarios,
  } = await import('../../src/lib/bridge/friction-reducer')
  // FrictionCategory type: 'lease' | 'equipment' | 'utilities' | 'moveout'

  const {
    hasExplicitDoubt,
    hasHighAmountTopic,
    isRepeatedQuestion,
    detectTrustTrigger,
  } = await import('../../src/lib/evidence/trigger-detector')

  const {
    buildConversionSignal,
    computeWeeklySummary,
  } = await import('../../src/lib/analytics/conversion-tracker')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, label: string): void {
    if (condition) {
      passed++
    } else {
      failed++
      console.error(`  FAIL: ${label}`)
    }
  }

  // =================================================================
  // Section A: Friction Reducer (14 tests)
  // =================================================================
  console.log('\n--- A. Friction Reducer ---')

  // A-01: All 4 categories have at least 3 scenarios each.
  const categories = ['lease', 'equipment', 'utilities', 'moveout'] as const
  for (const cat of categories) {
    const scenarios = getScenariosByFrictionCategory(cat)
    assert(scenarios.length >= 3, `A-01: category "${cat}" has ≥3 scenarios (got ${scenarios.length})`)
  }

  // A-02: Total scenario count = 14 (4+4+3+3 originally, but we check FRICTION_SCENARIOS).
  // The execution doc says 4 categories × 3+ = 14.
  assert(FRICTION_SCENARIOS.length >= 12, `A-02: total scenarios ≥12 (got ${FRICTION_SCENARIOS.length})`)

  // A-03: Every scenario has complete opening/branches/failureHandlers/defaultSuggestion.
  for (const s of FRICTION_SCENARIOS) {
    assert(
      s.opening != null && s.branches != null && s.failureHandlers != null && s.defaultSuggestion != null,
      `A-03: scenario ${s.id} has all four layers`,
    )
  }

  // A-04: opening.ja is non-empty for every scenario.
  for (const s of FRICTION_SCENARIOS) {
    assert(
      typeof s.opening.ja === 'string' && s.opening.ja.length > 0,
      `A-04: scenario ${s.id} opening.ja is non-empty`,
    )
  }

  // A-05: failureHandlers.notUnderstood.ja is non-empty for every scenario.
  for (const s of FRICTION_SCENARIOS) {
    assert(
      typeof s.failureHandlers.notUnderstood.ja === 'string' &&
        s.failureHandlers.notUnderstood.ja.length > 0,
      `A-05: scenario ${s.id} failureHandlers.notUnderstood.ja is non-empty`,
    )
  }

  // A-06: getDefaultScenarioForCategory never returns null/undefined.
  for (const cat of categories) {
    const d = getDefaultScenarioForCategory(cat)
    assert(d != null, `A-06: getDefaultScenarioForCategory("${cat}") is non-null`)
  }

  // A-07: getFrictionReducedScenario returns correct scenario.
  const renewal = getFrictionReducedScenario('lease', 'renewal')
  assert(renewal?.id === 'LEASE-01', 'A-07: getFrictionReducedScenario("lease","renewal") returns LEASE-01')

  // A-08: getFrictionReducedScenario returns null for unknown subcategory.
  const unknown = getFrictionReducedScenario('lease', 'nonexistent')
  assert(unknown === null, 'A-08: getFrictionReducedScenario("lease","nonexistent") returns null')

  // A-09: getFrictionCategories returns all 4 categories.
  const cats = getFrictionCategories()
  assert(cats.length === 4, `A-09: getFrictionCategories returns 4 categories (got ${cats.length})`)

  // A-10: searchFrictionScenarios finds by Japanese title keyword.
  const hotWaterResults = searchFrictionScenarios('お湯')
  assert(hotWaterResults.length >= 1, 'A-10: search "お湯" finds ≥1 scenario')
  assert(hotWaterResults[0].id === 'EQUIP-01', 'A-10: search "お湯" first result is EQUIP-01')

  // A-11: searchFrictionScenarios finds by Chinese keyword.
  const zhResults = searchFrictionScenarios('退租')
  assert(zhResults.length >= 1, 'A-11: search "退租" finds ≥1 scenario')

  // A-12: Every scenario has at least 1 branch.
  for (const s of FRICTION_SCENARIOS) {
    assert(s.branches.length >= 1, `A-12: scenario ${s.id} has ≥1 branch`)
  }

  // A-13: Every scenario has noAnswer.nextSteps with at least 1 entry.
  for (const s of FRICTION_SCENARIOS) {
    assert(
      s.failureHandlers.noAnswer.nextSteps.length >= 1,
      `A-13: scenario ${s.id} noAnswer has ≥1 nextStep`,
    )
  }

  // A-14: Scenario IDs are unique.
  const ids = FRICTION_SCENARIOS.map((s) => s.id)
  const uniqueIds = new Set(ids)
  assert(uniqueIds.size === ids.length, `A-14: all scenario IDs are unique (${uniqueIds.size}/${ids.length})`)

  // =================================================================
  // Section B: Trust Trigger Detector (10 tests)
  // =================================================================
  console.log('\n--- B. Trust Trigger Detector ---')

  // B-01: Japanese doubt detection.
  assert(hasExplicitDoubt('これは本当ですか？'), 'B-01: detects Japanese doubt "本当ですか"')

  // B-02: Chinese doubt detection.
  assert(hasExplicitDoubt('这个是真的吗'), 'B-02: detects Chinese doubt "是真的吗"')

  // B-03: English doubt detection.
  assert(hasExplicitDoubt('Is this real?'), 'B-03: detects English doubt "Is this real?"')

  // B-04: No false positive on neutral text.
  assert(!hasExplicitDoubt('明日の天気はどうですか'), 'B-04: no false positive on weather question')

  // B-05: High amount topic — Japanese deposit.
  assert(hasHighAmountTopic('敷金はいくらですか'), 'B-05: detects "敷金" as high amount topic')

  // B-06: High amount topic — English.
  assert(hasHighAmountTopic('How much is the deposit?'), 'B-06: detects "deposit" as high amount topic')

  // B-07: Repeated question detection (uses space-separated tokens, length≥2).
  assert(
    isRepeatedQuestion('deposit return policy', ['deposit return inquiry', 'other topic']),
    'B-07: detects repeated question (2+ overlapping tokens)',
  )

  // B-08: No repeated question for unrelated queries.
  assert(
    !isRepeatedQuestion('今日は暑い', ['敷金について教えて']),
    'B-08: no repeated question for unrelated text',
  )

  // B-09: detectTrustTrigger — explicit doubt is highest priority.
  const doubtResult = detectTrustTrigger('本当ですか？敷金はいくら')
  assert(doubtResult.triggered === true, 'B-09a: doubt triggers')
  assert(doubtResult.signalType === 'explicit_doubt', 'B-09b: doubt signal type')
  assert(doubtResult.urgency === 'high', 'B-09c: doubt urgency is high')

  // B-10: detectTrustTrigger — no trigger on neutral text.
  const neutralResult = detectTrustTrigger('明日の天気')
  assert(neutralResult.triggered === false, 'B-10: neutral text does not trigger')

  // =================================================================
  // Section C: Conversion Tracker (8 tests)
  // =================================================================
  console.log('\n--- C. Conversion Tracker ---')

  // C-01: buildConversionSignal creates valid signal.
  const signal = buildConversionSignal({
    signalType: 'handoff_requested',
    sessionId: 'sess-001',
    queryCount: 5,
    topCategories: ['lease', 'deposit'],
  })
  assert(signal.id.startsWith('conv_'), 'C-01a: signal id starts with "conv_"')
  assert(signal.signalType === 'handoff_requested', 'C-01b: signal type matches')
  assert(signal.sessionId === 'sess-001', 'C-01c: session id matches')
  assert(signal.queryCount === 5, 'C-01d: query count matches')

  // C-02: buildConversionSignal defaults.
  const sig2 = buildConversionSignal({
    signalType: 'evidence_viewed',
    sessionId: 'sess-002',
  })
  assert(sig2.queryCount === 0, 'C-02a: default queryCount is 0')
  assert(sig2.topCategories.length === 0, 'C-02b: default topCategories is empty')

  // C-03: computeWeeklySummary — empty signals.
  const emptySummary = computeWeeklySummary([])
  assert(emptySummary.totalSessions === 0, 'C-03a: empty signals → 0 sessions')
  assert(emptySummary.estimatedServiceInquiryRate === 0, 'C-03b: empty → rate 0')

  // C-04: computeWeeklySummary — counts by type.
  const now = new Date('2026-04-12T12:00:00Z')
  const recent = new Date('2026-04-11T10:00:00Z').toISOString()
  const signals = [
    { id: 'c1', signalType: 'handoff_requested' as const, sessionId: 's1', queryCount: 3, topCategories: [], timestamp: recent },
    { id: 'c2', signalType: 'handoff_requested' as const, sessionId: 's2', queryCount: 2, topCategories: [], timestamp: recent },
    { id: 'c3', signalType: 'evidence_viewed' as const, sessionId: 's3', queryCount: 1, topCategories: [], timestamp: recent },
    { id: 'c4', signalType: 'language_bridge_completed' as const, sessionId: 's1', queryCount: 4, topCategories: [], timestamp: recent },
  ]
  const summary = computeWeeklySummary(signals, now)
  assert(summary.totalSessions === 3, `C-04a: 3 unique sessions (got ${summary.totalSessions})`)
  assert(summary.handoffRequested === 2, `C-04b: 2 handoff_requested (got ${summary.handoffRequested})`)
  assert(summary.evidenceViewed === 1, `C-04c: 1 evidence_viewed (got ${summary.evidenceViewed})`)
  assert(summary.languageBridgeCompleted === 1, `C-04d: 1 language_bridge_completed (got ${summary.languageBridgeCompleted})`)

  // C-05: computeWeeklySummary — estimated rate calculation.
  // 2 handoffs / 3 sessions = 0.6667
  assert(
    Math.abs(summary.estimatedServiceInquiryRate - 0.6667) < 0.001,
    `C-05: estimated rate ≈ 0.6667 (got ${summary.estimatedServiceInquiryRate})`,
  )

  // C-06: computeWeeklySummary — old signals excluded.
  const oldSignal = {
    id: 'c-old',
    signalType: 'handoff_requested' as const,
    sessionId: 's-old',
    queryCount: 1,
    topCategories: [],
    timestamp: new Date('2026-03-01T10:00:00Z').toISOString(), // > 7 days ago
  }
  const summaryWithOld = computeWeeklySummary([...signals, oldSignal], now)
  assert(summaryWithOld.handoffRequested === 2, 'C-06: old signal excluded from count')

  // C-07: computeWeeklySummary — period boundaries.
  assert(summary.period.from === '2026-04-05', `C-07a: period from (got ${summary.period.from})`)
  assert(summary.period.to === '2026-04-12', `C-07b: period to (got ${summary.period.to})`)

  // C-08: Signal IDs are unique.
  const s1 = buildConversionSignal({ signalType: 'repeat_visit', sessionId: 'x' })
  const s2 = buildConversionSignal({ signalType: 'repeat_visit', sessionId: 'x' })
  assert(s1.id !== s2.id, 'C-08: consecutive signal IDs are unique')

  // =================================================================
  // Summary.
  // =================================================================
  const total = passed + failed
  console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed ===\n`)
  return failed
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err)
  process.exit(1)
})
