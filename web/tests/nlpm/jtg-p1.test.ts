/**
 * JTG P1 — Regression suite for the four P1 domains:
 *   1. KnowledgeCard render / staleness
 *   2. Language bridge input + output validation
 *   3. Writeback (ReviewDecision) validation
 *   4. Provider envelope validation + UI mapping
 *
 * Run from web/ directory: `npx tsx tests/nlpm/jtg-p1.test.ts`
 *
 * Everything under test is pure (no DB, no network), so no sandboxing is
 * needed — just import and assert. We still wrap in async main() because
 * the tsconfig target (ES2017) rejects top-level await.
 */

import type { KnowledgeCard } from '../../src/lib/domain/knowledge-card'
import type {
  BridgeOutput,
  JapaneseTemplate,
} from '../../src/lib/domain/language-bridge'
import type {
  PropertyListing,
  ProviderEnvelope,
} from '../../src/lib/domain/providers'

async function main(): Promise<number> {
  const {
    renderCard,
    isCardStale,
  } = await import('../../src/lib/domain/knowledge-card')
  const {
    validateBridgeInput,
    validateBridgeOutput,
    classifyRisk,
    buildEscalationSuggestion,
    ASSISTANCE_DISCLAIMER,
    BRIDGE_ERROR_CODES,
  } = await import('../../src/lib/domain/language-bridge')
  const {
    validateReviewDecision,
    WRITEBACK_ERROR_CODES,
  } = await import('../../src/lib/domain/writeback')
  const {
    validateProviderEnvelope,
    mapPropertyToAnswerBlock,
    PROVIDER_REGISTRY,
    PROVIDER_ERROR_CODES,
  } = await import('../../src/lib/domain/providers')

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
    body: (
      failures: string[],
      assertions: Record<string, unknown>,
    ) => void,
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
  // Group P1-1 — KnowledgeCard render + staleness (Tests 01..06)
  // ====================================================================

  const tierACard: KnowledgeCard = {
    id: 'card_a_hanko',
    tier: 'A',
    updatedAt: new Date().toISOString(),
    body: {
      title: 'What is a hanko',
      summary: 'A hanko is a personal seal used instead of a signature in Japan.',
    },
    evidence: [
      {
        id: 'ev1',
        source_type: 'STATIC',
        capturedAt: '2025-01-01T00:00:00Z',
        notes: 'Ministry of Justice guide',
      },
    ],
  }

  const tierBCard: KnowledgeCard = {
    id: 'card_b_garbage',
    tier: 'B',
    updatedAt: new Date().toISOString(),
    body: {
      title: 'How to sort garbage in Japan',
      summary: 'Japanese garbage sorting varies by ward; follow the colour guide.',
      steps: [
        'Separate burnable from non-burnable',
        'Rinse plastic containers',
        'Check your ward calendar for pickup days',
      ],
    },
    evidence: [
      {
        id: 'ev2',
        source_type: 'STATIC',
        capturedAt: '2025-01-01T00:00:00Z',
      },
    ],
  }

  const tierCCard: KnowledgeCard = {
    id: 'card_c_rights',
    tier: 'C',
    updatedAt: new Date().toISOString(),
    body: {
      title: 'Tenant rights when rent is raised',
      summary: 'Japanese tenancy law protects against arbitrary rent increases.',
    },
    evidence: [
      {
        id: 'ev3',
        source_type: 'STATIC',
        capturedAt: '2025-01-01T00:00:00Z',
      },
    ],
  }

  run('Test-01', '§P1-1 Tier A renders with canShortcut=true and STATIC source tag', (f, a) => {
    const block = renderCard(tierACard)
    a.kind = block.kind
    a.canShortcut = block.canShortcut
    a.sourceTag = block.sourceTag
    assertEq('kind', block.kind, 'TIER_A', f)
    assertEq('canShortcut', block.canShortcut, true, f)
    assertEq('sourceTag', block.sourceTag, 'STATIC', f)
  })

  run('Test-02', '§P1-1 Tier A block has no steps or llmEnrichment fields', (f, a) => {
    const block = renderCard(tierACard) as Record<string, unknown>
    a.has_steps = 'steps' in block
    a.has_llm_enrichment = 'llmEnrichment' in block
    assertEq('has_steps', 'steps' in block, false, f)
    assertEq('has_llm_enrichment', 'llmEnrichment' in block, false, f)
  })

  run('Test-03', '§P1-1 Tier B renders structured steps array', (f, a) => {
    const block = renderCard(tierBCard)
    if (block.kind !== 'TIER_B') {
      f.push(`expected TIER_B, got ${block.kind}`)
      return
    }
    a.kind = block.kind
    a.step_count = block.steps.length
    a.first_step = block.steps[0]
    assertEq('step_count', block.steps.length, 3, f)
    assertEq('can_shortcut', block.canShortcut, true, f)
  })

  run('Test-04', '§P1-1 Tier B card missing steps throws at render time', (f, a) => {
    const bad: KnowledgeCard = {
      ...tierBCard,
      body: { title: tierBCard.body.title, summary: tierBCard.body.summary },
    }
    let threw = false
    let message = ''
    try {
      renderCard(bad)
    } catch (e) {
      threw = true
      message = e instanceof Error ? e.message : String(e)
    }
    a.threw = threw
    a.message_contains_steps = message.includes('steps')
    assertEq('threw', threw, true, f)
    assertEq('message mentions steps', message.includes('steps'), true, f)
  })

  run('Test-05', '§P1-1 isCardStale returns false for a fresh card', (f, a) => {
    const fresh: KnowledgeCard = {
      ...tierACard,
      updatedAt: new Date().toISOString(),
    }
    const stale = isCardStale(fresh, new Date())
    a.stale = stale
    assertEq('stale', stale, false, f)
  })

  run('Test-06', '§P1-1 isCardStale returns true for a card older than maxAgeDays', (f, a) => {
    const old: KnowledgeCard = {
      ...tierACard,
      updatedAt: '2020-01-01T00:00:00Z',
    }
    const stale = isCardStale(old, new Date('2025-01-01T00:00:00Z'), 180)
    a.stale = stale
    assertEq('stale', stale, true, f)
  })

  // ====================================================================
  // Group P1-2 — Language bridge (Tests 07..12)
  // ====================================================================

  function goodTemplate(): JapaneseTemplate {
    return {
      sourceType: 'AI_INFERRED',
      politenessTier: 'polite',
      riskLabel: 'LOW',
      body: 'お世話になっております。ご確認のほどよろしくお願いいたします。',
    }
  }

  function goodOutput(overrides: Partial<BridgeOutput> = {}): BridgeOutput {
    return {
      riskLevel: 'LOW',
      plainExplanation:
        'The user is asking about how to register their new address.',
      japaneseTemplate: goodTemplate(),
      keyTerms: [],
      nextAction: 'Visit the city office with your zairyu card.',
      assistanceDisclaimer: ASSISTANCE_DISCLAIMER,
      bridgeVersion: '1',
      ...overrides,
    }
  }

  run('Test-07', '§P1-2 validateBridgeOutput passes on a well-formed LOW output', (f, a) => {
    const r = validateBridgeOutput(goodOutput())
    a.ok = r.ok
    assertEq('ok', r.ok, true, f)
  })

  run('Test-08', '§P1-2 validateBridgeInput rejects voice inputType', (f, a) => {
    const r = validateBridgeInput({
      inputType: 'voice',
      rawText: 'hello',
      userLocale: 'en',
    })
    a.ok = r.ok
    if (!r.ok) a.code = r.code
    assertEq('ok', r.ok, false, f)
    if (!r.ok) {
      assertEq(
        'code',
        r.code,
        BRIDGE_ERROR_CODES.UNSUPPORTED_INPUT_TYPE,
        f,
      )
    }
  })

  run('Test-09', '§P1-2 HIGH risk without escalation fails validation', (f, a) => {
    const r = validateBridgeOutput(
      goodOutput({ riskLevel: 'HIGH' }),
    )
    a.ok = r.ok
    if (!r.ok) a.code = r.code
    assertEq('ok', r.ok, false, f)
    if (!r.ok) {
      assertEq(
        'code',
        r.code,
        BRIDGE_ERROR_CODES.HIGH_RISK_NO_ESCALATION,
        f,
      )
    }
  })

  run('Test-10', '§P1-2 HIGH risk WITH escalation passes validation', (f, a) => {
    const esc = buildEscalationSuggestion('HIGH', 'en')
    const r = validateBridgeOutput(
      goodOutput({ riskLevel: 'HIGH', escalationSuggestion: esc }),
    )
    a.ok = r.ok
    assertEq('ok', r.ok, true, f)
  })

  run('Test-11', '§P1-2 classifyRisk returns HIGH for 訴訟', (f, a) => {
    const risk = classifyRisk('私は訴訟を起こされています')
    a.risk = risk
    assertEq('risk', risk, 'HIGH', f)
  })

  run('Test-12', '§P1-2 japaneseTemplate.sourceType !== AI_INFERRED fails', (f, a) => {
    const bad = goodOutput({
      japaneseTemplate: {
        ...goodTemplate(),
        // Force an invalid source type at runtime to exercise the validator.
        sourceType: 'STATIC' as unknown as 'AI_INFERRED',
      },
    })
    const r = validateBridgeOutput(bad)
    a.ok = r.ok
    if (!r.ok) a.code = r.code
    assertEq('ok', r.ok, false, f)
    if (!r.ok) {
      assertEq(
        'code',
        r.code,
        BRIDGE_ERROR_CODES.TEMPLATE_SOURCE_WRONG,
        f,
      )
    }
  })

  // ====================================================================
  // Group P1-3 — Writeback (Tests 13..14)
  // ====================================================================

  run('Test-13', '§P1-3 valid REVIEWED decision passes', (f, a) => {
    const r = validateReviewDecision({
      decidedBy: 'staff:alice',
      toState: 'REVIEWED',
      promoteReason: 'clear cluster, good answer',
    })
    a.ok = r.ok
    assertEq('ok', r.ok, true, f)
  })

  run('Test-14', '§P1-3 REJECTED without rejectionReason fails', (f, a) => {
    const r = validateReviewDecision({
      decidedBy: 'staff:alice',
      toState: 'REJECTED',
    })
    a.ok = r.ok
    if (!r.ok) a.code = r.code
    assertEq('ok', r.ok, false, f)
    if (!r.ok) {
      assertEq(
        'code',
        r.code,
        WRITEBACK_ERROR_CODES.MISSING_REJECTION_REASON,
        f,
      )
    }
  })

  // ====================================================================
  // Group P1-4 — Providers (Tests 15..18)
  // ====================================================================

  const propertyListing: PropertyListing = {
    listingId: 'lst_1',
    title: '2LDK Shibuya walking distance',
    monthlyRent: 185000,
    currency: 'JPY',
    addressHint: 'Shibuya-ku, Tokyo',
    url: 'https://example.com/listing/1',
  }

  const goodEnvelope: ProviderEnvelope<PropertyListing[]> = {
    sourceType: 'REALTIME',
    sourceName: 'HomeS-Mock',
    fetchedAt: new Date().toISOString(),
    freshnessWarning: false,
    payload: [propertyListing],
  }

  run('Test-15', '§P1-4 valid REALTIME envelope passes validation', (f, a) => {
    const r = validateProviderEnvelope(goodEnvelope)
    a.ok = r.ok
    a.registry_property_len = PROVIDER_REGISTRY.property.length
    a.registry_official_len = PROVIDER_REGISTRY.official.length
    assertEq('ok', r.ok, true, f)
    assertEq('registry property empty', PROVIDER_REGISTRY.property.length, 0, f)
    assertEq('registry official empty', PROVIDER_REGISTRY.official.length, 0, f)
  })

  run('Test-16', '§P1-4 missing fetchedAt fails with MISSING_TIMESTAMP', (f, a) => {
    const { fetchedAt: _discard, ...rest } = goodEnvelope
    void _discard
    const r = validateProviderEnvelope(rest as Partial<typeof goodEnvelope>)
    a.ok = r.ok
    if (!r.ok) a.code = r.code
    assertEq('ok', r.ok, false, f)
    if (!r.ok) {
      assertEq('code', r.code, PROVIDER_ERROR_CODES.MISSING_TIMESTAMP, f)
    }
  })

  run('Test-17', '§P1-4 wrong sourceType fails with WRONG_SOURCE_TYPE', (f, a) => {
    const r = validateProviderEnvelope({
      ...goodEnvelope,
      sourceType: 'STATIC' as unknown as 'REALTIME',
    })
    a.ok = r.ok
    if (!r.ok) a.code = r.code
    assertEq('ok', r.ok, false, f)
    if (!r.ok) {
      assertEq('code', r.code, PROVIDER_ERROR_CODES.WRONG_SOURCE_TYPE, f)
    }
  })

  run('Test-18', '§P1-4 mapPropertyToAnswerBlock produces the correct UI shape', (f, a) => {
    const block = mapPropertyToAnswerBlock(goodEnvelope, propertyListing)
    a.kind = block.kind
    a.source_type = block.sourceType
    a.source_name = block.sourceName
    a.rent_label = block.monthlyRentLabel
    assertEq('kind', block.kind, 'PROPERTY_LISTING', f)
    assertEq('sourceType', block.sourceType, 'REALTIME', f)
    assertEq('sourceName', block.sourceName, 'HomeS-Mock', f)
    assertEq('rentLabel starts with ¥', block.monthlyRentLabel.startsWith('¥'), true, f)
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
  console.log(`\nJTG P1 regression: ${passed} passed, ${failed} failed`)
  return failed > 0 ? 1 : 0
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err)
    process.exit(1)
  },
)
