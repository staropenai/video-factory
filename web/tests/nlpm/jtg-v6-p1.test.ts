/**
 * JTG V6 P1 — Regression suite for V6 user-facing modules:
 *   1. Output style guide (style/output-guide.ts) — brand glossary, forbidden phrases, style rules
 *   2. Scenario templates (bridge/scenarios.ts) — 12 scenarios, lookup, search
 *   3. Evidence search (evidence/registry.ts) — search, expiry, confidence ranking
 *   4. Metrics snapshot (routing/metrics.ts) — snapshot builder integration
 *
 * Run from web/ directory: `npx tsx tests/nlpm/jtg-v6-p1.test.ts`
 *
 * All tests are pure — no DB, no network, no filesystem.
 */

import type { EvidenceRecord, EvidenceConfidence } from '../../src/lib/db/tables'
import type { LayerHitRate, LayerLabel } from '../../src/lib/routing/layer-stats'

async function main(): Promise<number> {
  const {
    checkOutputStyle,
    isStyleCompliant,
    BRAND_GLOSSARY,
    FORBIDDEN_PHRASES,
    STYLE_RULES,
  } = await import('../../src/lib/style/output-guide')

  const {
    SCENARIOS,
    getScenariosByCategory,
    getScenarioById,
    getScenarioCategories,
    searchScenarios,
  } = await import('../../src/lib/bridge/scenarios')

  const {
    searchEvidenceRecords,
    findExpiredRecords,
    confidenceRank,
    CONFIDENCE_LEVELS,
  } = await import('../../src/lib/evidence/registry')

  const {
    buildMetricSnapshot,
  } = await import('../../src/lib/routing/metrics')

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

  function assertTrue(
    label: string,
    actual: boolean,
    failures: string[],
  ): void {
    if (!actual) {
      failures.push(`${label}: expected true, got false`)
    }
  }

  function run(
    id: string,
    description: string,
    body: (failures: string[], assertions: Record<string, unknown>) => void,
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
  // Group P1-1 — Output Style Guide (Tests 01..08)
  // ====================================================================

  run('Test-01', 'P1-1 Brand glossary has at least 30 entries across 6 domains', (f, a) => {
    a.count = BRAND_GLOSSARY.length
    assertTrue('at_least_30', BRAND_GLOSSARY.length >= 30, f)
    const domains = new Set(BRAND_GLOSSARY.map((g) => g.domain))
    a.domainCount = domains.size
    assertEq('6_domains', domains.size, 6, f)
  })

  run('Test-02', 'P1-1 Every glossary entry has trilingual standard (en/zh/ja)', (f, a) => {
    let allValid = true
    for (const entry of BRAND_GLOSSARY) {
      if (!entry.standard.en || !entry.standard.zh || !entry.standard.ja) {
        f.push(`Missing language for term: ${entry.term}`)
        allValid = false
      }
    }
    a.allValid = allValid
    assertTrue('all_trilingual', allValid, f)
  })

  run('Test-03', 'P1-1 Forbidden phrases detect Chinese overconfidence pattern', (f, a) => {
    const result = checkOutputStyle('这个方法绝对没问题，放心使用')
    a.forbiddenCount = result.forbiddenMatches.length
    assertTrue('has_forbidden', result.forbiddenMatches.length > 0, f)
    assertTrue('score_reduced', result.score < 100, f)
  })

  run('Test-04', 'P1-1 Forbidden phrases detect English overpromising', (f, a) => {
    const result = checkOutputStyle(
      'Here is our understanding of your situation: This is guaranteed safe and definitely no problem.\nYou can proceed directly.',
    )
    a.forbiddenCount = result.forbiddenMatches.length
    assertTrue('has_forbidden', result.forbiddenMatches.length > 0, f)
  })

  run('Test-05', 'P1-1 Clean output passes style check with high score', (f, a) => {
    const goodOutput = [
      'Your monthly rent (家賃) is typically due by the 25th of each month.',
      'The management company (管理会社) handles all payment collection.',
      'Key points to remember:',
      '- Transfer the exact amount shown on your invoice',
      '- Keep the transfer receipt as evidence',
      'Next step: Contact your management company to confirm payment details.',
    ].join('\n')
    const result = checkOutputStyle(goodOutput)
    a.score = result.score
    a.violations = result.violations.length
    a.forbidden = result.forbiddenMatches.length
    assertTrue('score_gte_70', result.score >= 70, f)
    assertEq('no_forbidden', result.forbiddenMatches.length, 0, f)
  })

  run('Test-06', 'P1-1 isStyleCompliant returns false for empty text', (f, a) => {
    const compliant = isStyleCompliant('')
    a.compliant = compliant
    assertEq('not_compliant', compliant, false, f)
  })

  run('Test-07', 'P1-1 Style rule SR-03 flags risk-first opening line', (f, a) => {
    const scareText = '⚠ WARNING: This could be dangerous.\nHere is the information.\nYou can contact support.'
    const result = checkOutputStyle(scareText)
    const sr03Violation = result.violations.find((v) => v.ruleId === 'SR-03')
    a.hasSR03 = sr03Violation != null
    assertTrue('sr03_flagged', sr03Violation != null, f)
  })

  run('Test-08', 'P1-1 Style rules count matches STYLE_RULES length', (f, a) => {
    const result = checkOutputStyle('A reasonable answer with enough text.\nYou can proceed to the next step.')
    a.totalRules = result.totalRules
    assertEq('total_rules', result.totalRules, STYLE_RULES.length, f)
    assertEq('total_matches_const', result.totalRules, 5, f)
  })

  // ====================================================================
  // Group P1-3 — Scenario Templates (Tests 09..16)
  // ====================================================================

  run('Test-09', 'P1-3 Exactly 12 scenarios across 4 categories', (f, a) => {
    a.total = SCENARIOS.length
    assertEq('12_scenarios', SCENARIOS.length, 12, f)
    const categories = getScenarioCategories()
    a.categoryCount = categories.length
    assertEq('4_categories', categories.length, 4, f)
  })

  run('Test-10', 'P1-3 Each category has exactly 3 scenarios', (f, a) => {
    const categories: Array<'housing' | 'municipal' | 'utilities' | 'emergency'> = [
      'housing', 'municipal', 'utilities', 'emergency',
    ]
    for (const cat of categories) {
      const count = getScenariosByCategory(cat).length
      a[cat] = count
      assertEq(`${cat}_count`, count, 3, f)
    }
  })

  run('Test-11', 'P1-3 Every scenario has required fields', (f, a) => {
    let allValid = true
    for (const s of SCENARIOS) {
      if (!s.id || !s.openingLine || !s.reading || !s.title.en || !s.title.zh || !s.title.ja) {
        f.push(`Scenario ${s.id} missing required field`)
        allValid = false
      }
      if (s.branches.length === 0) {
        f.push(`Scenario ${s.id} has no branches`)
        allValid = false
      }
      if (s.failures.length === 0) {
        f.push(`Scenario ${s.id} has no failure templates`)
        allValid = false
      }
    }
    a.allValid = allValid
    assertTrue('all_valid', allValid, f)
  })

  run('Test-12', 'P1-3 getScenarioById returns correct scenario', (f, a) => {
    const s = getScenarioById('HOUSING-01')
    a.found = s != null
    assertTrue('found', s != null, f)
    assertEq('subcategory', s?.subcategory, 'repair_request', f)
    assertEq('category', s?.category, 'housing', f)
  })

  run('Test-13', 'P1-3 getScenarioById returns null for unknown id', (f, a) => {
    const s = getScenarioById('NONEXISTENT-99')
    a.found = s
    assertEq('null', s, null, f)
  })

  run('Test-14', 'P1-3 searchScenarios finds by English keyword', (f, a) => {
    const results = searchScenarios('deposit')
    a.count = results.length
    assertTrue('found_deposit', results.length >= 1, f)
    assertTrue('includes_housing03', results.some((s) => s.id === 'HOUSING-03'), f)
  })

  run('Test-15', 'P1-3 searchScenarios finds by Japanese keyword', (f, a) => {
    const results = searchScenarios('転入届')
    a.count = results.length
    assertTrue('found', results.length >= 1, f)
    assertTrue('includes_municipal01', results.some((s) => s.id === 'MUNICIPAL-01'), f)
  })

  run('Test-16', 'P1-3 Emergency scenarios have correct risk levels', (f, a) => {
    const emergencies = getScenariosByCategory('emergency')
    const high = emergencies.filter((s) => s.riskLevel === 'HIGH')
    a.highRisk = high.length
    assertTrue('has_high_risk', high.length >= 1, f)
    // EMERGENCY-03 (landlord dispute) should be HIGH
    const e03 = getScenarioById('EMERGENCY-03')
    assertEq('e03_risk', e03?.riskLevel, 'HIGH', f)
  })

  // ====================================================================
  // Group P1-2 — Evidence Registry Search (Tests 17..22)
  // ====================================================================

  const mockEvidence: EvidenceRecord[] = [
    {
      id: 'ev_001', type: 'government_website', topicTags: ['租金', 'rent'],
      location: '東京都', dateCollected: '2026-03-01', contentSummary: 'Rent guidelines',
      sourceUrl: 'https://example.go.jp', filePath: null,
      confidenceLevel: 'official', expiryDate: '2027-03-01',
      linkedCardIds: ['kc_001'], createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z', status: 'active',
    },
    {
      id: 'ev_002', type: 'on_site_photo', topicTags: ['rent', 'deposit'],
      location: '大阪府', dateCollected: '2026-02-15', contentSummary: 'Deposit receipt photo',
      sourceUrl: null, filePath: '/photos/receipt.jpg',
      confidenceLevel: 'verified', expiryDate: null,
      linkedCardIds: [], createdAt: '2026-02-15T00:00:00Z',
      updatedAt: '2026-02-15T00:00:00Z', status: 'active',
    },
    {
      id: 'ev_003', type: 'official_brochure', topicTags: ['visa', '在留資格'],
      location: null, dateCollected: '2025-12-01', contentSummary: 'Visa brochure',
      sourceUrl: null, filePath: '/docs/visa.pdf',
      confidenceLevel: 'unverified', expiryDate: '2026-01-01',
      linkedCardIds: [], createdAt: '2025-12-01T00:00:00Z',
      updatedAt: '2025-12-01T00:00:00Z', status: 'active',
    },
    {
      id: 'ev_004', type: 'other', topicTags: ['rent'],
      location: '東京都', dateCollected: '2026-01-01', contentSummary: 'Archived record',
      sourceUrl: null, filePath: null,
      confidenceLevel: 'official', expiryDate: null,
      linkedCardIds: [], createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z', status: 'archived',
    },
  ]

  run('Test-17', 'P1-2 searchEvidenceRecords filters by topicTag', (f, a) => {
    const results = searchEvidenceRecords(mockEvidence, { topicTags: ['rent'] })
    a.count = results.length
    // ev_001 (rent tag, active), ev_002 (rent tag, active) — ev_004 is archived
    assertEq('count', results.length, 2, f)
  })

  run('Test-18', 'P1-2 searchEvidenceRecords filters by location', (f, a) => {
    const results = searchEvidenceRecords(mockEvidence, { location: '東京' })
    a.count = results.length
    // ev_001 (東京都, active) — ev_004 is archived
    assertEq('count', results.length, 1, f)
    assertEq('id', results[0]?.id, 'ev_001', f)
  })

  run('Test-19', 'P1-2 searchEvidenceRecords filters by minConfidence', (f, a) => {
    const results = searchEvidenceRecords(mockEvidence, { minConfidence: 'verified' })
    a.count = results.length
    // ev_001 (official), ev_002 (verified) — ev_003 is unverified, ev_004 is archived
    assertEq('count', results.length, 2, f)
    // Should be sorted by confidence desc: official first
    assertEq('first_official', results[0]?.confidenceLevel, 'official', f)
  })

  run('Test-20', 'P1-2 searchEvidenceRecords excludeExpired works', (f, a) => {
    const asOf = new Date('2026-04-01')
    const results = searchEvidenceRecords(mockEvidence, {
      excludeExpired: true,
      asOf,
    })
    a.count = results.length
    // ev_003 expired (2026-01-01), ev_004 archived → 2 active non-expired
    assertEq('count', results.length, 2, f)
    assertTrue('no_ev003', !results.some((r) => r.id === 'ev_003'), f)
  })

  run('Test-21', 'P1-2 findExpiredRecords returns expired active records', (f, a) => {
    const asOf = new Date('2026-04-01')
    const expired = findExpiredRecords(mockEvidence, asOf)
    a.count = expired.length
    // Only ev_003 is active + expired
    assertEq('count', expired.length, 1, f)
    assertEq('id', expired[0]?.id, 'ev_003', f)
  })

  run('Test-22', 'P1-2 confidenceRank ordering: official > verified > unverified', (f, a) => {
    const off = confidenceRank('official')
    const ver = confidenceRank('verified')
    const unv = confidenceRank('unverified')
    a.official = off
    a.verified = ver
    a.unverified = unv
    assertTrue('official_gt_verified', off > ver, f)
    assertTrue('verified_gt_unverified', ver > unv, f)
  })

  // ====================================================================
  // Group P1-5 — Metrics Snapshot Integration (Tests 23..26)
  // ====================================================================

  run('Test-23', 'P1-5 buildMetricSnapshot healthy when all on target', (f, a) => {
    const hitRates: LayerHitRate[] = [
      { layer: 'L1_STATIC', hitCount: 60, totalQueries: 100, rate: 0.60, target: 0.55, status: 'on_target' },
      { layer: 'L3_AI', hitCount: 20, totalQueries: 100, rate: 0.20, target: 0.25, status: 'on_target' },
      { layer: 'L4_REALTIME', hitCount: 5, totalQueries: 100, rate: 0.05, target: 0.10, status: 'on_target' },
      { layer: 'L5_BRIDGE', hitCount: 10, totalQueries: 100, rate: 0.10, target: 0.15, status: 'on_target' },
      { layer: 'L6_ESCALATION', hitCount: 3, totalQueries: 100, rate: 0.03, target: 0.05, status: 'on_target' },
      { layer: 'L_UNKNOWN', hitCount: 2, totalQueries: 100, rate: 0.02, target: null, status: 'no_target' },
    ]
    const snapshot = buildMetricSnapshot(hitRates, '2026-04-12T00:00:00Z')
    a.status = snapshot.status
    a.alertCount = snapshot.alerts.length
    assertEq('healthy', snapshot.status, 'healthy', f)
    assertEq('no_alerts', snapshot.alerts.length, 0, f)
  })

  run('Test-24', 'P1-5 buildMetricSnapshot critical when L1 too low', (f, a) => {
    const hitRates: LayerHitRate[] = [
      { layer: 'L1_STATIC', hitCount: 30, totalQueries: 100, rate: 0.30, target: 0.55, status: 'below_target' },
      { layer: 'L3_AI', hitCount: 40, totalQueries: 100, rate: 0.40, target: 0.25, status: 'above_target' },
      { layer: 'L4_REALTIME', hitCount: 5, totalQueries: 100, rate: 0.05, target: 0.10, status: 'on_target' },
      { layer: 'L5_BRIDGE', hitCount: 15, totalQueries: 100, rate: 0.15, target: 0.15, status: 'on_target' },
      { layer: 'L6_ESCALATION', hitCount: 5, totalQueries: 100, rate: 0.05, target: 0.05, status: 'on_target' },
      { layer: 'L_UNKNOWN', hitCount: 5, totalQueries: 100, rate: 0.05, target: null, status: 'no_target' },
    ]
    const snapshot = buildMetricSnapshot(hitRates, '2026-04-12T00:00:00Z')
    a.status = snapshot.status
    a.alertCount = snapshot.alerts.length
    assertEq('critical', snapshot.status, 'critical', f)
    assertTrue('has_alerts', snapshot.alerts.length >= 1, f)
    // L1 below 40% → critical alert
    assertTrue('l1_alert', snapshot.alerts.some((al) => al.metric === 'L1_STATIC'), f)
  })

  run('Test-25', 'P1-5 buildMetricSnapshot warning when L3 too high', (f, a) => {
    const hitRates: LayerHitRate[] = [
      { layer: 'L1_STATIC', hitCount: 45, totalQueries: 100, rate: 0.45, target: 0.55, status: 'below_target' },
      { layer: 'L3_AI', hitCount: 38, totalQueries: 100, rate: 0.38, target: 0.25, status: 'above_target' },
      { layer: 'L4_REALTIME', hitCount: 5, totalQueries: 100, rate: 0.05, target: 0.10, status: 'on_target' },
      { layer: 'L5_BRIDGE', hitCount: 8, totalQueries: 100, rate: 0.08, target: 0.15, status: 'on_target' },
      { layer: 'L6_ESCALATION', hitCount: 2, totalQueries: 100, rate: 0.02, target: 0.05, status: 'on_target' },
      { layer: 'L_UNKNOWN', hitCount: 2, totalQueries: 100, rate: 0.02, target: null, status: 'no_target' },
    ]
    const snapshot = buildMetricSnapshot(hitRates, '2026-04-12T00:00:00Z')
    a.status = snapshot.status
    // L1 at 45% is above the 40% critical threshold → no L1 critical
    // L3 at 38% is above the 35% warning threshold → L3 warning fires
    assertTrue('l3_warning', snapshot.alerts.some((al) => al.metric === 'L3_AI' && al.severity === 'warning'), f)
  })

  run('Test-26', 'P1-5 buildMetricSnapshot includes rates map for all layers', (f, a) => {
    const hitRates: LayerHitRate[] = [
      { layer: 'L1_STATIC', hitCount: 55, totalQueries: 100, rate: 0.55, target: 0.55, status: 'on_target' },
      { layer: 'L3_AI', hitCount: 20, totalQueries: 100, rate: 0.20, target: 0.25, status: 'on_target' },
      { layer: 'L4_REALTIME', hitCount: 10, totalQueries: 100, rate: 0.10, target: 0.10, status: 'on_target' },
      { layer: 'L5_BRIDGE', hitCount: 10, totalQueries: 100, rate: 0.10, target: 0.15, status: 'on_target' },
      { layer: 'L6_ESCALATION', hitCount: 3, totalQueries: 100, rate: 0.03, target: 0.05, status: 'on_target' },
      { layer: 'L_UNKNOWN', hitCount: 2, totalQueries: 100, rate: 0.02, target: null, status: 'no_target' },
    ]
    const snapshot = buildMetricSnapshot(hitRates, '2026-04-12T00:00:00Z')
    a.rateKeys = Object.keys(snapshot.rates).length
    assertEq('6_layers', Object.keys(snapshot.rates).length, 6, f)
    assertEq('l1_rate', snapshot.rates['L1_STATIC'], 0.55, f)
    assertEq('total', snapshot.totalQueries, 100, f)
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

  console.log(`\n--- V6 P1 Results: ${results.length - failCount}/${results.length} passed ---`)
  if (failCount > 0) {
    console.log(`FAILED: ${failCount} test(s)`)
  }
  return failCount
}

main().then((code) => process.exit(code))
