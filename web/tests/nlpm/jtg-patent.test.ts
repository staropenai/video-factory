/**
 * JTG Patent PoC — Regression suite for patent infrastructure:
 *   1. f_lang: language action capacity index (方案A 要素2)
 *   2. Confidence decay: evidence temporal decay (方案B)
 *   3. Trigger score: evidence injection trigger (方案B)
 *   4. Metrics collector: record builders (方案A/B/C)
 *   5. Report generator: patent evidence report (all schemes)
 *
 * Run from web/ directory: `npx tsx tests/nlpm/jtg-patent.test.ts`
 *
 * All tests are pure — no DB, no network, no filesystem.
 */

import type { UserQueryRow } from '../../src/lib/db/tables'
import type { EvidenceRecord } from '../../src/lib/db/tables'

async function main(): Promise<number> {
  const {
    computeFLang,
    detectScripts,
    hasMultipleScriptFamilies,
    shouldActivateBridge,
  } = await import('../../src/lib/patent/f-lang')
  // FLangParams type inferred from computeFLang signature

  const {
    computeDecayMultiplier,
    computeCurrentConfidence,
    computeBatchConfidence,
    filterActiveEvidence,
    computeTextEntropy,
    computeTriggerScore,
  } = await import('../../src/lib/patent/confidence-decay')

  const {
    buildRoutingDecisionRecord,
    buildBridgeSessionRecord,
    buildEvidenceInjectionRecord,
  } = await import('../../src/lib/patent/metrics-collector')

  const {
    computeRoutingStats,
    computeBridgeStats,
    computeEvidenceInjectionStats,
    generatePatentReport,
  } = await import('../../src/lib/patent/report')

  interface SpecResult {
    id: string
    description: string
    assertions: Record<string, unknown>
    failures: string[]
  }
  const results: SpecResult[] = []

  function assertEq<T>(
    label: string,
    actual: T,
    expected: T,
    failures: string[],
  ): void {
    if (actual !== expected) {
      failures.push(
        `${label}: expected=${JSON.stringify(expected)} got=${JSON.stringify(actual)}`,
      )
    }
  }

  function assertTrue(label: string, actual: boolean, failures: string[]): void {
    if (!actual) failures.push(`${label}: expected true, got false`)
  }

  function assertRange(label: string, value: number, min: number, max: number, failures: string[]): void {
    if (value < min || value > max) {
      failures.push(`${label}: ${value} not in [${min}, ${max}]`)
    }
  }

  function run(
    id: string,
    description: string,
    body: (f: string[], a: Record<string, unknown>) => void,
  ) {
    const failures: string[] = []
    const assertions: Record<string, unknown> = {}
    try {
      body(failures, assertions)
    } catch (e) {
      failures.push(`threw: ${e instanceof Error ? e.message : String(e)}`)
    }
    results.push({ id, description, assertions, failures })
  }

  // ====================================================================
  // Test data factories.
  // ====================================================================

  function makeQuery(overrides: Partial<UserQueryRow> = {}): UserQueryRow {
    return {
      id: 'q_test', timestamp: '2026-04-01T10:00:00Z', queryText: 'test',
      detectedLanguage: 'en', answerMode: 'normal', riskLevel: 'low',
      confidenceBand: 'medium', shouldEscalate: false, knowledgeFound: true,
      topFaqId: null, topFaqCategory: null, topScore: 0.5, matchCount: 1,
      selectedRuleKeys: [], ...overrides,
    }
  }

  function makeEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
    return {
      id: 'ev_test', type: 'government_website', topicTags: ['test'],
      location: null, dateCollected: '2026-01-01', contentSummary: 'Test',
      sourceUrl: null, filePath: null, confidenceLevel: 'official',
      expiryDate: null, linkedCardIds: [], createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z', status: 'active', ...overrides,
    }
  }

  const params = {
    w1: 0.6, w2: 0.4, windowDays: 30,
    coldStartDefault: 0.3, minHistoryCount: 3, targetLanguage: 'ja' as const,
  }

  // ====================================================================
  // Group 1 — f_lang (Tests 01..08)
  // ====================================================================

  run('Test-01', 'PAT-A f_lang cold start returns default when < minHistoryCount', (f, a) => {
    const queries = [makeQuery(), makeQuery()]
    const result = computeFLang(queries, params, new Date('2026-04-01T12:00:00Z'))
    a.value = result.value
    a.coldStart = result.coldStart
    assertEq('cold_start', result.coldStart, true, f)
    assertEq('value', result.value, 0.3, f)
  })

  run('Test-02', 'PAT-A f_lang all-Japanese queries → f_lang reflects kana+kanji code-switch', (f, a) => {
    const queries = Array.from({ length: 10 }, (_, i) =>
      makeQuery({
        id: `q_${i}`, timestamp: '2026-04-01T10:00:00Z',
        detectedLanguage: 'ja', queryText: 'こんにちは質問です',
      }),
    )
    const result = computeFLang(queries, params, new Date('2026-04-01T12:00:00Z'))
    a.value = result.value
    a.l2Ratio = result.l2QueryRatio
    a.codeSwitchFreq = result.codeSwitchFrequency
    // All Japanese → l2Ratio = 0
    assertEq('l2_ratio', result.l2QueryRatio, 0, f)
    // Japanese text has kana+CJK → codeSwitchFrequency = 1.0
    // f_lang = 0.6*0 + 0.4*(1-1) = 0
    assertEq('code_switch', result.codeSwitchFrequency, 1, f)
    assertEq('value', result.value, 0, f)
  })

  run('Test-03', 'PAT-A f_lang all-English queries → lower f_lang (more L2)', (f, a) => {
    const queries = Array.from({ length: 10 }, (_, i) =>
      makeQuery({
        id: `q_${i}`, timestamp: '2026-04-01T10:00:00Z',
        detectedLanguage: 'en', queryText: 'How do I rent an apartment?',
      }),
    )
    const result = computeFLang(queries, params, new Date('2026-04-01T12:00:00Z'))
    a.value = result.value
    a.l2Ratio = result.l2QueryRatio
    // All English → l2Ratio = 1 → f_lang = 0.6*1 + 0.4*(1-0) = 1.0
    assertEq('l2_ratio', result.l2QueryRatio, 1, f)
    assertEq('value', result.value, 1.0, f)
  })

  run('Test-04', 'PAT-A f_lang mixed queries with code-switching', (f, a) => {
    const queries = [
      makeQuery({ id: 'q1', timestamp: '2026-04-01T10:00:00Z', detectedLanguage: 'en', queryText: 'How to do 確定申告 filing?' }),
      makeQuery({ id: 'q2', timestamp: '2026-04-01T10:00:00Z', detectedLanguage: 'ja', queryText: '日本語の質問' }),
      makeQuery({ id: 'q3', timestamp: '2026-04-01T10:00:00Z', detectedLanguage: 'zh', queryText: '请问rent怎么付' }),
      makeQuery({ id: 'q4', timestamp: '2026-04-01T10:00:00Z', detectedLanguage: 'en', queryText: 'Pure English question' }),
    ]
    const result = computeFLang(queries, params, new Date('2026-04-01T12:00:00Z'))
    a.value = result.value
    a.l2Ratio = result.l2QueryRatio
    a.codeSwitchFreq = result.codeSwitchFrequency
    // 3/4 are non-ja → l2Ratio = 0.75
    assertEq('l2_ratio', result.l2QueryRatio, 0.75, f)
    // q1 has Latin+CJK, q2 has kana+CJK, q3 has CJK+Latin → 3/4 code-switch
    assertEq('code_switch', result.codeSwitchFrequency, 0.75, f)
    assertRange('value', result.value, 0, 1, f)
  })

  run('Test-05', 'PAT-A detectScripts identifies multiple Unicode blocks', (f, a) => {
    const scripts = detectScripts('Hello 世界 こんにちは カタカナ')
    a.scripts = Array.from(scripts)
    assertTrue('has_latin', scripts.has('latin'), f)
    assertTrue('has_cjk', scripts.has('cjk'), f)
    assertTrue('has_hiragana', scripts.has('hiragana'), f)
    assertTrue('has_katakana', scripts.has('katakana'), f)
  })

  run('Test-06', 'PAT-A hasMultipleScriptFamilies true for mixed text', (f, a) => {
    a.mixed = hasMultipleScriptFamilies('How to do 確定申告?')
    a.pure_en = hasMultipleScriptFamilies('Pure English text')
    a.pure_ja = hasMultipleScriptFamilies('日本語だけのテキスト')
    assertTrue('mixed_true', hasMultipleScriptFamilies('How to do 確定申告?'), f)
    assertTrue('pure_en_false', !hasMultipleScriptFamilies('Pure English text'), f)
  })

  run('Test-07', 'PAT-A shouldActivateBridge true when f_lang below tau', (f, a) => {
    a.low = shouldActivateBridge(0.2, 0.45)
    a.high = shouldActivateBridge(0.8, 0.45)
    a.edge = shouldActivateBridge(0.45, 0.45)
    assertTrue('low_activates', shouldActivateBridge(0.2, 0.45), f)
    assertTrue('high_no_activate', !shouldActivateBridge(0.8, 0.45), f)
    assertTrue('edge_no_activate', !shouldActivateBridge(0.45, 0.45), f)
  })

  run('Test-08', 'PAT-A f_lang filters by window (old queries excluded)', (f, a) => {
    const queries = [
      makeQuery({ id: 'q1', timestamp: '2026-04-01T10:00:00Z', detectedLanguage: 'en' }),
      makeQuery({ id: 'q2', timestamp: '2026-04-01T10:00:00Z', detectedLanguage: 'en' }),
      makeQuery({ id: 'q3', timestamp: '2026-04-01T10:00:00Z', detectedLanguage: 'en' }),
      makeQuery({ id: 'q4', timestamp: '2025-01-01T10:00:00Z', detectedLanguage: 'ja' }), // old
    ]
    const result = computeFLang(queries, params, new Date('2026-04-01T12:00:00Z'))
    a.queryCount = result.queryCount
    // Only 3 in window (q4 is outside 30-day window)
    assertEq('query_count', result.queryCount, 3, f)
  })

  // ====================================================================
  // Group 2 — Confidence decay (Tests 09..16)
  // ====================================================================

  run('Test-09', 'PAT-B exponential decay multiplier halves at half-life', (f, a) => {
    const mult = computeDecayMultiplier(180, { type: 'exponential', halfLifeDays: 180 })
    a.multiplier = mult
    // At half-life, should be ~0.5
    assertRange('half_life', mult, 0.49, 0.51, f)
  })

  run('Test-10', 'PAT-B linear decay reaches 0 at expected time', (f, a) => {
    const rate = 0.002
    const daysToZero = 1 / rate  // 500 days
    const atZero = computeDecayMultiplier(daysToZero, { type: 'linear', linearRatePerDay: rate })
    const beforeZero = computeDecayMultiplier(daysToZero - 1, { type: 'linear', linearRatePerDay: rate })
    a.atZero = atZero
    a.beforeZero = beforeZero
    assertEq('at_zero', atZero, 0, f)
    assertTrue('before_zero_positive', beforeZero > 0, f)
  })

  run('Test-11', 'PAT-B step decay is 1 before expiry, 0 after', (f, a) => {
    const before = computeDecayMultiplier(364, { type: 'step', stepExpiryDays: 365 })
    const after = computeDecayMultiplier(365, { type: 'step', stepExpiryDays: 365 })
    a.before = before
    a.after = after
    assertEq('before_expiry', before, 1.0, f)
    assertEq('after_expiry', after, 0.0, f)
  })

  run('Test-12', 'PAT-B computeCurrentConfidence official evidence fresh → high conf', (f, a) => {
    const ev = makeEvidence({ dateCollected: '2026-04-01', confidenceLevel: 'official' })
    const result = computeCurrentConfidence(ev, { type: 'exponential', halfLifeDays: 180 }, 0.3, new Date('2026-04-01'))
    a.base = result.confidenceBase
    a.current = result.confidenceCurrent
    a.needsUpdate = result.needsUpdate
    assertEq('base', result.confidenceBase, 1.0, f)
    assertRange('current', result.confidenceCurrent, 0.99, 1.01, f)
    assertEq('no_update', result.needsUpdate, false, f)
  })

  run('Test-13', 'PAT-B computeCurrentConfidence unverified old evidence → needs update', (f, a) => {
    const ev = makeEvidence({ dateCollected: '2024-01-01', confidenceLevel: 'unverified' })
    const result = computeCurrentConfidence(ev, { type: 'exponential', halfLifeDays: 180 }, 0.3, new Date('2026-04-01'))
    a.base = result.confidenceBase
    a.current = result.confidenceCurrent
    a.needsUpdate = result.needsUpdate
    // unverified base = 0.5, after ~820 days with 180-day half-life → very low
    assertTrue('needs_update', result.needsUpdate, f)
    assertTrue('current_low', result.confidenceCurrent < 0.3, f)
  })

  run('Test-14', 'PAT-B filterActiveEvidence separates active from needs-update', (f, a) => {
    const records = [
      makeEvidence({ id: 'ev_1', dateCollected: '2026-03-01', confidenceLevel: 'official' }),
      makeEvidence({ id: 'ev_2', dateCollected: '2023-01-01', confidenceLevel: 'unverified' }),
      makeEvidence({ id: 'ev_3', dateCollected: '2026-01-01', confidenceLevel: 'verified' }),
    ]
    const { active, needsUpdate } = filterActiveEvidence(
      records, { type: 'exponential', halfLifeDays: 180 }, 0.3, new Date('2026-04-01'),
    )
    a.activeCount = active.length
    a.needsUpdateCount = needsUpdate.length
    assertTrue('has_active', active.length >= 1, f)
    assertTrue('has_needs_update', needsUpdate.length >= 1, f)
    // ev_2 (2023, unverified) should need update
    assertTrue('ev2_needs_update', needsUpdate.some((r) => r.evidenceId === 'ev_2'), f)
  })

  run('Test-15', 'PAT-B computeTextEntropy > 0 for varied text, 0 for empty', (f, a) => {
    const varied = computeTextEntropy('How do I sort garbage in Japan?')
    const empty = computeTextEntropy('')
    const single = computeTextEntropy('aaaaaaa')
    a.varied = varied
    a.empty = empty
    a.single = single
    assertTrue('varied_positive', varied > 0, f)
    assertEq('empty_zero', empty, 0, f)
    assertEq('single_zero', single, 0, f)
  })

  run('Test-16', 'PAT-B triggerScore shouldInject when above theta', (f, a) => {
    const high = computeTriggerScore(
      { textEntropy: 4.0, dwellNormalized: 0.8, clickPatternScore: 0.7 },
      { w1: 0.5, w2: 0.3, w3: 0.2, theta: 0.6 },
    )
    const low = computeTriggerScore(
      { textEntropy: 1.0, dwellNormalized: 0.1, clickPatternScore: 0.1 },
      { w1: 0.5, w2: 0.3, w3: 0.2, theta: 0.6 },
    )
    a.highScore = high.score
    a.highInject = high.shouldInject
    a.lowScore = low.score
    a.lowInject = low.shouldInject
    assertTrue('high_injects', high.shouldInject, f)
    assertTrue('low_no_inject', !low.shouldInject, f)
  })

  // ====================================================================
  // Group 3 — Metrics collector builders (Tests 17..20)
  // ====================================================================

  run('Test-17', 'PAT-COL buildRoutingDecisionRecord shapes correct output', (f, a) => {
    const rec = buildRoutingDecisionRecord({
      queryId: 'q_123',
      features: { fSemantic: 0.85, fRisk: 0.1, fLang: 0.6, fTemporal: false },
      routeTaken: 'L1_STATIC',
      costEstimate: 0,
      confidenceScore: 0.9,
      layer6Triggered: false,
    })
    a.metricType = rec.metricType
    a.hasId = !!rec.id
    a.queryId = rec.queryId
    assertEq('type', rec.metricType, 'ROUTING_DECISION', f)
    assertTrue('has_id', rec.id.startsWith('pm_route_'), f)
    assertEq('route', rec.routeTaken, 'L1_STATIC', f)
    assertEq('cost', rec.costEstimate, 0, f)
  })

  run('Test-18', 'PAT-COL buildBridgeSessionRecord shapes correct output', (f, a) => {
    const rec = buildBridgeSessionRecord({
      sessionId: 's_456',
      sceneTag: 'HOUSING-01',
      timeToFirstScript: 3.2,
      statesTraversed: ['σ0', 'σ1'],
      userCopiedScript: true,
      followupQuestions: 1,
      riskLevel: 'LOW',
      userLocale: 'zh',
    })
    a.metricType = rec.metricType
    a.sceneTag = rec.sceneTag
    a.copied = rec.userCopiedScript
    assertEq('type', rec.metricType, 'BRIDGE_SESSION', f)
    assertTrue('has_id', rec.id.startsWith('pm_bridge_'), f)
    assertEq('scene', rec.sceneTag, 'HOUSING-01', f)
    assertEq('time', rec.timeToFirstScript, 3.2, f)
  })

  run('Test-19', 'PAT-COL buildEvidenceInjectionRecord shapes correct output', (f, a) => {
    const rec = buildEvidenceInjectionRecord({
      queryId: 'q_789',
      triggerScore: 0.72,
      evidenceInjected: true,
      evidenceCount: 3,
      confidenceScores: [0.95, 0.80, 0.65],
      subsequentLayer6Trigger: false,
    })
    a.metricType = rec.metricType
    a.injected = rec.evidenceInjected
    assertEq('type', rec.metricType, 'EVIDENCE_INJECTION', f)
    assertTrue('has_id', rec.id.startsWith('pm_evid_'), f)
    assertEq('count', rec.evidenceCount, 3, f)
    assertEq('trigger', rec.triggerScore, 0.72, f)
  })

  run('Test-20', 'PAT-COL default userActionAfter is unknown', (f, a) => {
    const rec = buildRoutingDecisionRecord({
      queryId: 'q_x', features: { fSemantic: null, fRisk: 0, fLang: 0, fTemporal: false },
      routeTaken: 'L3_AI', costEstimate: 0.01, confidenceScore: 0.5,
    })
    a.action = rec.userActionAfter
    assertEq('default_unknown', rec.userActionAfter, 'unknown', f)
  })

  // ====================================================================
  // Group 4 — Report generator (Tests 21..26)
  // ====================================================================

  run('Test-21', 'PAT-RPT computeRoutingStats layer6TriggerRate correct', (f, a) => {
    const records = Array.from({ length: 10 }, (_, i) =>
      buildRoutingDecisionRecord({
        queryId: `q_${i}`,
        features: { fSemantic: 0.5, fRisk: 0.1, fLang: 0.5, fTemporal: false },
        routeTaken: 'L1_STATIC', costEstimate: 0, confidenceScore: 0.8,
        layer6Triggered: i < 2, // 2 out of 10
        userActionAfter: 'satisfied',
      }),
    )
    const stats = computeRoutingStats(records)
    a.total = stats.totalDecisions
    a.l6Rate = stats.layer6TriggerRate
    assertEq('total', stats.totalDecisions, 10, f)
    assertEq('l6_rate', stats.layer6TriggerRate, 0.2, f)
    assertEq('insufficient', stats.sufficientSampleSize, false, f)
  })

  run('Test-22', 'PAT-RPT computeBridgeStats median and copy rate', (f, a) => {
    const records = [
      buildBridgeSessionRecord({ sessionId: 's1', timeToFirstScript: 2.0, userCopiedScript: true, riskLevel: 'LOW', userLocale: 'en' }),
      buildBridgeSessionRecord({ sessionId: 's2', timeToFirstScript: 4.0, userCopiedScript: false, riskLevel: 'LOW', userLocale: 'zh' }),
      buildBridgeSessionRecord({ sessionId: 's3', timeToFirstScript: 3.0, userCopiedScript: true, riskLevel: 'LOW', userLocale: 'en' }),
    ]
    const stats = computeBridgeStats(records)
    a.median = stats.medianTimeToFirstScript
    a.copyRate = stats.scriptCopyRate
    assertEq('median', stats.medianTimeToFirstScript, 3.0, f)
    // 2 out of 3 copied
    assertRange('copy_rate', stats.scriptCopyRate, 0.66, 0.67, f)
  })

  run('Test-23', 'PAT-RPT computeEvidenceInjectionStats post-injection L6 rate', (f, a) => {
    const records = [
      buildEvidenceInjectionRecord({ queryId: 'q1', triggerScore: 0.8, evidenceInjected: true, evidenceCount: 2, subsequentLayer6Trigger: false }),
      buildEvidenceInjectionRecord({ queryId: 'q2', triggerScore: 0.9, evidenceInjected: true, evidenceCount: 1, subsequentLayer6Trigger: true }),
      buildEvidenceInjectionRecord({ queryId: 'q3', triggerScore: 0.3, evidenceInjected: false, subsequentLayer6Trigger: true }),
      buildEvidenceInjectionRecord({ queryId: 'q4', triggerScore: 0.2, evidenceInjected: false, subsequentLayer6Trigger: false }),
    ]
    const stats = computeEvidenceInjectionStats(records)
    a.injectionRate = stats.injectionRate
    a.postL6 = stats.postInjectionLayer6Rate
    a.noInjL6 = stats.noInjectionLayer6Rate
    // 2/4 injected
    assertEq('injection_rate', stats.injectionRate, 0.5, f)
    // Post-injection L6: 1/2 = 0.5
    assertEq('post_l6', stats.postInjectionLayer6Rate, 0.5, f)
    // No-injection L6: 1/2 = 0.5
    assertEq('no_inj_l6', stats.noInjectionLayer6Rate, 0.5, f)
  })

  run('Test-24', 'PAT-RPT generatePatentReport assembles all sections', (f, a) => {
    const records = [
      buildRoutingDecisionRecord({
        queryId: 'q1', features: { fSemantic: 0.5, fRisk: 0.1, fLang: 0.5, fTemporal: false },
        routeTaken: 'L1_STATIC', costEstimate: 0, confidenceScore: 0.8,
      }),
      buildBridgeSessionRecord({ sessionId: 's1', timeToFirstScript: 3.0, riskLevel: 'LOW', userLocale: 'en' }),
      buildEvidenceInjectionRecord({ queryId: 'q2', triggerScore: 0.7, evidenceInjected: true }),
    ]
    const report = generatePatentReport(records)
    a.hasRouting = report.routingEfficiency.totalDecisions > 0
    a.hasBridge = report.bridgeEffectiveness.totalSessions > 0
    a.hasEvidence = report.evidenceInjection.totalEvents > 0
    a.overallReady = report.filingReadiness.overallReady
    assertTrue('has_routing', report.routingEfficiency.totalDecisions === 1, f)
    assertTrue('has_bridge', report.bridgeEffectiveness.totalSessions === 1, f)
    assertTrue('has_evidence', report.evidenceInjection.totalEvents === 1, f)
    assertEq('not_ready', report.filingReadiness.overallReady, false, f)
  })

  run('Test-25', 'PAT-RPT filingReadiness requires N≥200/30/100', (f, a) => {
    const routing = Array.from({ length: 200 }, (_, i) =>
      buildRoutingDecisionRecord({
        queryId: `q_${i}`, features: { fSemantic: 0.5, fRisk: 0.1, fLang: 0.5, fTemporal: false },
        routeTaken: 'L1_STATIC', costEstimate: 0, confidenceScore: 0.8,
      }),
    )
    const stats = computeRoutingStats(routing)
    a.sufficient = stats.sufficientSampleSize
    assertEq('200_sufficient', stats.sufficientSampleSize, true, f)
  })

  run('Test-26', 'PAT-RPT empty records produce zero-filled report', (f, a) => {
    const report = generatePatentReport([])
    a.routingTotal = report.routingEfficiency.totalDecisions
    a.bridgeTotal = report.bridgeEffectiveness.totalSessions
    a.evidenceTotal = report.evidenceInjection.totalEvents
    assertEq('routing_0', report.routingEfficiency.totalDecisions, 0, f)
    assertEq('bridge_0', report.bridgeEffectiveness.totalSessions, 0, f)
    assertEq('evidence_0', report.evidenceInjection.totalEvents, 0, f)
    assertEq('not_ready', report.filingReadiness.overallReady, false, f)
  })

  // ====================================================================
  // Summary.
  // ====================================================================

  let failCount = 0
  for (const r of results) {
    const status = r.failures.length === 0 ? '[PASS]' : '[FAIL]'
    if (r.failures.length > 0) failCount++
    console.log(`${status} ${r.id}: ${r.description}`)
    if (r.failures.length > 0) {
      for (const failure of r.failures) {
        console.log(`  ✗ ${failure}`)
      }
    }
  }

  console.log(`\n--- Patent PoC Results: ${results.length - failCount}/${results.length} passed ---`)
  if (failCount > 0) {
    console.log(`FAILED: ${failCount} test(s)`)
  }
  return failCount
}

main().then((code) => process.exit(code))
