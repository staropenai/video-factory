/**
 * JTG P2 — Regression suite for the three v5 infrastructure modules:
 *   1. Evidence Registry (search + expiry)
 *   2. Layer hit-rate stats (classification + computation)
 *   3. Writeback hooks (auto-proposal threshold + event building)
 *
 * Run from web/ directory: `npx tsx tests/nlpm/jtg-p2.test.ts`
 *
 * Everything under test is pure (no DB, no network). We import the pure
 * functions directly and pass data arrays, so no JSONL files are touched.
 */

import type { EvidenceRecord } from '../../src/lib/db/tables'
import type { PathTraceInput, LayerLabel } from '../../src/lib/routing/layer-stats'

async function main(): Promise<number> {
  const {
    searchEvidenceRecords,
    findExpiredRecords,
    confidenceRank,
    CONFIDENCE_LEVELS,
  } = await import('../../src/lib/evidence/registry')
  const {
    classifyQueryLayer,
    computeLayerHitRates,
    LAYER_TARGETS,
    LAYER_LABELS,
  } = await import('../../src/lib/routing/layer-stats')
  const {
    shouldAutoPropose,
    buildProposalMetadata,
    buildLayerHitEvent,
  } = await import('../../src/lib/pipeline/writeback-hooks')
  // Also exercise the existing cluster signature to prove P2 builds on P0.
  const { clusterSignature } = await import('../../src/lib/sensing/cluster')

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
  // Test data — evidence records.
  // ====================================================================

  function makeEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
    return {
      id: 'ev_test_001',
      type: 'government_website',
      topicTags: ['地価', '公示価格'],
      location: '東京都新宿区',
      dateCollected: '2026-03-15',
      contentSummary: '国土交通省2026年地価公示結果',
      sourceUrl: 'https://example.go.jp/chika',
      filePath: null,
      confidenceLevel: 'official',
      expiryDate: '2027-01-01',
      linkedCardIds: ['card_001'],
      createdAt: '2026-03-15T00:00:00Z',
      updatedAt: '2026-03-15T00:00:00Z',
      status: 'active',
      ...overrides,
    }
  }

  const evidencePool: EvidenceRecord[] = [
    makeEvidence({
      id: 'ev_1',
      topicTags: ['地価', '公示価格'],
      location: '東京都新宿区',
      confidenceLevel: 'official',
      expiryDate: '2027-01-01',
      dateCollected: '2026-03-15',
    }),
    makeEvidence({
      id: 'ev_2',
      topicTags: ['初期費用', '敷金'],
      location: '東京都渋谷区',
      confidenceLevel: 'verified',
      expiryDate: '2026-06-01',
      dateCollected: '2026-02-10',
    }),
    makeEvidence({
      id: 'ev_3',
      topicTags: ['ゴミ分別', 'garbage sorting'],
      location: null,
      confidenceLevel: 'unverified',
      expiryDate: null,
      dateCollected: '2026-01-05',
    }),
    makeEvidence({
      id: 'ev_4',
      topicTags: ['地価', '路線価'],
      location: '大阪府大阪市',
      confidenceLevel: 'official',
      expiryDate: '2025-01-01', // already expired
      dateCollected: '2024-12-01',
    }),
    makeEvidence({
      id: 'ev_5',
      topicTags: ['visa', '在留資格'],
      location: '東京都新宿区',
      confidenceLevel: 'official',
      expiryDate: '2027-06-01',
      dateCollected: '2026-04-01',
      status: 'archived', // should be excluded from active searches
    }),
  ]

  // ====================================================================
  // Group P2-1 — Evidence Registry (Tests 01..08)
  // ====================================================================

  run('Test-01', '§P2-1 confidenceRank ordering: official > verified > unverified', (f, a) => {
    const off = confidenceRank('official')
    const ver = confidenceRank('verified')
    const unv = confidenceRank('unverified')
    a.official = off
    a.verified = ver
    a.unverified = unv
    assertEq('official > verified', off > ver, true, f)
    assertEq('verified > unverified', ver > unv, true, f)
  })

  run('Test-02', '§P2-1 CONFIDENCE_LEVELS is a complete ordered list', (f, a) => {
    a.length = CONFIDENCE_LEVELS.length
    assertEq('length', CONFIDENCE_LEVELS.length, 3, f)
    assertEq('first', CONFIDENCE_LEVELS[0], 'unverified', f)
    assertEq('last', CONFIDENCE_LEVELS[2], 'official', f)
  })

  run('Test-03', '§P2-1 searchEvidenceRecords finds by topicTag', (f, a) => {
    const hits = searchEvidenceRecords(evidencePool, { topicTags: ['地価'] })
    a.count = hits.length
    a.ids = hits.map((h) => h.id)
    // ev_1 (official, 東京), ev_4 (official, 大阪) — ev_5 is archived
    assertEq('count', hits.length, 2, f)
    assertEq('first is ev_1 or ev_4', hits.every((h) => ['ev_1', 'ev_4'].includes(h.id)), true, f)
  })

  run('Test-04', '§P2-1 searchEvidenceRecords filters by location', (f, a) => {
    const hits = searchEvidenceRecords(evidencePool, {
      topicTags: ['地価'],
      location: '新宿',
    })
    a.count = hits.length
    assertEq('count', hits.length, 1, f)
    if (hits.length > 0) assertEq('id', hits[0].id, 'ev_1', f)
  })

  run('Test-05', '§P2-1 searchEvidenceRecords respects minConfidence', (f, a) => {
    const hits = searchEvidenceRecords(evidencePool, { minConfidence: 'official' })
    a.count = hits.length
    // ev_1 (official), ev_4 (official) — ev_5 is archived
    assertEq('count', hits.length, 2, f)
    assertEq('all official', hits.every((h) => h.confidenceLevel === 'official'), true, f)
  })

  run('Test-06', '§P2-1 searchEvidenceRecords excludeExpired filters out past-expiry', (f, a) => {
    const asOf = new Date('2026-04-12T00:00:00Z')
    const hits = searchEvidenceRecords(evidencePool, {
      topicTags: ['地価'],
      excludeExpired: true,
      asOf,
    })
    a.count = hits.length
    // ev_4 expired 2025-01-01 < asOf, so excluded; ev_1 still valid
    assertEq('count', hits.length, 1, f)
    if (hits.length > 0) assertEq('id', hits[0].id, 'ev_1', f)
  })

  run('Test-07', '§P2-1 findExpiredRecords finds records past expiryDate', (f, a) => {
    const asOf = new Date('2026-04-12T00:00:00Z')
    const expired = findExpiredRecords(evidencePool, asOf)
    a.count = expired.length
    // ev_4 expired 2025-01-01, ev_2 expired 2026-06-01 NOT expired yet at 2026-04-12
    assertEq('count', expired.length, 1, f)
    if (expired.length > 0) assertEq('id', expired[0].id, 'ev_4', f)
  })

  run('Test-08', '§P2-1 findExpiredRecords excludes archived records', (f, a) => {
    // ev_5 is archived — even if its expiry was in the past, it shouldn't appear
    const pool = [
      makeEvidence({ id: 'ev_x', status: 'archived', expiryDate: '2020-01-01' }),
    ]
    const expired = findExpiredRecords(pool, new Date('2026-01-01'))
    a.count = expired.length
    assertEq('count', expired.length, 0, f)
  })

  // ====================================================================
  // Group P2-2 — Layer Stats (Tests 09..15)
  // ====================================================================

  run('Test-09', '§P2-2 classifyQueryLayer: STATIC + no LLM → L1_STATIC', (f, a) => {
    const trace: PathTraceInput = {
      layers: ['query_received', 'retrieve:hit(1)', 'tier_shortcut'],
      sourceClass: 'STATIC',
      llmCalled: false,
    }
    const label = classifyQueryLayer(trace)
    a.label = label
    assertEq('label', label, 'L1_STATIC', f)
  })

  run('Test-10', '§P2-2 classifyQueryLayer: AI_INFERRED → L3_AI', (f, a) => {
    const trace: PathTraceInput = {
      layers: ['query_received', 'understand:openai', 'render:openai'],
      sourceClass: 'AI_INFERRED',
      llmCalled: true,
    }
    const label = classifyQueryLayer(trace)
    a.label = label
    assertEq('label', label, 'L3_AI', f)
  })

  run('Test-11', '§P2-2 classifyQueryLayer: ESCALATION → L6_ESCALATION', (f, a) => {
    const trace: PathTraceInput = {
      layers: ['query_received', 'understand:openai', 'render:openai'],
      sourceClass: 'ESCALATION',
      llmCalled: true,
    }
    const label = classifyQueryLayer(trace)
    a.label = label
    assertEq('label', label, 'L6_ESCALATION', f)
  })

  run('Test-12', '§P2-2 classifyQueryLayer: STATIC + LLM called → L3_AI (LLM enriched)', (f, a) => {
    const trace: PathTraceInput = {
      layers: ['query_received', 'retrieve:hit(1)', 'render:openai'],
      sourceClass: 'STATIC',
      llmCalled: true,
    }
    const label = classifyQueryLayer(trace)
    a.label = label
    assertEq('label', label, 'L3_AI', f)
  })

  run('Test-13', '§P2-2 computeLayerHitRates returns correct counts and rates', (f, a) => {
    const labels: LayerLabel[] = [
      'L1_STATIC', 'L1_STATIC', 'L1_STATIC', 'L1_STATIC', 'L1_STATIC',  // 5
      'L3_AI', 'L3_AI', 'L3_AI',                                          // 3
      'L6_ESCALATION',                                                      // 1
      'L_UNKNOWN',                                                          // 1
    ]
    const rates = computeLayerHitRates(labels, 10)
    const l1 = rates.find((r) => r.layer === 'L1_STATIC')!
    const l3 = rates.find((r) => r.layer === 'L3_AI')!
    const l6 = rates.find((r) => r.layer === 'L6_ESCALATION')!
    a.l1_rate = l1.rate
    a.l3_rate = l3.rate
    a.l6_rate = l6.rate
    assertEq('l1 count', l1.hitCount, 5, f)
    assertEq('l1 rate', l1.rate, 0.5, f)
    assertEq('l3 count', l3.hitCount, 3, f)
    assertEq('l3 rate', l3.rate, 0.3, f)
    assertEq('l6 count', l6.hitCount, 1, f)
  })

  run('Test-14', '§P2-2 computeLayerHitRates L1 at 55% is on_target', (f, a) => {
    const labels: LayerLabel[] = Array(55).fill('L1_STATIC')
    // Fill the rest with AI
    for (let i = 0; i < 45; i++) labels.push('L3_AI')
    const rates = computeLayerHitRates(labels, 100)
    const l1 = rates.find((r) => r.layer === 'L1_STATIC')!
    a.status = l1.status
    a.rate = l1.rate
    assertEq('status', l1.status, 'on_target', f)
  })

  run('Test-15', '§P2-2 computeLayerHitRates L6 at 10% is above_target (max 5%)', (f, a) => {
    const labels: LayerLabel[] = Array(10).fill('L6_ESCALATION')
    for (let i = 0; i < 90; i++) labels.push('L1_STATIC')
    const rates = computeLayerHitRates(labels, 100)
    const l6 = rates.find((r) => r.layer === 'L6_ESCALATION')!
    a.status = l6.status
    a.rate = l6.rate
    assertEq('status', l6.status, 'above_target', f)
  })

  run('Test-16', '§P2-2 LAYER_TARGETS has entries for all non-UNKNOWN layers', (f, a) => {
    const keys = Object.keys(LAYER_TARGETS)
    a.count = keys.length
    assertEq('count', keys.length, 5, f)
    assertEq('has L1', 'L1_STATIC' in LAYER_TARGETS, true, f)
    assertEq('has L6', 'L6_ESCALATION' in LAYER_TARGETS, true, f)
  })

  // ====================================================================
  // Group P2-3 — Writeback Hooks (Tests 17..22)
  // ====================================================================

  run('Test-17', '§P2-3 shouldAutoPropose returns false below threshold', (f, a) => {
    const result = shouldAutoPropose(4)
    a.result = result
    assertEq('result', result, false, f)
  })

  run('Test-18', '§P2-3 shouldAutoPropose returns true at threshold (default 5)', (f, a) => {
    const result = shouldAutoPropose(5)
    a.result = result
    assertEq('result', result, true, f)
  })

  run('Test-19', '§P2-3 shouldAutoPropose respects custom minCount', (f, a) => {
    const below = shouldAutoPropose(9, { minCount: 10 })
    const at = shouldAutoPropose(10, { minCount: 10 })
    a.below = below
    a.at = at
    assertEq('below', below, false, f)
    assertEq('at', at, true, f)
  })

  run('Test-20', '§P2-3 buildProposalMetadata shapes correct output', (f, a) => {
    const meta = buildProposalMetadata({
      signature: 'rent deposit return',
      clusterSize: 7,
      sampleQuery: 'How do I get my deposit back when moving out?',
      dominantLanguage: 'en',
    })
    a.source = meta.source
    a.windowDays = meta.windowDays
    a.clusterSize = meta.clusterSize
    assertEq('source', meta.source, 'auto_writeback', f)
    assertEq('windowDays', meta.windowDays, 7, f)
    assertEq('clusterSize', meta.clusterSize, 7, f)
    assertEq('signature', meta.signature, 'rent deposit return', f)
  })

  run('Test-21', '§P2-3 buildLayerHitEvent classifies and shapes event', (f, a) => {
    const trace: PathTraceInput = {
      layers: ['query_received', 'tier_shortcut'],
      sourceClass: 'STATIC',
      llmCalled: false,
    }
    const event = buildLayerHitEvent(trace, { queryId: 'q_123' })
    a.layer = event.layer
    a.action = event.action
    a.queryId = event.queryId
    assertEq('layer', event.layer, 'L1_STATIC', f)
    assertEq('action', event.action, 'layer_hit', f)
    assertEq('queryId', event.queryId, 'q_123', f)
  })

  run('Test-22', '§P2-3 buildLayerHitEvent ESCALATION → action=escalation', (f, a) => {
    const trace: PathTraceInput = {
      layers: ['query_received', 'understand:openai'],
      sourceClass: 'ESCALATION',
      llmCalled: true,
    }
    const event = buildLayerHitEvent(trace)
    a.layer = event.layer
    a.action = event.action
    assertEq('layer', event.layer, 'L6_ESCALATION', f)
    assertEq('action', event.action, 'escalation', f)
  })

  // ====================================================================
  // Group P2-4 — Cluster key (existing P0 module, sanity check) (Test 23)
  // ====================================================================

  run('Test-23', '§P2-4 clusterSignature produces consistent key for English', (f, a) => {
    const sig1 = clusterSignature('How do I sort garbage in Japan?')
    const sig2 = clusterSignature('how do I sort garbage in japan')
    a.sig1 = sig1
    a.sig2 = sig2
    assertEq('consistent', sig1, sig2, f)
    assertEq('non-empty', sig1.length > 0, true, f)
  })

  run('Test-24', '§P2-4 clusterSignature handles CJK (trigram fallback)', (f, a) => {
    const sig = clusterSignature('家賃の敷金はいつ返してもらえますか')
    a.sig = sig
    assertEq('non-empty', sig.length > 0, true, f)
    // CJK with no spaces should produce pipe-delimited trigrams.
    assertEq('has pipes', sig.includes('|'), true, f)
  })

  // ---- Runner ---------------------------------------------------------
  let passed = 0
  let failed = 0
  for (const r of results) {
    const tag = r.failures.length === 0 ? 'PASS' : 'FAIL'
    console.log(`  [${tag}] ${r.id} — ${r.description}`)
    console.log(`         assertions: ${JSON.stringify(r.assertions)}`)
    if (r.failures.length === 0) {
      passed++
    } else {
      for (const msg of r.failures) console.error(`         ${msg}`)
      failed++
    }
  }
  console.log(`\nJTG P2 regression: ${passed} passed, ${failed} failed`)
  return failed > 0 ? 1 : 0
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err)
    process.exit(1)
  },
)
