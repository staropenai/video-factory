/**
 * Domain types — generic site foundation.
 *
 * Structural patterns preserved from old site.
 * Housing-specific enums and fields removed.
 * TBD_ placeholders for new domain values.
 */

// ─── CONTENT ─────────────────────────────────────

export type Locale = "en" | "zh" | "ja";

export type RiskLevel = "low" | "medium" | "high";

export type ReviewStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "stale"
  | "deprecated";

export type SourceType =
  | "official_government"
  | "official_provider"
  | "internal_experience"
  | "legal_reference"
  | "community_verified";

// ─── ROUTER / DECISION TYPES ──────────────────────────────

export type QueryType =
  | "faq"
  | "formula"
  | "checklist"
  | "dynamic"
  | "case_specific"
  | "out_of_scope";

export type ConfidenceBand = "high" | "medium" | "low";

export type AnswerMode =
  | "direct"
  | "clarify"
  | "official_only"
  | "handoff";

export interface RouterDecision {
  decision_id: string;
  query_text: string;
  query_type: QueryType;
  risk_level: RiskLevel;
  confidence_band: ConfidenceBand;
  selected_faq_slugs: string[];
  selected_rule_keys: string[];
  missing_inputs: string[];
  answer_mode: AnswerMode;
  should_escalate: boolean;
  decision_reason: string;
  trace_tags: string[];
}

// ─── ESCALATION ──────────────────────────────────

export type EscalationPolicy =
  | "auto_answer"
  | "answer_with_disclaimer"
  | "suggest_expert"
  | "require_expert";

export type EscalationStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed";

// ─── REVIEW ──────────────────────────────────────

export type ReviewCheckType =
  | "source_consistency"
  | "rule_conflict"
  | "multilingual_consistency"
  | "template_completeness"
  | "regression_pass";

export interface ReviewResult {
  check_type: ReviewCheckType;
  passed: boolean;
  details: string;
  affected_items: string[];
  timestamp: string;
}
