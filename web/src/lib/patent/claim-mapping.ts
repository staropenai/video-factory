/**
 * Patent claim -> code module mapping (static reference/audit tool).
 *
 * Connects each patent claim element to the actual code that implements it.
 * No runtime behavior change -- purely a reference for patent prosecution
 * and code-level traceability audits.
 *
 * Three claim structures (schemes A, B, C) map to the three patent strategies:
 *   A: Multi-objective adaptive routing with human cooperation layer
 *   B: Time-aware evidence confidence system
 *   C: Cross-language scene state machine
 *
 * All exports are PURE -- no I/O.
 */

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export interface ClaimElement {
  elementId: string
  scheme: 'A' | 'B' | 'C'
  description: string
  triggerCondition: string
  technicalEffect: string
  codeModules: string[]
  measuredBy: string
  priorArtRisk: string
}

export interface ClaimStructure {
  scheme: string
  independentClaim: string
  dependentClaims: string[]
  elements: ClaimElement[]
  nearestPriorArt: string[]
  mainExaminationRisk: string
  differentiator: string
}

// ---------------------------------------------------------------------
// Claim A: Multi-objective adaptive routing with human cooperation layer.
// ---------------------------------------------------------------------

const CLAIM_A_ELEMENTS: ClaimElement[] = [
  {
    elementId: 'A1',
    scheme: 'A',
    description:
      'Receive user input q with context c and prepare for multi-objective route selection',
    triggerCondition: 'User submits a query via the router API endpoint',
    technicalEffect:
      'Structured input normalization enabling downstream feature extraction',
    codeModules: ['router/decide.ts', 'app/api/router/route.ts'],
    measuredBy: 'routingDecision.queryId',
    priorArtRisk:
      'Low -- input reception is standard; novelty lies in the combination with multi-objective routing',
  },
  {
    elementId: 'A2',
    scheme: 'A',
    description:
      'Feature extraction F = [f_semantic, f_risk, f_lang, f_temporal] from query and context',
    triggerCondition: 'After A1 receives input, before route decision',
    technicalEffect:
      'Four-dimensional feature vector capturing semantic intent, risk level, language capacity, and temporal urgency',
    codeModules: ['routing/optimizer.ts', 'patent/f-lang.ts'],
    measuredBy: 'routingDecision.features',
    priorArtRisk:
      'Medium -- individual features exist in prior art; the specific combination with f_lang (language action capacity) is novel',
  },
  {
    elementId: 'A3',
    scheme: 'A',
    description:
      'Route decision R* = argmin[alpha*cost + beta*latency - gamma*quality] with human path as candidate',
    triggerCondition: 'Feature vector F is computed',
    technicalEffect:
      'Optimal route selection balancing cost, latency, and quality with human escalation as an explicit optimization candidate',
    codeModules: ['routing/optimizer.ts'],
    measuredBy: 'routingDecision.routeTaken',
    priorArtRisk:
      'Low -- multi-objective optimization for LLM routing with human-in-the-loop as a first-class route candidate is novel',
  },
  {
    elementId: 'A4',
    scheme: 'A',
    description:
      'Layered execution with confidence threshold escalation (L1->L3->L5->L6)',
    triggerCondition: 'Route R* is selected; confidence falls below layer threshold',
    technicalEffect:
      'Progressive escalation from cached responses through AI to human review based on confidence thresholds',
    codeModules: ['router/decide.ts', 'rules/engine.ts'],
    measuredBy: 'routingDecision.confidenceScore',
    priorArtRisk:
      'Low -- layered escalation with confidence thresholds specific to immigration/visa domain is novel',
  },
  {
    elementId: 'A5',
    scheme: 'A',
    description:
      'Immutable audit logging of routing decision and execution result',
    triggerCondition: 'After route execution completes (success or escalation)',
    technicalEffect:
      'Complete decision trail enabling patent evidence collection and compliance audit',
    codeModules: ['patent/evidence-chain-logger.ts', 'audit/logger.ts'],
    measuredBy: 'routingDecision.layer6Triggered',
    priorArtRisk:
      'Low -- audit logging is common; the specific integration with patent evidence collection is differentiating',
  },
]

const CLAIM_A: ClaimStructure = {
  scheme: 'A',
  independentClaim:
    'A computer-implemented method for adaptive query routing comprising: receiving user input with context; extracting a multi-dimensional feature vector including semantic, risk, language capacity, and temporal features; computing an optimal route via multi-objective optimization over cost, latency, and quality with a human cooperation path as an explicit candidate; executing via layered confidence-threshold escalation; and immutably logging the decision chain.',
  dependentClaims: [
    'The method of claim 1, wherein the language capacity feature f_lang is computed from L2 query ratio and code-switch frequency over a sliding window.',
    'The method of claim 1, wherein the human cooperation path (L6) is selected when confidence score falls below a predetermined threshold after all automated layers.',
    'The method of claim 1, wherein the immutable audit log captures feature vector, route decision, execution result, and user action after response.',
  ],
  elements: CLAIM_A_ELEMENTS,
  nearestPriorArt: [
    'OpenAI Router (cost-based model selection without human path)',
    'Martian Model Router (latency-optimized routing without domain features)',
    'Traditional call-center escalation (rule-based without multi-objective optimization)',
  ],
  mainExaminationRisk:
    'Examiner may argue that multi-objective routing is obvious combination of known elements; f_lang and human-as-candidate differentiate.',
  differentiator:
    'Human cooperation layer as a first-class optimization candidate in the same objective function as AI routes, combined with domain-specific f_lang feature extraction.',
}

// ---------------------------------------------------------------------
// Claim B: Time-aware evidence confidence system.
// ---------------------------------------------------------------------

const CLAIM_B_ELEMENTS: ClaimElement[] = [
  {
    elementId: 'B1',
    scheme: 'B',
    description:
      'Evidence registration with collect_date, source_type, and verified_by metadata',
    triggerCondition: 'New evidence record is added to the system',
    technicalEffect:
      'Temporally-tagged evidence storage enabling time-aware confidence computation',
    codeModules: ['evidence/registry.ts', 'db/tables.ts'],
    measuredBy: 'evidenceInjection.evidenceCount',
    priorArtRisk:
      'Medium -- evidence registration is common in knowledge bases; temporal metadata for confidence decay is less common',
  },
  {
    elementId: 'B2',
    scheme: 'B',
    description:
      'Confidence decay function conf(E,t) = base * f(t - collect_date) with configurable decay curves',
    triggerCondition: 'Evidence is accessed or confidence is evaluated',
    technicalEffect:
      'Automatic staleness detection via temporal decay (linear, exponential, or step function)',
    codeModules: ['patent/confidence-decay.ts'],
    measuredBy: 'evidenceInjection.confidenceScores',
    priorArtRisk:
      'Low -- temporal confidence decay applied to immigration evidence is novel; general concept exists in cache invalidation',
  },
  {
    elementId: 'B3',
    scheme: 'B',
    description:
      'Confidence-filtered retrieval excluding evidence when conf < theta_evidence_min',
    triggerCondition: 'Evidence retrieval request with active confidence filter',
    technicalEffect:
      'Stale evidence automatically excluded from active retrieval set, reducing misinformation risk',
    codeModules: ['evidence/registry.ts'],
    measuredBy: 'evidenceInjection.evidenceInjected',
    priorArtRisk:
      'Low -- threshold-based filtering with decay-adjusted confidence is a specific technical implementation',
  },
  {
    elementId: 'B4',
    scheme: 'B',
    description:
      'Evidence injection trigger score T = w1*H + w2*dwell + w3*click combining text entropy, dwell time, and click patterns',
    triggerCondition: 'User interaction signals exceed trigger threshold',
    technicalEffect:
      'Proactive evidence injection based on behavioral uncertainty signals',
    codeModules: ['patent/confidence-decay.ts'],
    measuredBy: 'evidenceInjection.triggerScore',
    priorArtRisk:
      'Low -- combining text entropy with behavioral signals for evidence injection decision is novel',
  },
  {
    elementId: 'B5',
    scheme: 'B',
    description:
      'Post-injection L6 trigger rate tracking to measure evidence effectiveness',
    triggerCondition: 'After evidence injection, monitor whether human escalation still occurs',
    technicalEffect:
      'Closed-loop measurement of evidence quality via reduction in human escalation rate',
    codeModules: ['patent/evidence-chain-logger.ts'],
    measuredBy: 'evidenceInjection.subsequentLayer6Trigger',
    priorArtRisk:
      'Low -- using human escalation rate as a feedback signal for evidence quality is novel',
  },
]

const CLAIM_B: ClaimStructure = {
  scheme: 'B',
  independentClaim:
    'A computer-implemented system for time-aware evidence confidence management comprising: registering evidence with temporal metadata; computing current confidence via a decay function applied to the time since collection; filtering retrieval results by a minimum confidence threshold; detecting user uncertainty via a weighted trigger score combining text entropy, dwell time, and click patterns; and tracking post-injection human escalation rates as a quality feedback signal.',
  dependentClaims: [
    'The system of claim 1, wherein the decay function is selected from linear, exponential, and step decay types with configurable parameters.',
    'The system of claim 1, wherein the trigger score weights and threshold are tuned based on historical L6 trigger rate data.',
    'The system of claim 1, wherein evidence records falling below the confidence threshold are marked for update and excluded from the active retrieval set.',
  ],
  elements: CLAIM_B_ELEMENTS,
  nearestPriorArt: [
    'Cache TTL systems (time-based expiry without confidence decay curves)',
    'RAG systems (retrieval without temporal confidence filtering)',
    'A/B testing frameworks (measurement without evidence-specific trigger scores)',
  ],
  mainExaminationRisk:
    'Examiner may compare to cache invalidation or TTL mechanisms; the confidence decay curve and behavioral trigger score differentiate.',
  differentiator:
    'Combining temporal confidence decay with behavioral uncertainty detection (entropy + dwell + click) for proactive evidence injection, with human escalation rate as the closed-loop quality metric.',
}

// ---------------------------------------------------------------------
// Claim C: Cross-language scene state machine.
// ---------------------------------------------------------------------

const CLAIM_C_ELEMENTS: ClaimElement[] = [
  {
    elementId: 'C1',
    scheme: 'C',
    description:
      'FSM definition with states: idle, scene_identified, context_gathering, script_preparing, script_ready, rehearsal, executing, followup, completed, escalated',
    triggerCondition: 'Bridge session initialization',
    technicalEffect:
      'Deterministic state machine governing cross-language interaction flow with explicit state tracking',
    codeModules: ['bridge/state-machine.ts'],
    measuredBy: 'bridgeSession.statesTraversed',
    priorArtRisk:
      'Medium -- FSMs are well-known; application to cross-language real-world scene navigation is novel',
  },
  {
    elementId: 'C2',
    scheme: 'C',
    description:
      'Scene initialization from (scene_tag, user_intent) pair mapping to scenario template',
    triggerCondition: 'User intent matches a known real-world scenario requiring language bridge',
    technicalEffect:
      'Scenario-specific context loading reducing cold-start latency for bridge sessions',
    codeModules: ['bridge/state-machine.ts'],
    measuredBy: 'bridgeSession.sceneTag',
    priorArtRisk:
      'Low -- scene-tag based initialization for language bridge scenarios is domain-specific and novel',
  },
  {
    elementId: 'C3',
    scheme: 'C',
    description:
      'Uncertainty quantification via context completeness check before script generation',
    triggerCondition: 'Transition from context_gathering to script_preparing state',
    technicalEffect:
      'Prevents premature script generation when context is incomplete, reducing follow-up questions',
    codeModules: ['bridge/state-machine.ts'],
    measuredBy: 'bridgeSession.followupQuestions',
    priorArtRisk:
      'Low -- context completeness gating for action script generation is a specific technical contribution',
  },
  {
    elementId: 'C4',
    scheme: 'C',
    description:
      'Action script generation with L2 text + pronunciation + L1 explanation + expected response patterns',
    triggerCondition: 'State machine reaches script_preparing with sufficient context',
    technicalEffect:
      'Multi-component script output enabling real-world language task execution with pronunciation guidance',
    codeModules: ['bridge/friction-reducer.ts', 'bridge/scenarios.ts'],
    measuredBy: 'bridgeSession.userCopiedScript',
    priorArtRisk:
      'Low -- structured action scripts with pronunciation and expected response patterns for real-world scenarios are novel',
  },
  {
    elementId: 'C5',
    scheme: 'C',
    description:
      'State path recording for session optimization and patent evidence collection',
    triggerCondition: 'Each state transition in the FSM',
    technicalEffect:
      'Complete state traversal history enabling session analysis and patent technical effect measurement',
    codeModules: ['patent/evidence-chain-logger.ts'],
    measuredBy: 'bridgeSession.statesTraversed',
    priorArtRisk:
      'Low -- state path recording is standard; integration with patent evidence is differentiating',
  },
]

const CLAIM_C: ClaimStructure = {
  scheme: 'C',
  independentClaim:
    'A computer-implemented method for cross-language real-world scene navigation comprising: defining a finite state machine with states from idle through completion and escalation; initializing from a scene tag and user intent; quantifying context completeness before script generation; generating action scripts containing target-language text, pronunciation, native-language explanation, and expected response patterns; and recording the state path for optimization.',
  dependentClaims: [
    'The method of claim 1, wherein the state machine includes a rehearsal state allowing the user to practice the generated script before real-world execution.',
    'The method of claim 1, wherein context completeness is measured as a ratio of required fields populated for the active scenario template.',
    'The method of claim 1, wherein expected response patterns include both positive and negative responses with corresponding follow-up scripts.',
  ],
  elements: CLAIM_C_ELEMENTS,
  nearestPriorArt: [
    'Google Translate (text translation without scene-aware state machine)',
    'Duolingo scenarios (language learning without real-world task execution)',
    'Chatbot dialog managers (state machines without cross-language script generation)',
  ],
  mainExaminationRisk:
    'Examiner may argue this is an obvious combination of translation + dialog management; the scene-specific FSM with action scripts differentiates.',
  differentiator:
    'Scene-aware finite state machine that generates executable action scripts (not translations) with pronunciation and expected response patterns for real-world cross-language task completion.',
}

// ---------------------------------------------------------------------
// Aggregate collections.
// ---------------------------------------------------------------------

export const CLAIM_STRUCTURES: ClaimStructure[] = [CLAIM_A, CLAIM_B, CLAIM_C]

export const ALL_CLAIM_ELEMENTS: ClaimElement[] = [
  ...CLAIM_A_ELEMENTS,
  ...CLAIM_B_ELEMENTS,
  ...CLAIM_C_ELEMENTS,
]

// ---------------------------------------------------------------------
// Pure lookup functions.
// ---------------------------------------------------------------------

/**
 * Get a full claim structure by scheme identifier.
 */
export function getClaimStructure(scheme: 'A' | 'B' | 'C'): ClaimStructure {
  const found = CLAIM_STRUCTURES.find((s) => s.scheme === scheme)
  if (!found) {
    throw new Error(`Unknown claim scheme: ${scheme}`)
  }
  return found
}

/**
 * Get a single claim element by its elementId (e.g. "A1", "B3", "C2").
 * Returns null if not found.
 */
export function getClaimElement(elementId: string): ClaimElement | null {
  return ALL_CLAIM_ELEMENTS.find((e) => e.elementId === elementId) ?? null
}

/**
 * Find all claim elements that reference a given code module path.
 * Matches if the modulePath appears as a substring of any entry in codeModules.
 */
export function getElementsForModule(modulePath: string): ClaimElement[] {
  return ALL_CLAIM_ELEMENTS.filter((e) =>
    e.codeModules.some(
      (m) => m === modulePath || m.endsWith(modulePath) || modulePath.endsWith(m),
    ),
  )
}

/**
 * Find all claim elements measured by a specific evidence field.
 * Exact match on the measuredBy property.
 */
export function getElementsMeasuredBy(field: string): ClaimElement[] {
  return ALL_CLAIM_ELEMENTS.filter((e) => e.measuredBy === field)
}
