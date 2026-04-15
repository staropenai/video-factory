/**
 * Memory Hierarchy (TASK 10)
 *
 * Defines a 5-level context hierarchy for the routing pipeline.
 * Each level has different scope, lifetime, and override semantics.
 *
 * Hierarchy (higher number = more specific, takes precedence):
 *
 *   Level 1 — PLATFORM (global defaults, safety rules, system config)
 *   Level 2 — TEAM (organization/team-level overrides)
 *   Level 3 — USER (per-user preferences, history, language)
 *   Level 4 — PAGE (current page/feature context)
 *   Level 5 — CASE (current conversation/case state)
 *
 * Resolution: more specific levels override less specific ones.
 * Safety constraints from Level 1 can NEVER be overridden.
 */

// ─── Level 1: Platform Context (immutable safety + system defaults) ──────────

export interface PlatformContext {
  /** Platform safety rules version (for audit) */
  safetyVersion: string
  /** Default risk threshold for escalation */
  defaultEscalationRisk: 'medium' | 'high'
  /** Whether LLM calls are enabled (kill switch) */
  llmEnabled: boolean
  /** Maximum message length */
  maxMessageLength: number
  /** Supported languages */
  supportedLanguages: readonly string[]
}

export const PLATFORM_DEFAULTS: PlatformContext = {
  safetyVersion: '1.0.0',
  defaultEscalationRisk: 'high',
  llmEnabled: true,
  maxMessageLength: 1500,
  supportedLanguages: ['zh', 'ja', 'en', 'ko', 'vi', 'th'] as const,
}

// ─── Level 2: Team Context (organization overrides) ──────────────────────────

export interface TeamContext {
  /** Team/org identifier */
  teamId?: string
  /** Custom escalation patterns (extends platform defaults) */
  customEscalationPatterns?: string[]
  /** Disabled rule keys (team can disable non-safety rules) */
  disabledRuleKeys?: string[]
  /** Custom answer disclaimers */
  disclaimerOverride?: string
}

// ─── Level 3: User Context (per-user state) ─────────────────────────────────

export interface UserContext {
  /** Authenticated user ID (if any) */
  userId?: string
  /** Anonymous session ID */
  sessionId?: string
  /** Preferred language */
  preferredLanguage?: string
  /** Number of queries in this session */
  queryCount?: number
  /** Previous risk levels in this session */
  sessionRiskHistory?: Array<'low' | 'medium' | 'high'>
}

// ─── Level 4: Page Context (current feature/page) ───────────────────────────

export interface PageContext {
  /** Which page/feature the query originates from */
  sourcePage?: string
  /** Feature flags active for this page */
  featureFlags?: Record<string, boolean>
  /** Pre-filtered FAQ categories for this page */
  scopedCategories?: string[]
}

// ─── Level 5: Case Context (current conversation/case) ──────────────────────

export interface CaseContext {
  /** Active case ID (if continuing a case) */
  caseId?: string
  /** Number of clarification rounds in this conversation */
  clarificationRounds: number
  /** Whether a human has been requested */
  requiresHuman: boolean
  /** Previous answer types in this conversation */
  previousAnswerTypes?: string[]
  /** Extensible key-value context */
  metadata?: Record<string, unknown>
}

// ─── Resolved Context ────────────────────────────────────────────────────────

/**
 * The fully resolved context that the routing pipeline uses.
 * Built by merging all 5 levels.
 */
export interface ResolvedContext {
  platform: PlatformContext
  team: TeamContext
  user: UserContext
  page: PageContext
  case: CaseContext
}

/**
 * Resolves the full context hierarchy from available inputs.
 * More specific levels take precedence, but platform safety is immutable.
 */
export function resolveContextHierarchy(input: {
  team?: Partial<TeamContext>
  user?: Partial<UserContext>
  page?: Partial<PageContext>
  case?: Partial<CaseContext>
}): ResolvedContext {
  return {
    // Level 1: Platform defaults are immutable
    platform: { ...PLATFORM_DEFAULTS },

    // Level 2: Team overrides
    team: {
      ...input.team,
    },

    // Level 3: User context
    user: {
      ...input.user,
    },

    // Level 4: Page context
    page: {
      ...input.page,
    },

    // Level 5: Case context (most specific)
    case: {
      clarificationRounds: input.case?.clarificationRounds ?? 0,
      requiresHuman: input.case?.requiresHuman ?? false,
      ...input.case,
    },
  }
}

/**
 * Checks if a rule key is disabled at any level.
 * Safety rules (prefixed with 'safety:' or in PROTECTED_RULES) cannot be disabled.
 */
const PROTECTED_RULES = new Set([
  'high_risk_gate',
  'escalation_gate',
])

export function isRuleDisabled(
  ruleKey: string,
  ctx: ResolvedContext,
): boolean {
  // Safety rules can never be disabled
  if (PROTECTED_RULES.has(ruleKey) || ruleKey.startsWith('safety:')) {
    return false
  }
  return ctx.team.disabledRuleKeys?.includes(ruleKey) ?? false
}
