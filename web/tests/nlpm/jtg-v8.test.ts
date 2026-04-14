/**
 * JTG v8 — Patent Engineering Module Tests.
 *
 * Covers:
 *   A. Evidence Chain Logger (15 tests)
 *   B. Baseline Comparison Engine (12 tests)
 *   C. Claim Mapping (8 tests)
 *   D. Technical Effect Extractor (12 tests)
 *
 * Total: 47 tests. All pure — no DB, no network, no filesystem.
 * Run: `npx tsx tests/nlpm/jtg-v8.test.ts`
 */

export {}

async function main(): Promise<number> {
  // Dynamic imports (ES2017 target — no top-level await).
  const {
    createEvidenceRecord,
    inferPatentClaims,
    computeEvidenceStats,
    filterByModule,
    filterByClaimRelevance,
    filterByDateRange,
    exportForPatentReport,
  } = await import('../../src/lib/patent/evidence-chain-logger')

  const {
    createBaselineMetrics,
    createJtgMetrics,
    computeDelta,
    createComparisonRun,
    welchTTest,
    computeSummary,
    UNAVAILABLE_METRICS,
  } = await import('../../src/lib/patent/baseline-comparison')

  const {
    CLAIM_STRUCTURES,
    ALL_CLAIM_ELEMENTS,
    getClaimStructure,
    getClaimElement,
    getElementsForModule,
    getElementsMeasuredBy,
  } = await import('../../src/lib/patent/claim-mapping')

  const {
    extractRoutingEffects,
    extractBridgeEffects,
    extractEvidenceEffects,
    assessFilingReadiness,
    generateTechnicalEffectReport,
  } = await import('../../src/lib/patent/technical-effect-extractor')

  type EvidenceChainRecord = Awaited<ReturnType<typeof createEvidenceRecord>>
  type ProcessRecord = EvidenceChainRecord['process']

  let passed = 0
  let failed = 0

  function assert(condition: boolean, label: string) {
    if (condition) {
      passed++
      console.log(`  ✅ ${label}`)
    } else {
      failed++
      console.error(`  ❌ ${label}`)
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helpers — reusable record factories.
  // ═══════════════════════════════════════════════════════════════════

  function makeEvidenceRecord(overrides: Partial<EvidenceChainRecord> = {}): EvidenceChainRecord {
    return {
      recordId: 'ecr_test-001',
      timestamp: '2026-04-12T10:00:00.000Z',
      module: 'routing' as const,
      queryId: 'q-001',
      sessionId: 's-001',
      input: {
        queryText: 'test query',
        userLanguage: 'ja',
        scenarioTag: null,
      },
      process: {
        routeTaken: 'L3_AI',
        decisionReasonCode: 'L3_AI_INFERRED',
        decisionReasonDetails: {},
        triggerScore: 0.75,
        evidenceUsed: ['ev-001'],
        stateTransitionPath: [],
        optimizerRoute: 'layer3_ai',
        judgmentRuleId: 'JUDG-001',
      },
      output: {
        answerType: 'L3',
        userAction: null,
        timeToFirstActionMs: 250,
      },
      patentClaimRelevant: ['ClaimA_routing', 'ClaimB_evidence'],
      baselineComparisonFlag: false,
      ...overrides,
    }
  }

  function makeRoutingRecord(overrides: Record<string, unknown> = {}) {
    return {
      metricType: 'ROUTING_DECISION' as const,
      id: 'rd-001',
      timestamp: '2026-04-12T10:00:00Z',
      queryId: 'q-001',
      features: { fSemantic: 0.8, fRisk: 0.3, fLang: 0.5, fTemporal: false },
      routeTaken: 'AI_INFERRED',
      costEstimate: 0.01,
      confidenceScore: 0.85,
      layer6Triggered: false,
      ...overrides,
    }
  }

  function makeBridgeRecord(overrides: Record<string, unknown> = {}) {
    return {
      metricType: 'BRIDGE_SESSION' as const,
      id: 'bs-001',
      timestamp: '2026-04-12T10:00:00Z',
      sessionId: 's-001',
      sceneTag: 'lease/renewal',
      timeToFirstScript: 5.2,
      statesTraversed: ['idle', 'scene_identified', 'context_gathering', 'script_ready', 'completed'],
      userCopiedScript: true,
      followupQuestions: 1,
      riskLevel: 'medium',
      userLocale: 'zh',
      ...overrides,
    }
  }

  function makeEvidenceInjectionRecord(overrides: Record<string, unknown> = {}) {
    return {
      metricType: 'EVIDENCE_INJECTION' as const,
      id: 'ei-001',
      timestamp: '2026-04-12T10:00:00Z',
      queryId: 'q-001',
      triggerScore: 0.72,
      evidenceInjected: true,
      evidenceCount: 3,
      confidenceScores: [0.9, 0.8, 0.7],
      subsequentLayer6Trigger: false,
      ...overrides,
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // A. Evidence Chain Logger (15 tests)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══ A. Evidence Chain Logger ═══')

  // A-01
  const recA01 = createEvidenceRecord({
    module: 'routing',
    queryId: 'q-1',
    sessionId: 's-1',
    input: { queryText: 'test', userLanguage: 'ja' },
    routeTaken: 'L3_AI',
    decisionReasonCode: 'L3_AI_INFERRED',
    decisionReasonDetails: {},
    evidenceUsed: [],
    answerType: 'L3',
  })
  assert(recA01.recordId.startsWith('ecr_'), 'A-01: createEvidenceRecord generates ecr_ prefix')

  // A-02
  const longText = 'x'.repeat(1000)
  const recA02 = createEvidenceRecord({
    module: 'routing',
    queryId: 'q-2',
    sessionId: 's-2',
    input: { queryText: longText, userLanguage: 'en' },
    routeTaken: 'L1_STATIC',
    decisionReasonCode: 'L1_SEMANTIC_HIT',
    decisionReasonDetails: {},
    evidenceUsed: [],
    answerType: 'L1',
  })
  assert(recA02.input.queryText.length === 500, 'A-02: queryText truncated to 500 chars')

  // A-03
  const procA03: ProcessRecord = {
    routeTaken: 'L3_AI',
    decisionReasonCode: 'L3_AI_INFERRED',
    decisionReasonDetails: {},
    triggerScore: null,
    evidenceUsed: [],
    stateTransitionPath: [],
    optimizerRoute: null,
    judgmentRuleId: null,
  }
  const claimsA03 = inferPatentClaims(procA03)
  assert(claimsA03.includes('ClaimA_routing'), 'A-03: tags ClaimA_routing for non-L6')
  assert(!claimsA03.includes('ClaimC_bridge'), 'A-03b: no ClaimC_bridge without transitions')

  // A-04
  const procA04: ProcessRecord = {
    routeTaken: 'L5_BRIDGE',
    decisionReasonCode: 'L5_BRIDGE_ACTIVATED',
    decisionReasonDetails: {},
    triggerScore: null,
    evidenceUsed: [],
    stateTransitionPath: ['idle', 'scene_identified', 'completed'],
    optimizerRoute: null,
    judgmentRuleId: null,
  }
  const claimsA04 = inferPatentClaims(procA04)
  assert(claimsA04.includes('ClaimA_routing') && claimsA04.includes('ClaimC_bridge'),
    'A-04: tags ClaimA_routing + ClaimC_bridge when stateTransitions exist')

  // A-05
  const procA05: ProcessRecord = {
    routeTaken: 'L3_AI',
    decisionReasonCode: 'L3_AI_INFERRED',
    decisionReasonDetails: {},
    triggerScore: 0.8,
    evidenceUsed: ['ev-001', 'ev-002'],
    stateTransitionPath: [],
    optimizerRoute: null,
    judgmentRuleId: null,
  }
  assert(inferPatentClaims(procA05).includes('ClaimB_evidence'),
    'A-05: tags ClaimB_evidence when evidence + trigger score')

  // A-06
  const procA06: ProcessRecord = {
    routeTaken: 'L6_HUMAN',
    decisionReasonCode: 'L6_ESCALATION',
    decisionReasonDetails: {},
    triggerScore: null,
    evidenceUsed: [],
    stateTransitionPath: [],
    optimizerRoute: null,
    judgmentRuleId: 'JUDG-004',
  }
  const claimsA06 = inferPatentClaims(procA06)
  assert(!claimsA06.includes('ClaimA_routing') && claimsA06.includes('ClaimA_judgment'),
    'A-06: L6_HUMAN excluded from ClaimA_routing, has ClaimA_judgment')

  // A-07
  const statsEmpty = computeEvidenceStats([])
  assert(statsEmpty.totalRecords === 0 && statsEmpty.avgTriggerScore === null && statsEmpty.dateRange === null,
    'A-07: computeEvidenceStats returns empty stats for no records')
  assert(statsEmpty.unavailableMetrics.length > 0,
    'A-07b: unavailableMetrics populated even for empty')

  // A-08
  const records08 = [
    makeEvidenceRecord({ recordId: 'ecr_1', module: 'routing' as const, baselineComparisonFlag: true }),
    makeEvidenceRecord({ recordId: 'ecr_2', module: 'bridge' as const, process: { ...makeEvidenceRecord().process, triggerScore: 0.5 } }),
    makeEvidenceRecord({ recordId: 'ecr_3', module: 'routing' as const, process: { ...makeEvidenceRecord().process, triggerScore: 1.0 } }),
  ]
  const stats08 = computeEvidenceStats(records08)
  assert(stats08.totalRecords === 3, 'A-08: totalRecords = 3')
  assert(stats08.byModule['routing'] === 2, 'A-08b: routing module count = 2')
  assert(stats08.baselineCount === 1, 'A-08c: baselineCount = 1')
  assert(stats08.avgTriggerScore !== null && Math.abs(stats08.avgTriggerScore - 0.75) < 0.01,
    'A-08d: avgTriggerScore ≈ 0.75')

  // A-09
  const stats09 = computeEvidenceStats([makeEvidenceRecord()])
  assert(
    stats09.unavailableMetrics.includes('cost_estimate_tokens') &&
    stats09.unavailableMetrics.includes('escalation_rate') &&
    stats09.unavailableMetrics.includes('action_success_proxy') &&
    stats09.unavailableMetrics.includes('long_term_retention') &&
    stats09.unavailableMetrics.includes('knowledge_gap_fill_rate'),
    'A-09: unavailableMetrics includes all 5 required metrics')

  // A-10
  const records10 = [
    makeEvidenceRecord({ recordId: 'ecr_1', module: 'routing' as const }),
    makeEvidenceRecord({ recordId: 'ecr_2', module: 'bridge' as const }),
    makeEvidenceRecord({ recordId: 'ecr_3', module: 'evidence' as const }),
  ]
  assert(
    filterByModule(records10, 'routing').length === 1 &&
    filterByModule(records10, 'bridge').length === 1 &&
    filterByModule(records10, 'evidence').length === 1,
    'A-10: filterByModule returns only matching module')

  // A-11
  const records11 = [
    makeEvidenceRecord({ recordId: 'ecr_1', patentClaimRelevant: ['ClaimA_routing'] }),
    makeEvidenceRecord({ recordId: 'ecr_2', patentClaimRelevant: ['ClaimB_evidence'] }),
    makeEvidenceRecord({ recordId: 'ecr_3', patentClaimRelevant: ['ClaimA_routing', 'ClaimC_bridge'] }),
  ]
  assert(filterByClaimRelevance(records11, 'ClaimA_routing').length === 2,
    'A-11: filterByClaimRelevance ClaimA_routing = 2')
  assert(filterByClaimRelevance(records11, 'ClaimC_bridge').length === 1,
    'A-11b: filterByClaimRelevance ClaimC_bridge = 1')

  // A-12
  const records12 = [
    makeEvidenceRecord({ recordId: 'ecr_1', timestamp: '2026-01-01T00:00:00Z' }),
    makeEvidenceRecord({ recordId: 'ecr_2', timestamp: '2026-06-15T00:00:00Z' }),
    makeEvidenceRecord({ recordId: 'ecr_3', timestamp: '2026-12-31T00:00:00Z' }),
  ]
  const filtered12 = filterByDateRange(records12, '2026-03-01', '2026-09-01')
  assert(filtered12.length === 1 && filtered12[0].recordId === 'ecr_2',
    'A-12: filterByDateRange returns mid-range record only')

  // A-13
  const report13 = exportForPatentReport([])
  assert(report13.routingStats.totalDecisions === 0 && !report13.filingReadiness.overallReady,
    'A-13: empty exportForPatentReport not ready')

  // A-14
  const records14: EvidenceChainRecord[] = []
  for (let i = 0; i < 200; i++) {
    records14.push(makeEvidenceRecord({ recordId: `ecr_r_${i}`, module: 'routing' as const }))
  }
  for (let i = 0; i < 30; i++) {
    records14.push(makeEvidenceRecord({
      recordId: `ecr_b_${i}`,
      module: 'bridge' as const,
      process: { ...makeEvidenceRecord().process, stateTransitionPath: ['idle', 'completed'] },
      output: { answerType: 'L5', userAction: null, timeToFirstActionMs: 3000 },
    }))
  }
  for (let i = 0; i < 100; i++) {
    records14.push(makeEvidenceRecord({ recordId: `ecr_e_${i}`, module: 'evidence' as const }))
  }
  const report14 = exportForPatentReport(records14)
  assert(
    report14.filingReadiness.routingDataSufficient &&
    report14.filingReadiness.bridgeDataSufficient &&
    report14.filingReadiness.evidenceDataSufficient &&
    report14.filingReadiness.overallReady,
    'A-14: sufficient data marks filingReadiness.overallReady = true')

  // A-15
  const recA15 = createEvidenceRecord({
    module: 'routing',
    queryId: 'q-auto',
    sessionId: 's-auto',
    input: { queryText: 'auto test', userLanguage: 'ja' },
    routeTaken: 'L3_AI',
    decisionReasonCode: 'L3_AI_INFERRED',
    decisionReasonDetails: {},
    evidenceUsed: ['ev-1'],
    triggerScore: 0.8,
    judgmentRuleId: 'JUDG-001',
    answerType: 'L3',
  })
  assert(
    recA15.patentClaimRelevant.includes('ClaimA_routing') &&
    recA15.patentClaimRelevant.includes('ClaimB_evidence') &&
    recA15.patentClaimRelevant.includes('ClaimA_judgment'),
    'A-15: auto-infers ClaimA_routing + ClaimB_evidence + ClaimA_judgment')

  // ═══════════════════════════════════════════════════════════════════
  // B. Baseline Comparison Engine (12 tests)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══ B. Baseline Comparison Engine ═══')

  // B-01
  const mB01 = createBaselineMetrics(150)
  assert(
    mB01.responseTimeMs === 150 &&
    mB01.routeTaken === null &&
    mB01.costEstimateTokens === null &&
    mB01.escalationRate === null &&
    mB01.actionSuccessProxy === null,
    'B-01: createBaselineMetrics sets unavailable fields to null')

  // B-02
  const mB02 = createJtgMetrics({ responseTimeMs: 200, routeTaken: 'L3_AI', evidenceUsedCount: 3, stateTransitions: 5 })
  assert(
    mB02.responseTimeMs === 200 &&
    mB02.routeTaken === 'L3_AI' &&
    mB02.evidenceUsedCount === 3 &&
    mB02.costEstimateTokens === null,
    'B-02: createJtgMetrics populates JTG fields, null for unavailable')

  // B-03
  const deltaB03 = computeDelta(createBaselineMetrics(100), createJtgMetrics({ responseTimeMs: 80, routeTaken: 'L3', evidenceUsedCount: 2, stateTransitions: 3 }))
  assert(
    deltaB03.deltas['response_time_ms'] !== undefined &&
    deltaB03.deltas['response_time_ms'].delta === -20,
    'B-03: computeDelta computes response_time_ms delta = -20')
  assert(deltaB03.deltas['evidence_used_count'].delta === 2,
    'B-03b: evidence_used_count delta = 2')
  assert(
    deltaB03.unavailable.includes('cost_estimate_tokens') &&
    deltaB03.unavailable.includes('escalation_rate'),
    'B-03c: unavailable includes null-pair metrics')

  // B-04
  const runB04 = createComparisonRun({
    inputSetId: 'test-set-1',
    queryText: 'deposit return question',
    sampleIndex: 0,
    modeA: createBaselineMetrics(100),
    modeB: createJtgMetrics({ responseTimeMs: 80, routeTaken: 'L3', evidenceUsedCount: 2, stateTransitions: 0 }),
  })
  assert(runB04.runId.startsWith('comp_'), 'B-04: createComparisonRun generates comp_ prefix')
  assert(runB04.unavailableMetrics.length > 0, 'B-04b: unavailableMetrics populated')

  // B-05
  const tB05 = welchTTest([100, 100, 100, 100, 100], [100, 100, 100, 100, 100])
  assert(tB05.tStatistic === 0 && !tB05.significant,
    'B-05: welchTTest not significant for identical samples')

  // B-06
  const tB06 = welchTTest(
    [100, 102, 98, 101, 99, 103, 97, 100, 101, 98],
    [50, 52, 48, 51, 49, 53, 47, 50, 51, 48],
  )
  assert(Math.abs(tB06.tStatistic) > 2 && tB06.pValue < 0.05 && tB06.significant,
    'B-06: welchTTest detects significant difference')

  // B-07
  const tB07 = welchTTest([1], [2])
  assert(tB07.tStatistic === 0 && tB07.pValue === 1 && !tB07.significant,
    'B-07: welchTTest handles insufficient samples gracefully')

  // B-08
  const summaryB08 = computeSummary([])
  assert(summaryB08.totalRuns === 0 && summaryB08.statisticalSignificance === null,
    'B-08: computeSummary returns empty for no runs')
  assert(summaryB08.unavailableMetrics.length > 0,
    'B-08b: unavailableMetrics populated for empty summary')

  // B-09
  const runsB09 = Array.from({ length: 5 }, (_, i) =>
    createComparisonRun({
      inputSetId: 'set-1',
      queryText: `query-${i}`,
      sampleIndex: i,
      modeA: createBaselineMetrics(100 + i * 10),
      modeB: createJtgMetrics({ responseTimeMs: 80 + i * 5, routeTaken: 'L3', evidenceUsedCount: 2, stateTransitions: 1 }),
    }),
  )
  const summaryB09 = computeSummary(runsB09)
  assert(summaryB09.totalRuns === 5, 'B-09: computeSummary totalRuns = 5')
  assert(summaryB09.avgDeltas['response_time_ms'] !== undefined &&
    summaryB09.avgDeltas['response_time_ms'].avgDelta < 0,
    'B-09b: avgDelta for response_time_ms is negative (JTG faster)')

  // B-10
  assert(
    UNAVAILABLE_METRICS.includes('cost_estimate_tokens') &&
    UNAVAILABLE_METRICS.includes('escalation_rate') &&
    UNAVAILABLE_METRICS.includes('action_success_proxy') &&
    UNAVAILABLE_METRICS.includes('long_term_retention') &&
    UNAVAILABLE_METRICS.includes('knowledge_gap_fill_rate'),
    'B-10: UNAVAILABLE_METRICS includes all 5 required metrics')

  // B-11
  const runsB11 = Array.from({ length: 10 }, (_, i) =>
    createComparisonRun({
      inputSetId: 'set-sig',
      queryText: `query-${i}`,
      sampleIndex: i,
      modeA: createBaselineMetrics(200 + i),
      modeB: createJtgMetrics({ responseTimeMs: 100 + i, routeTaken: 'L3', evidenceUsedCount: 2, stateTransitions: 1 }),
    }),
  )
  const summaryB11 = computeSummary(runsB11)
  assert(summaryB11.statisticalSignificance !== null &&
    summaryB11.statisticalSignificance['response_time_ms'] !== undefined,
    'B-11: computeSummary includes statistical significance for response_time_ms')

  // B-12
  const deltaB12 = computeDelta(createBaselineMetrics(100), createBaselineMetrics(200))
  assert(deltaB12.deltas['response_time_ms'] !== undefined &&
    deltaB12.deltas['response_time_ms'].delta === 100,
    'B-12: computeDelta handles baseline-vs-baseline')
  assert(deltaB12.unavailable.includes('cost_estimate_tokens'),
    'B-12b: null metrics listed as unavailable')

  // ═══════════════════════════════════════════════════════════════════
  // C. Claim Mapping (8 tests)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══ C. Claim Mapping ═══')

  // C-01
  assert(CLAIM_STRUCTURES.length === 3, 'C-01: CLAIM_STRUCTURES has 3 schemes')
  const schemes = CLAIM_STRUCTURES.map((c) => c.scheme)
  assert(schemes.includes('A') && schemes.includes('B') && schemes.includes('C'),
    'C-01b: schemes are A, B, C')

  // C-02
  const schemeAElements = ALL_CLAIM_ELEMENTS.filter((e) => e.scheme === 'A')
  const schemeBElements = ALL_CLAIM_ELEMENTS.filter((e) => e.scheme === 'B')
  const schemeCElements = ALL_CLAIM_ELEMENTS.filter((e) => e.scheme === 'C')
  assert(schemeAElements.length > 0 && schemeBElements.length > 0 && schemeCElements.length > 0,
    'C-02: ALL_CLAIM_ELEMENTS has elements from all 3 schemes')

  // C-03
  const claimA = getClaimStructure('A')
  assert(
    claimA.scheme === 'A' &&
    claimA.independentClaim.length > 0 &&
    claimA.elements.length > 0 &&
    claimA.nearestPriorArt.length > 0,
    'C-03: getClaimStructure returns complete scheme A')

  // C-04
  const elA1 = getClaimElement('A1')
  assert(elA1 !== null && elA1.scheme === 'A' && elA1.codeModules.length > 0,
    'C-04: getClaimElement returns A1 with code modules')

  // C-05
  assert(getClaimElement('Z99') === null, 'C-05: getClaimElement returns null for unknown')

  // C-06
  const optimizerElements = getElementsForModule('routing/optimizer.ts')
  assert(optimizerElements.length > 0 && optimizerElements.every((e) => e.scheme === 'A'),
    'C-06: getElementsForModule finds optimizer references in scheme A')

  // C-07
  const measuredByElements = getElementsMeasuredBy('routingDecision.queryId')
  assert(measuredByElements.length > 0,
    'C-07: getElementsMeasuredBy finds matching elements')

  // C-08
  let allFieldsValid = true
  for (const el of ALL_CLAIM_ELEMENTS) {
    if (!el.elementId || !el.description || !el.triggerCondition ||
        !el.technicalEffect || el.codeModules.length === 0 ||
        !el.measuredBy || !el.priorArtRisk || !/^[ABC]$/.test(el.scheme)) {
      allFieldsValid = false
      console.error(`    C-08 fail: ${el.elementId} missing required fields`)
      break
    }
  }
  assert(allFieldsValid, 'C-08: every element has all required fields')

  // ═══════════════════════════════════════════════════════════════════
  // D. Technical Effect Extractor (12 tests)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══ D. Technical Effect Extractor ═══')

  // D-01
  const effectsD01 = extractRoutingEffects([])
  assert(effectsD01.length === 4 && effectsD01.every((e: { claim: string }) => e.claim === 'ClaimA'),
    'D-01: extractRoutingEffects returns 4 ClaimA effects')

  // D-02
  const recordsD02 = [
    makeRoutingRecord({ id: 'rd-1', layer6Triggered: false }),
    makeRoutingRecord({ id: 'rd-2', layer6Triggered: false }),
    makeRoutingRecord({ id: 'rd-3', layer6Triggered: true }),
  ] as any[]
  const effectsD02 = extractRoutingEffects(recordsD02)
  const l6D02 = effectsD02.find((e: { effectId: string }) => e.effectId === 'A-L6-RATE')!
  assert(l6D02.jtgValue !== null && Math.abs(l6D02.jtgValue - 1 / 3) < 0.01,
    'D-02: L6 rate ≈ 0.333 for 1/3 triggered')
  assert(l6D02.status === 'insufficient_data', 'D-02b: insufficient_data with N=3')

  // D-03
  const effectsD03 = extractBridgeEffects([])
  assert(effectsD03.length === 3 && effectsD03.every((e: { claim: string }) => e.claim === 'ClaimC'),
    'D-03: extractBridgeEffects returns 3 ClaimC effects')

  // D-04
  const recordsD04 = [
    makeBridgeRecord({ id: 'bs-1', statesTraversed: ['idle', 'completed'] }),
    makeBridgeRecord({ id: 'bs-2', statesTraversed: ['idle', 'escalated'] }),
    makeBridgeRecord({ id: 'bs-3', statesTraversed: ['idle', 'completed'] }),
  ] as any[]
  const effectsD04 = extractBridgeEffects(recordsD04)
  const completionD04 = effectsD04.find((e: { effectId: string }) => e.effectId === 'C-COMPLETION-RATE')!
  assert(completionD04.jtgValue !== null && Math.abs(completionD04.jtgValue - 2 / 3) < 0.01,
    'D-04: completion rate ≈ 0.667 for 2/3 completed')

  // D-05
  const effectsD05 = extractEvidenceEffects([])
  assert(effectsD05.length === 2 && effectsD05.every((e: { claim: string }) => e.claim === 'ClaimB'),
    'D-05: extractEvidenceEffects returns 2 ClaimB effects')

  // D-06
  const recordsD06 = [
    makeEvidenceInjectionRecord({ id: 'ei-1', evidenceInjected: true }),
    makeEvidenceInjectionRecord({ id: 'ei-2', evidenceInjected: false }),
    makeEvidenceInjectionRecord({ id: 'ei-3', evidenceInjected: true }),
    makeEvidenceInjectionRecord({ id: 'ei-4', evidenceInjected: true }),
  ] as any[]
  const effectsD06 = extractEvidenceEffects(recordsD06)
  const injectionD06 = effectsD06.find((e: { effectId: string }) => e.effectId === 'B-INJECTION-RATE')!
  assert(injectionD06.jtgValue !== null && Math.abs(injectionD06.jtgValue - 0.75) < 0.01,
    'D-06: injection rate = 0.75 for 3/4 injected')
  assert(injectionD06.baselineValue === 0, 'D-06b: baseline = 0 (no injection)')

  // D-07
  const recordsD07 = [
    makeEvidenceInjectionRecord({ id: 'ei-1', evidenceInjected: true, subsequentLayer6Trigger: false }),
    makeEvidenceInjectionRecord({ id: 'ei-2', evidenceInjected: true, subsequentLayer6Trigger: false }),
    makeEvidenceInjectionRecord({ id: 'ei-3', evidenceInjected: false, subsequentLayer6Trigger: true }),
    makeEvidenceInjectionRecord({ id: 'ei-4', evidenceInjected: false, subsequentLayer6Trigger: true }),
  ] as any[]
  const effectsD07 = extractEvidenceEffects(recordsD07)
  const l6D07 = effectsD07.find((e: { effectId: string }) => e.effectId === 'B-POST-INJECTION-L6')!
  assert(l6D07.jtgValue === 0 && l6D07.baselineValue === 1,
    'D-07: post-injection L6 = 0, no-injection L6 = 1')

  // D-08
  const readinessD08 = assessFilingReadiness([])
  assert(!readinessD08.ready && readinessD08.reasons.length > 0,
    'D-08: assessFilingReadiness not ready for empty effects')

  // D-09
  const readinessD09 = assessFilingReadiness([
    { effectId: 'A-1', claim: 'ClaimA', metric: 'test', baselineValue: 1, jtgValue: 0.5, delta: -0.5, unit: 'ratio', sampleSize: 50, status: 'measurable' as const, notes: '' },
    { effectId: 'C-1', claim: 'ClaimC', metric: 'test', baselineValue: null, jtgValue: 0.8, delta: null, unit: 'ratio', sampleSize: 10, status: 'measurable' as const, notes: '' },
    { effectId: 'B-1', claim: 'ClaimB', metric: 'test', baselineValue: 0, jtgValue: 0.6, delta: 0.6, unit: 'ratio', sampleSize: 30, status: 'measurable' as const, notes: '' },
  ])
  assert(!readinessD09.ready, 'D-09: not ready with insufficient sample sizes')
  assert(
    readinessD09.reasons.some((r: string) => r.includes('Routing')) &&
    readinessD09.reasons.some((r: string) => r.includes('Bridge')) &&
    readinessD09.reasons.some((r: string) => r.includes('Evidence')),
    'D-09b: reasons mention all 3 insufficient categories')

  // D-10
  const reportD10 = generateTechnicalEffectReport([
    makeRoutingRecord() as any,
    makeBridgeRecord() as any,
    makeEvidenceInjectionRecord() as any,
  ])
  assert(reportD10.totalRecords === 3, 'D-10: totalRecords = 3')
  assert(reportD10.effects.length === 4 + 3 + 2, 'D-10b: 9 total effects (4+3+2)')
  assert(!reportD10.filingReadiness.ready, 'D-10c: not ready with 1 record each')

  // D-11
  const recordsD11 = Array.from({ length: 250 }, (_, i) =>
    makeRoutingRecord({ id: `rd-${i}` }),
  ) as any[]
  const effectsD11 = extractRoutingEffects(recordsD11)
  const l6D11 = effectsD11.find((e: { effectId: string }) => e.effectId === 'A-L6-RATE')!
  assert(l6D11.status === 'measurable' && l6D11.sampleSize === 250,
    'D-11: 250 routing records → measurable status')

  // D-12
  const effectsD12 = extractRoutingEffects([])
  assert(effectsD12.every((e: { status: string; sampleSize: number }) => e.status === 'insufficient_data' && e.sampleSize === 0),
    'D-12: empty records → all insufficient_data with sampleSize 0')

  // ═══════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`JTG v8 Patent Engineering Tests: ${passed} passed, ${failed} failed (${passed + failed} total)`)
  console.log('═'.repeat(60))

  return failed
}

main()
  .then((failures) => {
    if (failures > 0) process.exit(1)
  })
  .catch((err) => {
    console.error('Test runner error:', err)
    process.exit(2)
  })
