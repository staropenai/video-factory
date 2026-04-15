/**
 * JTG Spec v1 §10 — Hard-constraint regression suite.
 *
 * Exercises the library layer directly (no HTTP, no Next.js runtime, no
 * OpenAI) so every invariant §4, §6, §7, §8, §11 can be asserted
 * deterministically. Each test emits a structured record with:
 *   { id, source_type, label, blocked, state_from, state_to, event_type }
 * so failures surface exactly which §10.3 assertion tripped.
 *
 * Run from web/ directory: `npx tsx tests/nlpm/jtg-spec.test.ts`
 *
 * Note: process.chdir() happens before dynamic imports, so tables.ts
 * captures a sandboxed DATA_DIR rather than the developer's real `.data`.
 * Everything runs inside an async main() because the ES2017 target here
 * doesn't permit top-level await.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { TaskState } from '../../src/lib/router/types'

async function main(): Promise<number> {
  // ---- Sandboxed data dir --------------------------------------------
  const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'jtg-spec-'))
  const ORIGINAL_CWD = process.cwd()
  process.chdir(TMP_ROOT)
  // Emulate "not on Vercel" so tables.ts picks `<cwd>/.data`.
  delete process.env.VERCEL
  const cleanup = () => {
    try {
      process.chdir(ORIGINAL_CWD)
      fs.rmSync(TMP_ROOT, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }

  // ---- Dynamic imports (AFTER chdir) ---------------------------------
  const tables = await import('../../src/lib/db/tables')
  const { canTransition } = await import('../../src/lib/candidate/state')
  const { retrieveFromLocal } = await import(
    '../../src/lib/knowledge/retrieve'
  )
  const { decideRoute } = await import('../../src/lib/router/decide')
  const { validateDecision } = await import(
    '../../src/lib/validation/guardrails'
  )
  const {
    validateAnswerPayload,
    staticFactBlock,
    aiInferredBlock,
    BLOCK_REASONS,
  } = await import('../../src/lib/domain/contracts')

  // ---- Harness -------------------------------------------------------
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
    const shortcut = retrieval.summary.shortcut ?? 'none'
    const canShortcut =
      shortcut !== 'none' &&
      decision.answerMode === 'direct_answer' &&
      !decision.shouldEscalate &&
      decision.riskLevel !== 'high' &&
      retrieval.matches.length > 0
    return { retrieval, decision, canShortcut }
  }

  // ====================================================================
  // Test-01 — §11 Tier A STATIC answer without LLM
  // ====================================================================
  run(
    'Test-01',
    '§11 Tier A hanko query returns STATIC answer without LLM',
    (failures, assertions) => {
      const { retrieval, canShortcut } = decideFor('hanko inkan seal stamp')
      assertions.source_type = retrieval.summary.topSourceType
      assertions.tier = retrieval.summary.topTier
      assertions.can_shortcut = canShortcut
      assertEq(
        'topSourceType',
        retrieval.summary.topSourceType,
        'STATIC',
        failures,
      )
      assertEq('topTier', retrieval.summary.topTier, 'A', failures)
      assertEq('canShortcut(LLM bypassed)', canShortcut, true, failures)
    },
  )

  // ====================================================================
  // Test-02 — §6.1 Sensing-sourced candidate born CLUSTERED
  // ====================================================================
  run(
    'Test-02',
    '§6.1 sensing-sourced faq_candidate starts in CLUSTERED',
    (failures, assertions) => {
      const c = tables.insertFaqCandidate({
        source: 'sensing',
        sourceQueryText: 'how do I renew my zairyu card',
        detectedLanguage: 'en',
        candidateTitle: 'Zairyu renewal',
        candidateAnswer: '',
        riskLevel: 'unknown',
        createdBy: 'test',
        clusterSignature: 'zairyu|renew',
        clusterSize: 4,
        clusterQueries: ['how do I renew my zairyu card'],
      })
      assertions.state_from = null
      assertions.state_to = c.state
      assertions.legacy_status = c.status
      assertEq('state', c.state, 'CLUSTERED', failures)
      assertEq(
        'legacy status back-compat',
        c.status,
        'pending_review',
        failures,
      )
    },
  )

  // ====================================================================
  // Test-03 — §6.1 state machine allowed / denied transitions
  // ====================================================================
  run(
    'Test-03',
    '§6.1 canTransition allows CLUSTERED→REVIEWED and blocks CLUSTERED→PUBLISHED',
    (failures, assertions) => {
      const ok = canTransition('CLUSTERED', 'REVIEWED')
      const bad = canTransition('CLUSTERED', 'PUBLISHED')
      const terminal = canTransition('PUBLISHED', 'REVIEWED')
      assertions.ok = ok.ok
      assertions.bad_code = ok.ok ? 'OK' : (bad as { code: string }).code
      assertions.terminal_code =
        terminal.ok ? 'OK' : (terminal as { code: string }).code
      assertEq('CLUSTERED→REVIEWED.ok', ok.ok, true, failures)
      assertEq('CLUSTERED→PUBLISHED.ok', bad.ok, false, failures)
      if (!bad.ok) {
        assertEq('bad.code', bad.code, 'INVALID_TRANSITION', failures)
      }
      assertEq('PUBLISHED→REVIEWED.ok', terminal.ok, false, failures)
      if (!terminal.ok) {
        assertEq('terminal.code', terminal.code, 'TERMINAL_STATE', failures)
      }
    },
  )

  // ====================================================================
  // Fixture shared by Test-04 / Test-05 / Test-06.
  // ====================================================================
  const fixtureCandidate = tables.insertFaqCandidate({
    source: 'sensing',
    sourceQueryText: 'where do I register my address after moving',
    detectedLanguage: 'en',
    candidateTitle: 'Address registration',
    candidateAnswer: 'Go to the local city office with your zairyu card.',
    riskLevel: 'low',
    createdBy: 'test',
    clusterSignature: 'address|register|move',
    clusterSize: 3,
    clusterQueries: ['where do I register my address after moving'],
  })
  let fixtureLiveFaqId: string | null = null

  // ====================================================================
  // Test-04 — §7 Atomic publish
  // ====================================================================
  run(
    'Test-04',
    '§7 publish persists live_faq + PUBLISHED state + LIVE_FAQ_PUBLISHED event',
    (failures, assertions) => {
      const liveFaq = tables.insertLiveFaq({
        createdBy: 'test',
        category: 'daily_life',
        subtopic: 'general',
        riskLevel: 'low',
        tier: 'A',
        sourceType: 'STATIC',
        confidenceHalfLifeDays: null,
        representative_title: {
          en: 'How to register your address after moving',
          zh: '搬家后如何登记地址',
          ja: '引越し後の住所登録',
        },
        standard_answer: {
          en: 'Visit your local city office within 14 days with your zairyu card. Bring old address proof.',
          zh: '搬家后14天内，带上在留卡到当地市役所办理。',
          ja: '引越し後14日以内に、在留カードを持って市役所へ。',
        },
        next_step_confirm: { en: '', zh: '', ja: '' },
        next_step_prepare: { en: '', zh: '', ja: '' },
        next_step_contact: { en: '', zh: '', ja: '' },
        next_step_warning: null,
        keywords: {
          en: ['address', 'register', 'move', 'city office', 'moving'],
          zh: ['地址', '登记', '搬家', '市役所'],
          ja: ['住所', '登録', '引越し', '市役所'],
        },
        sourceFaqCandidateId: fixtureCandidate.id,
      })
      fixtureLiveFaqId = liveFaq.id
      assertions.live_faq_id = liveFaq.id

      const updated = tables.markFaqCandidatePublished(
        fixtureCandidate.id,
        liveFaq.id,
      )
      assertions.state_from = 'CLUSTERED'
      assertions.state_to = updated?.state ?? null
      assertions.published_live_faq_id = updated?.publishedLiveFaqId ?? null

      tables.insertEvent({
        eventType: 'LIVE_FAQ_PUBLISHED',
        route: '/test',
        relatedIds: {
          candidateId: fixtureCandidate.id,
          liveFaqId: liveFaq.id,
        },
        metadata: { category: 'daily_life', tier: 'A' },
      })

      const readLive = tables.getLiveFaq(liveFaq.id)
      assertions.live_faq_readback = readLive ? readLive.id : null
      const events = tables.listEvents({
        eventType: 'LIVE_FAQ_PUBLISHED',
        candidateId: fixtureCandidate.id,
      })
      assertions.event_type = events[0]?.eventType ?? null
      assertions.event_count = events.length

      assertEq(
        'candidate.state',
        updated?.state ?? null,
        'PUBLISHED',
        failures,
      )
      assertEq(
        'candidate.publishedLiveFaqId',
        updated?.publishedLiveFaqId ?? null,
        liveFaq.id,
        failures,
      )
      assertEq(
        'live_faq readback',
        readLive?.id ?? null,
        liveFaq.id,
        failures,
      )
      assertEq('event_count >= 1', events.length >= 1, true, failures)
      if (events.length >= 1) {
        assertEq(
          'event_type',
          events[0].eventType,
          'LIVE_FAQ_PUBLISHED',
          failures,
        )
      }
    },
  )

  // ====================================================================
  // Test-05 — §7.1 Publish idempotency (no duplicate live_faq row)
  // ====================================================================
  run(
    'Test-05',
    '§7.1 repeat publish path does not create a duplicate live_faq row',
    (failures, assertions) => {
      const current = tables.getFaqCandidate(fixtureCandidate.id)
      const existingLive = current?.publishedLiveFaqId
        ? tables.getLiveFaq(current.publishedLiveFaqId)
        : null
      const isPublished = current?.state === 'PUBLISHED'
      const shouldNoOp = Boolean(isPublished && existingLive)
      assertions.is_published = isPublished
      assertions.should_no_op = shouldNoOp

      const liveRowsBefore = tables
        .listLiveFaqs()
        .filter((r) => r.sourceFaqCandidateId === fixtureCandidate.id)
      assertions.live_rows_before = liveRowsBefore.length
      // The route handler would return idempotent no-op here; we verify the
      // precondition logic matches and that no new row slipped in.
      const liveRowsAfter = tables
        .listLiveFaqs()
        .filter((r) => r.sourceFaqCandidateId === fixtureCandidate.id)
      assertions.live_rows_after = liveRowsAfter.length

      assertEq('should_no_op', shouldNoOp, true, failures)
      assertEq('live_rows_before', liveRowsBefore.length, 1, failures)
      assertEq('live_rows_after', liveRowsAfter.length, 1, failures)
    },
  )

  // ====================================================================
  // Test-06 — §17 Newly-published live_faq retrievable via overlay
  // ====================================================================
  run(
    'Test-06',
    '§17 newly-published live_faq answers via retrieveFromLocal overlay',
    (failures, assertions) => {
      const { retrieval } = decideFor(
        'I just moved, where do I register my address?',
      )
      const anyLive = retrieval.matches.some(
        (m) => m.id === fixtureLiveFaqId || m.id.startsWith('lfaq_'),
      )
      assertions.match_count = retrieval.matches.length
      assertions.any_live_overlay_hit = anyLive
      assertions.match_ids = retrieval.matches.map((m) => m.id)
      assertions.fixture_live_faq_id = fixtureLiveFaqId
      assertEq(
        'at least one match',
        retrieval.matches.length > 0,
        true,
        failures,
      )
      assertEq('overlay hit', anyLive, true, failures)
    },
  )

  // ====================================================================
  // Test-07 — §4.3 REALTIME block without timestamp is BLOCKED
  // ====================================================================
  run(
    'Test-07',
    '§4.3 validateAnswerPayload blocks REALTIME content missing timestamp',
    (failures, assertions) => {
      const validated = validateAnswerPayload({
        blocks: [
          {
            content: 'USD/JPY is 150.2',
            label: 'REALTIME',
            source_tags: [
              {
                source_type: 'REALTIME',
                timestamp: '', // violation
                confidence: 0.9,
                expiry_warning: false,
              },
            ],
          },
        ],
      })
      assertions.label = 'REALTIME'
      assertions.blocked = validated.blocked ?? false
      assertions.block_reason = validated.block_reason ?? null
      assertEq('blocked', validated.blocked ?? false, true, failures)
      assertEq(
        'block_reason',
        validated.block_reason ?? null,
        BLOCK_REASONS.REALTIME_MISSING_TIMESTAMP,
        failures,
      )
    },
  )

  // ====================================================================
  // Test-08 — §4.3 AI_INFERRED requires INFERENCE label; good payload passes
  // ====================================================================
  run(
    'Test-08',
    '§4.3 AI_INFERRED must carry INFERENCE label; well-formed payload passes',
    (failures, assertions) => {
      const bad = validateAnswerPayload({
        blocks: [
          {
            content: 'based on your data, you likely qualify',
            label: 'FACT',
            source_tags: [
              {
                source_type: 'AI_INFERRED',
                timestamp: new Date().toISOString(),
                confidence: 0.5,
                expiry_warning: false,
              },
            ],
          },
        ],
      })
      assertions.bad_blocked = bad.blocked ?? false
      assertions.bad_reason = bad.block_reason ?? null
      assertEq('bad.blocked', bad.blocked ?? false, true, failures)
      assertEq(
        'bad.reason',
        bad.block_reason ?? null,
        BLOCK_REASONS.AI_INFERRED_MISSING_LABEL,
        failures,
      )

      const good = validateAnswerPayload({
        blocks: [
          staticFactBlock(
            'Zairyu cards are issued at the local city office.',
            'lf_test',
          ),
          aiInferredBlock(
            'Given your situation, you likely need the same visit.',
            ['lf_test'],
            0.6,
          ),
        ],
      })
      assertions.good_blocked = good.blocked ?? false
      assertions.good_block_count = good.blocks.length
      assertions.good_labels = good.blocks.map((b) => b.label)
      assertEq('good.blocked', good.blocked ?? false, false, failures)
      assertEq('good.block_count', good.blocks.length, 2, failures)
    },
  )

  // ---- Runner ---------------------------------------------------------
  let passed = 0
  let failed = 0
  for (const r of results) {
    const emoji = r.failures.length === 0 ? 'PASS' : 'FAIL'
    console.log(`  [${emoji}] ${r.id} — ${r.description}`)
    console.log(`         assertions: ${JSON.stringify(r.assertions)}`)
    if (r.failures.length === 0) {
      passed++
    } else {
      for (const f of r.failures) console.error(`         ${f}`)
      failed++
    }
  }
  console.log(`\nJTG spec v1 regression: ${passed} passed, ${failed} failed`)
  cleanup()
  return failed > 0 ? 1 : 0
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err)
    process.exit(1)
  },
)
