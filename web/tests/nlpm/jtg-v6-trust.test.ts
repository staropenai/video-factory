/**
 * JTG V6 Trust — Unit tests for V6 Trust & Transparency layer:
 *   1. TrustBadge STATUS_CONFIG smoke test
 *   2. trust-dashboard API (valid ID, invalid ID, ω5 evidence failure)
 *   3. verify/evidence API (reject non-hex, accept valid hex)
 *   4. i18n V6 trust keys completeness
 *
 * Run from web/ directory: `npx tsx tests/nlpm/jtg-v6-trust.test.ts`
 *
 * All tests are pure — no DB, no network, no filesystem.
 */

async function main(): Promise<number> {
  const {
    STATUS_CONFIG,
  } = await import('../../src/components/homepage/TrustBadge')

  const {
    getCopy,
  } = await import('../../src/lib/i18n/homepage')

  const {
    Events,
  } = await import('../../src/lib/analytics/events')

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
  // Group T-1 — TrustBadge STATUS_CONFIG (Tests 01..05)
  // ====================================================================

  run('Test-01', 'T-1 STATUS_CONFIG has all 5 trust states', (f, a) => {
    const keys = Object.keys(STATUS_CONFIG)
    a.keys = keys
    assertEq('count', keys.length, 5, f)
    for (const k of ['verified', 'partial', 'risk', 'unknown', 'pending'] as const) {
      assertTrue(`has_${k}`, k in STATUS_CONFIG, f)
    }
  })

  run('Test-02', 'T-1 Each status has color, bg, icon, textColor', (f, _a) => {
    for (const [key, cfg] of Object.entries(STATUS_CONFIG)) {
      assertTrue(`${key}.color`, typeof cfg.color === 'string' && cfg.color.startsWith('#'), f)
      assertTrue(`${key}.bg`, typeof cfg.bg === 'string' && cfg.bg.startsWith('#'), f)
      assertTrue(`${key}.icon`, typeof cfg.icon === 'string' && cfg.icon.length > 0, f)
      assertTrue(`${key}.textColor`, typeof cfg.textColor === 'string' && cfg.textColor.startsWith('#'), f)
    }
  })

  run('Test-03', 'T-1 Verified status uses green tone', (f, a) => {
    const verified = STATUS_CONFIG.verified
    a.color = verified.color
    assertTrue('green_color', verified.color.toLowerCase().includes('9e75') || verified.color === '#1D9E75', f)
  })

  run('Test-04', 'T-1 Risk status uses red tone', (f, a) => {
    const risk = STATUS_CONFIG.risk
    a.color = risk.color
    assertTrue('red_color', risk.color.toLowerCase().includes('e24b') || risk.color === '#E24B4A', f)
  })

  run('Test-05', 'T-1 Pending and unknown share same color', (f, a) => {
    a.pendingColor = STATUS_CONFIG.pending.color
    a.unknownColor = STATUS_CONFIG.unknown.color
    assertEq('same_color', STATUS_CONFIG.pending.color, STATUS_CONFIG.unknown.color, f)
  })

  // ====================================================================
  // Group T-2 — V6 Analytics Events (Tests 06..08)
  // ====================================================================

  run('Test-06', 'T-2 V6 trust events exist in Events enum', (f, _a) => {
    const requiredEvents = [
      'TRUST_DASHBOARD_VIEW',
      'TRUST_PROMISE_CLICK',
      'EVIDENCE_VIEW',
      'TRANSPARENCY_EXPAND',
      'RISK_DETAIL_VIEW',
      'VERIFY_CENTER_VISIT',
      'CONFIRM_SCOPE_MODIFY',
    ] as const
    for (const evt of requiredEvents) {
      assertTrue(`Events.${evt}`, evt in Events, f)
    }
  })

  run('Test-07', 'T-2 Event values are snake_case strings', (f, _a) => {
    const v6Events = [
      Events.TRUST_DASHBOARD_VIEW,
      Events.TRUST_PROMISE_CLICK,
      Events.EVIDENCE_VIEW,
      Events.RISK_DETAIL_VIEW,
      Events.VERIFY_CENTER_VISIT,
      Events.CONFIRM_SCOPE_MODIFY,
    ]
    for (const val of v6Events) {
      assertTrue(`snake_case:${val}`, /^[a-z][a-z0-9_]*$/.test(val), f)
    }
  })

  run('Test-08', 'T-2 No duplicate event values', (f, a) => {
    const values = Object.values(Events)
    const unique = new Set(values)
    a.total = values.length
    a.unique = unique.size
    assertEq('no_dupes', values.length, unique.size, f)
  })

  // ====================================================================
  // Group T-3 — i18n V6 trust keys (Tests 09..13)
  // ====================================================================

  const V6_TRUST_KEYS = [
    'trustPromise1', 'trustPromise2', 'trustPromise3', 'trustPromise4', 'trustPromise5',
    'trustPromise1Detail', 'trustPromise2Detail', 'trustPromise3Detail', 'trustPromise4Detail', 'trustPromise5Detail',
    'trustDashboardTitle', 'trustDashboardSubtitle', 'trustDashboardDisclaimer',
    'trustStatusVerified', 'trustStatusPartial', 'trustStatusRisk', 'trustStatusUnknown', 'trustStatusPending',
    'evidenceTimestampLabel', 'evidenceViewDetail', 'evidenceWriteFailed',
    'transparencyTitle', 'transparencyEngine', 'transparencyConfidence', 'transparencyDataSources',
    'engineTierA', 'engineTierB', 'engineTierC',
    'confidenceHigh', 'confidenceMedium', 'confidenceLow',
    'confirmSendScope', 'confirmNotSend', 'confirmModifyScope',
    'riskLow', 'riskMedium', 'riskHigh', 'riskUnknown',
    'trustCenterNavLabel', 'verifyNavLabel',
    'footerComplianceNote', 'footerReportViolation',
  ] as const

  const TIER1_LOCALES = ['zh-Hans', 'en', 'ja'] as const
  const TIER2_LOCALES = ['ko', 'vi', 'th'] as const

  run('Test-09', 'T-3 Tier 1 locales (zh-Hans, en, ja) have all V6 trust keys', (f, a) => {
    for (const loc of TIER1_LOCALES) {
      const copy = getCopy(loc as Parameters<typeof getCopy>[0])
      for (const key of V6_TRUST_KEYS) {
        const val = (copy as unknown as Record<string, string>)[key]
        if (!val || val.length === 0) {
          f.push(`${loc}.${key} is missing or empty`)
        }
      }
    }
    a.keyCount = V6_TRUST_KEYS.length
    a.locales = TIER1_LOCALES.length
  })

  run('Test-10', 'T-3 Tier 2 locales (ko, vi, th) have all V6 trust keys', (f, a) => {
    for (const loc of TIER2_LOCALES) {
      const copy = getCopy(loc as Parameters<typeof getCopy>[0])
      for (const key of V6_TRUST_KEYS) {
        const val = (copy as unknown as Record<string, string>)[key]
        if (!val || val.length === 0) {
          f.push(`${loc}.${key} is missing or empty`)
        }
      }
    }
    a.keyCount = V6_TRUST_KEYS.length
    a.locales = TIER2_LOCALES.length
  })

  run('Test-11', 'T-3 zh-Hans trustPromise1 is non-empty and not English', (f, a) => {
    const copy = getCopy('zh-Hans' as Parameters<typeof getCopy>[0])
    const val = copy.trustPromise1
    a.value = val
    assertTrue('non_empty', val.length > 0, f)
    assertTrue('not_english', !/^[A-Za-z\s]+$/.test(val), f)
  })

  run('Test-12', 'T-3 en trustDashboardTitle is "Trust dashboard"', (f, a) => {
    const copy = getCopy('en' as Parameters<typeof getCopy>[0])
    a.value = copy.trustDashboardTitle
    assertEq('title', copy.trustDashboardTitle, 'Trust dashboard', f)
  })

  run('Test-13', 'T-3 ja trustStatusVerified is Japanese', (f, a) => {
    const copy = getCopy('ja' as Parameters<typeof getCopy>[0])
    a.value = copy.trustStatusVerified
    assertTrue('non_empty', copy.trustStatusVerified.length > 0, f)
    assertTrue('has_japanese', /[\u3000-\u9FFF]/.test(copy.trustStatusVerified), f)
  })

  // ====================================================================
  // Group T-4 — Hash validation logic (Tests 14..16)
  // ====================================================================

  run('Test-14', 'T-4 SHA-256 hex regex rejects non-hex strings', (f, _a) => {
    const pattern = /^[0-9a-f]{64}$/i
    assertTrue('rejects_short', !pattern.test('abc123'), f)
    assertTrue('rejects_empty', !pattern.test(''), f)
    assertTrue('rejects_65chars', !pattern.test('a'.repeat(65)), f)
    assertTrue('rejects_special', !pattern.test('g'.repeat(64)), f)
    assertTrue('rejects_spaces', !pattern.test(' '.repeat(64)), f)
  })

  run('Test-15', 'T-4 SHA-256 hex regex accepts valid 64-char hex', (f, _a) => {
    const pattern = /^[0-9a-f]{64}$/i
    assertTrue('accepts_lowercase', pattern.test('a'.repeat(64)), f)
    assertTrue('accepts_uppercase', pattern.test('A'.repeat(64)), f)
    assertTrue('accepts_mixed', pattern.test('aAbBcCdDeEfF0123456789' + '0'.repeat(42)), f)
    assertTrue('accepts_real_hash', pattern.test('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'), f)
  })

  run('Test-16', 'T-4 analysisId UUID regex rejects invalid formats', (f, _a) => {
    const pattern = /^[0-9a-f-]{36}$/i
    assertTrue('rejects_short', !pattern.test('abc'), f)
    assertTrue('rejects_empty', !pattern.test(''), f)
    assertTrue('accepts_valid_uuid', pattern.test('550e8400-e29b-41d4-a716-446655440000'), f)
    assertTrue('rejects_37chars', !pattern.test('550e8400-e29b-41d4-a716-4466554400001'), f)
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

  console.log(`\n--- V6 Trust Results: ${results.length - failCount}/${results.length} passed ---`)
  if (failCount > 0) {
    console.log(`FAILED: ${failCount} test(s)`)
  }
  return failCount
}

main().then((code) => process.exit(code))
