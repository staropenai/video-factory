/**
 * JTG v7 — Comprehensive regression suite for all v7 modules:
 *
 *   A. JudgmentRegistry  (10 tests) — premise evaluation, rule matching, 10 rules
 *   B. Knowledge Graph    (12 tests) — nodes, edges, traversal, decay, contradictions
 *   C. Routing Optimizer  (10 tests) — R* = argmin[alpha*cost + beta*latency - gamma*quality]
 *   D. Output Validator   (12 tests) — HTML injection, PII, prompt leak, sanitization
 *   E. Bridge State Machine (10 tests) — FSM transitions, session lifecycle, metrics
 *
 * Run: `npx tsx tests/nlpm/jtg-v7.test.ts`
 * All tests are pure — no DB, no network, no filesystem.
 */

export {}

async function main(): Promise<number> {
  // Dynamic imports (ES2017 target — no top-level await).
  const {
    checkPremise,
    evaluateRule,
    evaluateAll,
    JUDGMENT_RULES,
  } = await import('../../src/lib/judgment/registry')

  const {
    createNode,
    createEdge,
    findNodesByType,
    findNodesByTag,
    getNeighbors,
    traverseSupersedes,
    computeNodeConfidence,
    findStaleNodes,
    detectContradictions,
    generateUpdateProposals,
    graphStats,
  } = await import('../../src/lib/knowledge/graph')

  const {
    normalizeValue,
    computeQualityAdjustment,
    computeRouteScore,
    optimizeRoute,
    computeConfidenceBandNumeric,
    featuresFromRouterContext,
    DEFAULT_COST_MODEL,
    DEFAULT_WEIGHTS,
  } = await import('../../src/lib/routing/optimizer')

  const {
    detectHtmlInjection,
    detectDangerousUrls,
    detectPromptLeak,
    detectPiiExposure,
    detectEncodingAttack,
    sanitizeForRender,
    sanitizeForGraphWriteback,
    sanitizeUrl,
    validateOutput,
  } = await import('../../src/lib/security/output-validator')

  const {
    VALID_TRANSITIONS,
    isValidTransition,
    getTargetState,
    createSession,
    applyTransition,
    getRequiredContext,
    isContextComplete,
    getNextActions,
    computeSessionMetrics,
    isSessionExpired,
    SESSION_TIMEOUT_MS,
  } = await import('../../src/lib/bridge/state-machine')

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

  function approx(a: number, b: number, eps = 0.01): boolean {
    return Math.abs(a - b) < eps
  }

  // =================================================================
  // A. JudgmentRegistry (10 tests)
  // =================================================================
  console.log('\n--- A. JudgmentRegistry ---')

  // A-01: checkPremise 'eq' operator
  assert(checkPremise({ field: 'x', operator: 'eq', value: 'hello' }, { x: 'hello' }), 'A-01: eq match')

  // A-02: checkPremise 'gt' operator
  assert(checkPremise({ field: 'rate', operator: 'gt', value: 0.3 }, { rate: 0.5 }), 'A-02: gt match')
  assert(!checkPremise({ field: 'rate', operator: 'gt', value: 0.3 }, { rate: 0.1 }), 'A-02b: gt no-match')

  // A-03: checkPremise 'in' operator
  assert(
    checkPremise({ field: 'country', operator: 'in', value: ['CN', 'VN', 'PH'] }, { country: 'CN' }),
    'A-03: in match',
  )

  // A-04: checkPremise 'contains' operator
  assert(
    checkPremise({ field: 'query_text', operator: 'contains', value: 'deposit' }, { query_text: 'How much is the deposit return?' }),
    'A-04: contains match',
  )

  // A-05: evaluateRule — all premises must match (AND)
  const testRule = JUDGMENT_RULES[0] // JUDG-001
  assert(testRule.ruleId === 'JUDG-001', 'A-05a: first rule is JUDG-001')
  const ctx001 = { nationality: 'non-jp', reject_rate: 0.4, vacant_days: 90 }
  assert(evaluateRule(testRule, ctx001), 'A-05b: JUDG-001 matches non-jp + high reject + long vacant')

  // A-06: evaluateRule — fails when one premise is unmet
  const ctxFail = { nationality: 'non-jp', reject_rate: 0.1, vacant_days: 90 }
  assert(!evaluateRule(testRule, ctxFail), 'A-06: JUDG-001 fails when reject_rate too low')

  // A-07: evaluateAll — finds matching rules, sorted by confidence
  const result = evaluateAll(JUDGMENT_RULES, { risk_level: 'high', confidence_band: 'low' })
  assert(result.topRule !== null, 'A-07a: evaluateAll finds a match for high-risk+low-confidence')
  assert(result.topRule?.ruleId === 'JUDG-004', 'A-07b: JUDG-004 is the high-risk escalation rule')

  // A-08: JUDGMENT_RULES has exactly 10 rules
  assert(JUDGMENT_RULES.length === 10, `A-08: 10 judgment rules (got ${JUDGMENT_RULES.length})`)

  // A-09: All rules have required fields
  for (const rule of JUDGMENT_RULES) {
    assert(
      rule.ruleId.startsWith('JUDG-') && rule.premises.length > 0 && rule.confidence > 0 && rule.confidence <= 1,
      `A-09: rule ${rule.ruleId} has valid structure`,
    )
  }

  // A-10: evaluateAll with empty context returns no matches
  const emptyResult = evaluateAll(JUDGMENT_RULES, {})
  assert(emptyResult.activatedRules.length === 0, 'A-10: empty context activates no rules')

  // =================================================================
  // B. Knowledge Graph (12 tests)
  // =================================================================
  console.log('\n--- B. Knowledge Graph ---')

  // B-01: createNode generates proper ID
  const node1 = createNode({
    type: 'policy',
    title: 'Deposit Return Rule',
    content: 'Maximum deposit is 2 months rent per Civil Code',
    metadata: {},
    confidenceBase: 0.95,
    decayType: 'linear',
    collectDate: '2026-01-01',
    tags: ['deposit', 'civil_code'],
    locale: 'ja',
    createdBy: 'human_expert',
  })
  assert(node1.id.startsWith('kg_node_'), 'B-01: node id prefix')

  // B-02: createEdge generates proper ID
  const node2 = createNode({
    type: 'pattern',
    title: '3-month deposit pattern',
    content: 'Some landlords charge 3 months deposit illegally',
    metadata: {},
    confidenceBase: 0.60,
    decayType: 'exponential',
    collectDate: '2026-02-01',
    tags: ['deposit', 'dispute'],
    locale: 'ja',
    createdBy: 'human_expert',
  })
  const edge1 = createEdge({
    type: 'prevents',
    sourceId: node1.id,
    targetId: node2.id,
    weight: 0.8,
  })
  assert(edge1.id.startsWith('kg_edge_'), 'B-02: edge id prefix')

  // B-03: findNodesByType
  const graph = { nodes: [node1, node2], edges: [edge1] }
  assert(findNodesByType(graph, 'policy').length === 1, 'B-03: findNodesByType policy')

  // B-04: findNodesByTag
  assert(findNodesByTag(graph, 'deposit').length === 2, 'B-04: findNodesByTag deposit')

  // B-05: getNeighbors
  const neighbors = getNeighbors(graph, node1.id)
  assert(neighbors.length === 1, 'B-05a: node1 has 1 neighbor')
  assert(neighbors[0].node.id === node2.id, 'B-05b: neighbor is node2')

  // B-06: computeNodeConfidence — fresh node
  const freshConf = computeNodeConfidence(node1, new Date('2026-01-15'))
  assert(freshConf > 0.9, `B-06: fresh node confidence > 0.9 (got ${freshConf.toFixed(3)})`)

  // B-07: computeNodeConfidence — old node decays
  const oldConf = computeNodeConfidence(node1, new Date('2027-06-01'))
  assert(oldConf < freshConf, `B-07: old confidence (${oldConf.toFixed(3)}) < fresh (${freshConf.toFixed(3)})`)

  // B-08: findStaleNodes
  const stale = findStaleNodes(graph, 0.5, new Date('2028-01-01'))
  assert(stale.length >= 1, 'B-08: at least 1 stale node after 2 years')

  // B-09: detectContradictions — nodes with same tags, different content, confidence gap > 0.3
  const contradictions = detectContradictions(graph)
  assert(contradictions.length >= 1, `B-09: finds contradiction between policy and pattern (gap=${Math.abs(node1.confidenceBase - node2.confidenceBase).toFixed(2)})`)

  // B-10: traverseSupersedes
  const node3 = createNode({
    type: 'policy',
    title: 'Updated Deposit Rule 2026',
    content: 'New rule effective 2026-04',
    metadata: {},
    confidenceBase: 0.98,
    decayType: 'step',
    collectDate: '2026-04-01',
    tags: ['deposit'],
    locale: 'ja',
    createdBy: 'human_expert',
  })
  const supersedesEdge = createEdge({
    type: 'supersedes',
    sourceId: node3.id,
    targetId: node1.id,
    weight: 1.0,
  })
  const graph2 = { nodes: [node1, node2, node3], edges: [edge1, supersedesEdge] }
  const chain = traverseSupersedes(graph2, node3.id)
  assert(chain.length >= 2, `B-10: supersedes chain has >=2 nodes (got ${chain.length})`)

  // B-11: generateUpdateProposals
  const proposals = generateUpdateProposals(graph, node3)
  assert(proposals.length >= 1, `B-11: new evidence generates >=1 update proposal`)

  // B-12: graphStats
  const stats = graphStats(graph2)
  assert(stats.nodeCount === 3, `B-12a: 3 nodes (got ${stats.nodeCount})`)
  assert(stats.edgeCount === 2, `B-12b: 2 edges (got ${stats.edgeCount})`)

  // =================================================================
  // C. Routing Optimizer (10 tests)
  // =================================================================
  console.log('\n--- C. Routing Optimizer ---')

  // C-01: normalizeValue
  assert(approx(normalizeValue(50, 0, 100), 0.5), 'C-01: normalizeValue 50/100 = 0.5')
  assert(approx(normalizeValue(0, 0, 100), 0), 'C-01b: normalizeValue min = 0')
  assert(approx(normalizeValue(100, 0, 100), 1), 'C-01c: normalizeValue max = 1')

  // C-02: computeConfidenceBandNumeric
  assert(approx(computeConfidenceBandNumeric('high'), 0.9), 'C-02: high → 0.9')
  assert(approx(computeConfidenceBandNumeric('low'), 0.3), 'C-02b: low → 0.3')

  // C-03: High-quality retrieval → layer1_static wins
  const highMatchFeatures = {
    fSemantic: 0.95, fRisk: 0.1, fLang: 0.8, fTemporal: 0.9, fConfidence: 0.9, queryComplexity: 0.2,
  }
  const result1 = optimizeRoute(highMatchFeatures)
  assert(result1.optimal === 'layer1_static', `C-03: high match → layer1_static (got ${result1.optimal})`)

  // C-04: Low language capacity → layer5_bridge preferred over layer3_ai
  const lowLangFeatures = {
    fSemantic: 0.5, fRisk: 0.2, fLang: 0.1, fTemporal: 0.7, fConfidence: 0.6, queryComplexity: 0.5,
  }
  const result2 = optimizeRoute(lowLangFeatures)
  const bridgeScore = result2.scores.find(s => s.route === 'layer5_bridge')!
  const aiScore = result2.scores.find(s => s.route === 'layer3_ai')!
  assert(bridgeScore.rawQuality > aiScore.rawQuality * 0.8, 'C-04: low fLang boosts bridge quality')

  // C-05: High risk → layer6_human gets quality bonus
  const highRiskFeatures = {
    fSemantic: 0.6, fRisk: 0.9, fLang: 0.5, fTemporal: 0.5, fConfidence: 0.4, queryComplexity: 0.8,
  }
  const result3 = optimizeRoute(highRiskFeatures)
  assert(result3.optimal === 'layer6_human', `C-05: high risk → layer6_human (got ${result3.optimal})`)

  // C-06: avoidedHumanEscalation flag
  assert(result1.avoidedHumanEscalation === true, 'C-06a: layer1 avoids human')
  assert(result3.avoidedHumanEscalation === false, 'C-06b: layer6 does not avoid human')

  // C-07: costSavingVsBaseline
  assert(result1.costSavingVsBaseline > 0, 'C-07: non-human route saves cost')

  // C-08: DEFAULT_COST_MODEL sanity
  assert(DEFAULT_COST_MODEL.costPerQuery.layer6_human === 5.00, 'C-08: human cost is $5')
  assert(DEFAULT_COST_MODEL.costPerQuery.layer1_static === 0.00, 'C-08b: static cost is $0')

  // C-09: featuresFromRouterContext
  const features = featuresFromRouterContext(
    { topScore: 0.85, hasStaleSource: false },
    'high', 'low', 0.3,
  )
  assert(approx(features.fSemantic, 0.85), 'C-09a: fSemantic from topScore')
  assert(approx(features.fLang, 0.3), 'C-09b: fLang passthrough')

  // C-10: Scores array always has 4 entries
  assert(result1.scores.length === 4, 'C-10: 4 route candidates scored')

  // =================================================================
  // D. Output Validator (12 tests)
  // =================================================================
  console.log('\n--- D. Output Validator ---')

  // D-01: detectHtmlInjection
  const htmlIssues = detectHtmlInjection('Hello <script>alert(1)</script> world')
  assert(htmlIssues.length >= 1, 'D-01: detects <script> tag')
  assert(htmlIssues[0].severity === 'critical', 'D-01b: script injection is critical')

  // D-02: detectHtmlInjection — safe text
  assert(detectHtmlInjection('Hello world').length === 0, 'D-02: clean text has no issues')

  // D-03: detectDangerousUrls
  const urlIssues = detectDangerousUrls('Click here: javascript:alert(1)')
  assert(urlIssues.length >= 1, 'D-03: detects javascript: URL')

  // D-04: detectPromptLeak
  const leakIssues = detectPromptLeak('You are a helpful assistant that follows ROUTING_RULES')
  assert(leakIssues.length >= 1, 'D-04: detects prompt leak with ROUTING_RULES')

  // D-05: detectPiiExposure — email
  const piiEmail = detectPiiExposure('Contact: user@example.com for details')
  assert(piiEmail.length >= 1, 'D-05: detects email address')

  // D-06: detectPiiExposure — Japanese phone
  const piiPhone = detectPiiExposure('Call 090-1234-5678')
  assert(piiPhone.length >= 1, 'D-06: detects Japanese phone number')

  // D-07: detectEncodingAttack — zero-width chars
  const zwIssues = detectEncodingAttack('Hello\u200Bworld')
  assert(zwIssues.length >= 1, 'D-07: detects zero-width character')

  // D-08: sanitizeForRender — escapes HTML
  const sanitized = sanitizeForRender('<b>bold</b> & "quotes"')
  assert(!sanitized.includes('<b>'), 'D-08a: <b> escaped')
  assert(sanitized.includes('&amp;'), 'D-08b: & escaped')

  // D-09: sanitizeForGraphWriteback — strips HTML
  const cleaned = sanitizeForGraphWriteback('<p>Some <b>text</b></p>')
  assert(!cleaned.includes('<'), 'D-09: HTML tags stripped')

  // D-10: sanitizeUrl
  assert(sanitizeUrl('https://example.com') === 'https://example.com', 'D-10a: https allowed')
  assert(sanitizeUrl('javascript:alert(1)') === null, 'D-10b: javascript: blocked')
  assert(sanitizeUrl('file:///etc/passwd') === null, 'D-10c: file: blocked')

  // D-11: validateOutput — full pipeline for render
  const renderResult = validateOutput('<script>x</script> normal text', 'render')
  assert(renderResult.ok === false, 'D-11a: script injection → not ok')
  assert(!renderResult.sanitized.includes('<script>'), 'D-11b: sanitized removes script')

  // D-12: validateOutput — clean text passes
  const cleanResult = validateOutput('This is perfectly safe text about renting.', 'render')
  assert(cleanResult.ok === true, 'D-12: clean text passes validation')

  // =================================================================
  // E. Bridge State Machine (10 tests)
  // =================================================================
  console.log('\n--- E. Bridge State Machine ---')

  // E-01: createSession starts in 'idle'
  const session = createSession('lease/renewal', 'zh')
  assert(session.state === 'idle', 'E-01a: initial state is idle')
  assert(session.sceneTag === 'lease/renewal', 'E-01b: sceneTag set')
  assert(session.id.length > 0, 'E-01c: session id generated')

  // E-02: Valid transition idle → scene_identified
  const t1 = applyTransition(session, 'identify_scene')
  assert(t1.ok === true, 'E-02a: identify_scene succeeds from idle')
  assert(t1.session.state === 'scene_identified', 'E-02b: state is scene_identified')

  // E-03: Invalid transition
  const bad = applyTransition(session, 'call_ended')
  assert(bad.ok === false, 'E-03: call_ended from idle fails')

  // E-04: Full happy path
  let s = createSession('equipment/no_hot_water', 'en')
  s = applyTransition(s, 'identify_scene').session
  s = applyTransition(s, 'request_context').session
  s = applyTransition(s, 'context_complete').session
  s = applyTransition(s, 'script_generated').session
  s = applyTransition(s, 'skip_rehearsal').session
  s = applyTransition(s, 'call_ended').session
  const finalT = applyTransition(s, 'resolved')
  assert(finalT.ok === true, 'E-04a: full happy path completes')
  assert(finalT.session.state === 'completed', 'E-04b: final state is completed')

  // E-05: Escalation from any state
  let s2 = createSession('moveout/notice', 'zh')
  s2 = applyTransition(s2, 'identify_scene').session
  const esc = applyTransition(s2, 'need_human')
  assert(esc.ok === true, 'E-05a: need_human from scene_identified succeeds')
  assert(esc.session.state === 'escalated', 'E-05b: state is escalated')

  // E-06: getRequiredContext
  const leaseCtx = getRequiredContext('lease/renewal')
  assert(leaseCtx.length >= 2, `E-06: lease context has >=2 fields (got ${leaseCtx.length})`)

  // E-07: isContextComplete
  const s3 = createSession('utilities/start_service', 'zh')
  assert(!isContextComplete(s3), 'E-07a: empty context is incomplete')
  const required = getRequiredContext('utilities/start_service')
  const s3filled = { ...s3, contextGathered: Object.fromEntries(required.map(k => [k, 'value'])) }
  assert(isContextComplete(s3filled), 'E-07b: filled context is complete')

  // E-08: getNextActions
  const actions = getNextActions(session)
  assert(actions.length >= 1, 'E-08: idle state has suggested actions')

  // E-09: computeSessionMetrics
  const metrics = computeSessionMetrics(finalT.session)
  assert(metrics.statesTraversed >= 7, `E-09a: traversed >=7 states (got ${metrics.statesTraversed})`)
  assert(metrics.completed === true, 'E-09b: completed flag true')
  assert(metrics.escalated === false, 'E-09c: not escalated')

  // E-10: isSessionExpired
  const oldSession = { ...session, updatedAt: new Date(Date.now() - SESSION_TIMEOUT_MS - 1000).toISOString() }
  assert(isSessionExpired(oldSession), 'E-10: session expired after timeout')
  assert(!isSessionExpired(session), 'E-10b: fresh session not expired')

  // =================================================================
  // Summary
  // =================================================================
  const total = passed + failed
  console.log(`\n=== v7 Results: ${passed}/${total} passed, ${failed} failed ===\n`)
  return failed
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err)
  process.exit(1)
})
