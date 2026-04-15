/**
 * JudgmentRegistry — v7 core module.
 *
 * 把人类专家的判断逻辑，结构化为可审计、可迭代的数据
 * (GrazeMate principle: the value isn't flying — it's putting herding
 * judgment into the system.)
 *
 * This module systematises expert judgment into auditable, iterable
 * algorithms. Each JudgmentRule captures a set of premises (AND logic),
 * the action to take when all premises match, and metadata for
 * traceability (evidence source, patent relevance, confidence).
 *
 * All domain logic is PURE — no I/O. The I/O wrappers at the bottom
 * persist evaluation outcomes to a JSONL file for the data loop.
 */

import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export interface JudgmentPremise {
  field: string        // e.g. 'nationality', 'reject_rate', 'vacant_days', 'query_contains', 'residence_months'
  operator: 'eq' | 'in' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'matches'
  value: string | number | boolean | string[]
}

export interface JudgmentRule {
  ruleId: string           // e.g. 'JUDG-001'
  domain: string           // e.g. 'staropenai' or 'jtg'
  premises: JudgmentPremise[]
  judgment: string         // action description
  action: string           // machine-readable action
  confidence: number       // 0-1
  evidenceSource: string   // what data backs this rule
  createdBy: 'human_expert' | 'system_derived'
  lastValidated: string    // ISO date
  patentRelevant: boolean
  patentMethod?: string    // which patent scheme this maps to
}

export interface JudgmentContext {
  [key: string]: string | number | boolean | string[] | undefined
}

export interface JudgmentOutcome {
  id: string
  ruleId: string
  timestamp: string
  context: JudgmentContext
  actualOutcome: string
  success: boolean
}

export interface JudgmentEvalResult {
  activatedRules: JudgmentRule[]
  topRule: JudgmentRule | null
  confidence: number
  action: string | null
}

// ---------------------------------------------------------------------
// Pure: premise evaluation.
// ---------------------------------------------------------------------

/**
 * Evaluate a single premise against a context value.
 * Pure — no I/O.
 */
export function checkPremise(
  premise: JudgmentPremise,
  context: JudgmentContext,
): boolean {
  const ctxValue = context[premise.field]

  // Missing context field → premise cannot be satisfied.
  if (ctxValue === undefined || ctxValue === null) return false

  switch (premise.operator) {
    case 'eq':
      return ctxValue === premise.value

    case 'in': {
      if (!Array.isArray(premise.value)) return false
      return premise.value.includes(String(ctxValue))
    }

    case 'gt':
      return typeof ctxValue === 'number' && typeof premise.value === 'number'
        && ctxValue > premise.value

    case 'lt':
      return typeof ctxValue === 'number' && typeof premise.value === 'number'
        && ctxValue < premise.value

    case 'gte':
      return typeof ctxValue === 'number' && typeof premise.value === 'number'
        && ctxValue >= premise.value

    case 'lte':
      return typeof ctxValue === 'number' && typeof premise.value === 'number'
        && ctxValue <= premise.value

    case 'contains': {
      if (typeof ctxValue === 'string' && typeof premise.value === 'string') {
        return ctxValue.toLowerCase().includes(premise.value.toLowerCase())
      }
      if (Array.isArray(ctxValue) && typeof premise.value === 'string') {
        return ctxValue.some((v) => v.toLowerCase().includes(premise.value.toString().toLowerCase()))
      }
      return false
    }

    case 'matches': {
      if (typeof ctxValue !== 'string' || typeof premise.value !== 'string') return false
      try {
        return new RegExp(premise.value, 'i').test(ctxValue)
      } catch {
        return false
      }
    }

    default:
      return false
  }
}

// ---------------------------------------------------------------------
// Pure: rule evaluation.
// ---------------------------------------------------------------------

/**
 * Evaluate whether ALL premises of a rule match the context (AND logic).
 * Pure — no I/O.
 */
export function evaluateRule(
  rule: JudgmentRule,
  context: JudgmentContext,
): boolean {
  if (rule.premises.length === 0) return false
  return rule.premises.every((p) => checkPremise(p, context))
}

/**
 * Evaluate all rules against a context. Returns matching rules sorted
 * by confidence descending; topRule is the highest-confidence match.
 * Pure — no I/O.
 */
export function evaluateAll(
  rules: JudgmentRule[],
  context: JudgmentContext,
): JudgmentEvalResult {
  const activatedRules = rules
    .filter((r) => evaluateRule(r, context))
    .sort((a, b) => b.confidence - a.confidence)

  const topRule = activatedRules.length > 0 ? activatedRules[0] : null

  return {
    activatedRules,
    topRule,
    confidence: topRule?.confidence ?? 0,
    action: topRule?.action ?? null,
  }
}

// ---------------------------------------------------------------------
// Hardcoded initial rules — staropenai domain.
// ---------------------------------------------------------------------

export const JUDGMENT_RULES: JudgmentRule[] = [
  // JUDG-001: Foreign tenant from high-rejection nationality + landlord
  // reject rate > 0.3 + vacant > 60 days → recommend_landlord_package
  {
    ruleId: 'JUDG-001',
    domain: 'staropenai',
    premises: [
      { field: 'nationality', operator: 'in', value: ['non-jp'] },
      { field: 'reject_rate', operator: 'gt', value: 0.3 },
      { field: 'vacant_days', operator: 'gt', value: 60 },
    ],
    judgment: 'Landlord has high rejection rate for foreign tenants and unit has been vacant long — recommend landlord support package to reduce friction and fill vacancy.',
    action: 'recommend_landlord_package',
    confidence: 0.85,
    evidenceSource: 'staropenai rejection logs + vacancy duration data',
    createdBy: 'human_expert',
    lastValidated: '2026-04-01',
    patentRelevant: true,
    patentMethod: 'scheme_a_friction_detection',
  },

  // JUDG-002: Query contains deposit+return+moveout + residence < 12 months
  // → activate_evidence_system + trigger_language_bridge
  {
    ruleId: 'JUDG-002',
    domain: 'staropenai',
    premises: [
      { field: 'query_text', operator: 'matches', value: '(deposit|敷金).*(return|返還|move.?out|退去)' },
      { field: 'residence_months', operator: 'lt', value: 12 },
    ],
    judgment: 'Short-tenancy deposit dispute — high friction scenario. Activate evidence system for documentation and bridge for language support.',
    action: 'activate_evidence_system',
    confidence: 0.90,
    evidenceSource: 'dispute resolution case history + deposit claim patterns',
    createdBy: 'human_expert',
    lastValidated: '2026-03-15',
    patentRelevant: true,
    patentMethod: 'scheme_b_evidence_confidence',
  },

  // JUDG-003: Query contains renewal + contract expiry within 90 days
  // → inject_friction_scenario (lease/renewal)
  {
    ruleId: 'JUDG-003',
    domain: 'staropenai',
    premises: [
      { field: 'query_text', operator: 'contains', value: 'renewal' },
      { field: 'contract_expiry_within_90_days', operator: 'eq', value: true },
    ],
    judgment: 'Tenant approaching contract renewal with active query — inject friction scenario to guide through renewal process proactively.',
    action: 'inject_friction_scenario',
    confidence: 0.80,
    evidenceSource: 'contract renewal timelines + tenant inquiry patterns',
    createdBy: 'human_expert',
    lastValidated: '2026-03-20',
    patentRelevant: true,
    patentMethod: 'scheme_a_friction_detection',
  },

  // JUDG-004: High risk level + low confidence band → escalate_to_human
  {
    ruleId: 'JUDG-004',
    domain: 'staropenai',
    premises: [
      { field: 'risk_level', operator: 'eq', value: 'high' },
      { field: 'confidence_band', operator: 'eq', value: 'low' },
    ],
    judgment: 'High-risk situation with low system confidence — escalate to human expert to avoid incorrect automated response.',
    action: 'escalate_to_human',
    confidence: 0.95,
    evidenceSource: 'escalation outcome tracking + error rate analysis',
    createdBy: 'human_expert',
    lastValidated: '2026-04-05',
    patentRelevant: false,
  },

  // JUDG-005: Query language != ja + query about phone call
  // → trigger_language_bridge
  {
    ruleId: 'JUDG-005',
    domain: 'staropenai',
    premises: [
      { field: 'query_language', operator: 'in', value: ['en', 'zh', 'ko', 'vi', 'ne'] },
      { field: 'query_text', operator: 'matches', value: '(phone|call|電話|denwa|通話)' },
    ],
    judgment: 'Non-Japanese speaker needs to make a phone call — activate language bridge to provide real-time interpretation support.',
    action: 'trigger_language_bridge',
    confidence: 0.88,
    evidenceSource: 'language barrier incident reports + call outcome data',
    createdBy: 'human_expert',
    lastValidated: '2026-03-25',
    patentRelevant: true,
    patentMethod: 'scheme_a_flang_bridge',
  },

  // JUDG-006: Query contains utility keywords + just moved (residence < 3 months)
  // → inject_friction_scenario (utilities/start_service)
  {
    ruleId: 'JUDG-006',
    domain: 'staropenai',
    premises: [
      { field: 'query_text', operator: 'matches', value: '(utilit|gas|electric|水道|ガス|電気|internet|wifi|ネット)' },
      { field: 'residence_months', operator: 'lt', value: 3 },
    ],
    judgment: 'Newly moved tenant asking about utilities — inject friction scenario for service activation guidance.',
    action: 'inject_friction_scenario',
    confidence: 0.82,
    evidenceSource: 'new tenant onboarding friction analysis',
    createdBy: 'human_expert',
    lastValidated: '2026-03-18',
    patentRelevant: true,
    patentMethod: 'scheme_a_friction_detection',
  },

  // JUDG-007: Repeated question (same topic 3+ times) → escalate_to_human
  {
    ruleId: 'JUDG-007',
    domain: 'staropenai',
    premises: [
      { field: 'repeat_count', operator: 'gte', value: 3 },
    ],
    judgment: 'User has asked about the same topic 3+ times — trust signal that automated answers are insufficient. Escalate to human for personalised resolution.',
    action: 'escalate_to_human',
    confidence: 0.87,
    evidenceSource: 'repeat-query correlation with satisfaction scores',
    createdBy: 'system_derived',
    lastValidated: '2026-04-02',
    patentRelevant: false,
  },

  // JUDG-008: Query contains legal/court keywords + high amount
  // → activate_evidence_system + escalate_to_human
  {
    ruleId: 'JUDG-008',
    domain: 'staropenai',
    premises: [
      { field: 'query_text', operator: 'matches', value: '(legal|lawyer|court|裁判|弁護士|訴訟|sue|lawsuit)' },
      { field: 'dispute_amount', operator: 'gt', value: 100000 },
    ],
    judgment: 'Legal-context query with significant dispute amount — activate evidence system for documentation and escalate to human specialist.',
    action: 'activate_evidence_system',
    confidence: 0.93,
    evidenceSource: 'legal escalation case outcomes + amount threshold analysis',
    createdBy: 'human_expert',
    lastValidated: '2026-04-08',
    patentRelevant: true,
    patentMethod: 'scheme_b_evidence_confidence',
  },

  // JUDG-009: First-time visitor + query about general process
  // → recommend_knowledge_card (reduce initiation friction)
  {
    ruleId: 'JUDG-009',
    domain: 'staropenai',
    premises: [
      { field: 'is_first_visit', operator: 'eq', value: true },
      { field: 'query_text', operator: 'matches', value: '(how to|process|手続き|流れ|step|what do i|どうすれば)' },
    ],
    judgment: 'First-time visitor asking about general process — serve a knowledge card to reduce initiation friction and orient the user.',
    action: 'recommend_knowledge_card',
    confidence: 0.78,
    evidenceSource: 'first-visit funnel analysis + knowledge card engagement rates',
    createdBy: 'human_expert',
    lastValidated: '2026-03-28',
    patentRelevant: true,
    patentMethod: 'scheme_a_friction_detection',
  },

  // JUDG-010: Landlord high cooperation + tenant clean history
  // → fast_track_approval
  {
    ruleId: 'JUDG-010',
    domain: 'staropenai',
    premises: [
      { field: 'landlord_cooperation_score', operator: 'gte', value: 0.8 },
      { field: 'tenant_history_clean', operator: 'eq', value: true },
    ],
    judgment: 'Landlord has high cooperation record and tenant has clean history — fast-track the approval to reduce unnecessary wait time.',
    action: 'fast_track_approval',
    confidence: 0.83,
    evidenceSource: 'landlord cooperation metrics + tenant history validation outcomes',
    createdBy: 'human_expert',
    lastValidated: '2026-04-10',
    patentRelevant: false,
  },
]

// ---------------------------------------------------------------------
// I/O: JSONL persistence (same pattern as tables.ts).
// ---------------------------------------------------------------------

const DATA_DIR =
  process.env.VERCEL === '1'
    ? '/tmp'
    : path.join(process.cwd(), '.data')

const TABLE = 'judgment_outcomes'

function ensureDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
  } catch (err) {
    console.error('[judgment/registry] ensureDir failed', err)
  }
}

function tableFilePath(): string {
  return path.join(DATA_DIR, `${TABLE}.jsonl`)
}

function appendRow<T>(row: T): void {
  ensureDir()
  try {
    fs.appendFileSync(tableFilePath(), JSON.stringify(row) + '\n', 'utf8')
  } catch (err) {
    console.error(`[judgment/registry] append ${TABLE} failed`, err)
  }
}

function readAll<T>(): T[] {
  try {
    const fp = tableFilePath()
    if (!fs.existsSync(fp)) return []
    const raw = fs.readFileSync(fp, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const rows: T[] = []
    for (const line of lines) {
      try {
        rows.push(JSON.parse(line) as T)
      } catch {
        // skip corrupt line
      }
    }
    return rows
  } catch (err) {
    console.error(`[judgment/registry] read ${TABLE} failed`, err)
    return []
  }
}

// ---------------------------------------------------------------------
// I/O wrappers.
// ---------------------------------------------------------------------

/**
 * Record a judgment evaluation outcome for the data loop.
 * I/O — writes to judgment_outcomes.jsonl.
 */
export function recordJudgmentOutcome(
  outcome: Omit<JudgmentOutcome, 'id' | 'timestamp'>,
): void {
  const full: JudgmentOutcome = {
    id: `jo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...outcome,
  }
  appendRow(full)
}

/**
 * Read all recorded judgment outcomes.
 * I/O — reads from judgment_outcomes.jsonl.
 */
export function listJudgmentOutcomes(): JudgmentOutcome[] {
  return readAll<JudgmentOutcome>()
}

/**
 * Aggregate judgment outcomes into summary statistics.
 * I/O — reads from judgment_outcomes.jsonl.
 */
export function getJudgmentStats(): {
  totalEvaluations: number
  successRate: number
  byRule: Record<string, { total: number; success: number }>
} {
  const outcomes = readAll<JudgmentOutcome>()

  const byRule: Record<string, { total: number; success: number }> = {}
  let successCount = 0

  for (const o of outcomes) {
    if (o.success) successCount++
    if (!byRule[o.ruleId]) {
      byRule[o.ruleId] = { total: 0, success: 0 }
    }
    byRule[o.ruleId].total++
    if (o.success) byRule[o.ruleId].success++
  }

  return {
    totalEvaluations: outcomes.length,
    successRate: outcomes.length > 0 ? successCount / outcomes.length : 0,
    byRule,
  }
}
