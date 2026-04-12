"""
Router module — the decision brain of V1.4.

Implements: query classification, rule matching, FAQ lookup,
low-confidence policy enforcement, and structured decision emission.

Every call to route() produces exactly one router_decisions record.
"""

import json
from housing_os import db


# ─── LOW-CONFIDENCE POLICY ───────────────────────────────────
# V1.4 Section 11.1: Any ONE of these triggers = low confidence.
# Each trigger specifies: detection, resulting answer_mode,
# should_escalate, trace_tag, and whether to auto-queue.

LOW_CONFIDENCE_TRIGGERS = [
    {
        "name": "low_retrieval",
        "check": lambda ctx: ctx.get("retrieval_count", 0) < 2,
        "answer_mode": "clarify",
        "should_escalate": False,
        "trace_tag": "low_retrieval",
        "auto_queue": False,
    },
    {
        "name": "low_source_count",
        "check": lambda ctx: ctx.get("source_count", 0) < 2,
        "answer_mode": "official_only",
        "should_escalate": False,
        "trace_tag": "insufficient_source",
        "auto_queue": False,
    },
    {
        "name": "source_conflict",
        "check": lambda ctx: ctx.get("source_conflict", False),
        "answer_mode": "clarify",
        "should_escalate": True,
        "trace_tag": "source_conflict",
        "auto_queue": True,
    },
    {
        "name": "source_stale",
        "check": lambda ctx: ctx.get("source_stale", False),
        "answer_mode": "official_only",
        "should_escalate": False,
        "trace_tag": "stale_source",
        "auto_queue": False,
    },
    {
        "name": "dynamic_no_refresh",
        "check": lambda ctx: ctx.get("query_type") == "dynamic" and not ctx.get("dynamic_refresh_ts"),
        "answer_mode": "handoff",
        "should_escalate": True,
        "trace_tag": "dynamic_blocked",
        "auto_queue": True,
    },
    {
        "name": "high_risk_case_specific",
        "check": lambda ctx: ctx.get("risk_level") == "high" and ctx.get("query_type") == "case_specific",
        "answer_mode": "handoff",
        "should_escalate": True,
        "trace_tag": "high_risk_case_specific",
        "auto_queue": True,
    },
]


def _classify_query_type(query: str) -> str:
    """[Default Assumption] Simple keyword-based classifier. Replace with ML in Phase 2."""
    q = query.lower()
    cost_words = ["cost", "price", "fee", "how much", "budget", "calculate", "estimate",
                  "初期費用", "費用", "家賃", "money", "yen", "円"]
    if any(w in q for w in cost_words):
        return "formula"

    checklist_words = ["document", "checklist", "what do i need", "requirements", "papers",
                       "材料", "書類"]
    if any(w in q for w in checklist_words):
        return "checklist"

    dynamic_words = ["available", "right now", "current", "today", "this week", "listing",
                     "空き", "物件"]
    if any(w in q for w in dynamic_words):
        return "dynamic"

    legal_words = ["sued", "lawyer", "court", "dispute", "illegal", "rights", "violation",
                   "裁判", "弁護士", "unfair", "refusing"]
    action_words = ["visit a property", "view a property", "see a property", "see apartment",
                    "schedule a viewing", "schedule viewing", "appointment",
                    "want to see", "want to visit", "看房", "内見"]
    if any(w in q for w in legal_words + action_words):
        return "case_specific"

    scope_words = ["recipe", "weather forecast", "stock market", "poem", "haiku",
                   "song", "movie review", "restaurant", "programming", "write me",
                   "tell me a joke", "translate this poem"]
    if any(w in q for w in scope_words):
        return "out_of_scope"

    return "faq"


def _assess_risk(query: str, query_type: str) -> str:
    """[Default Assumption] Simple risk assessment. Refine with real data."""
    q = query.lower()
    if query_type == "out_of_scope":
        return "low"
    high_risk = ["legal", "sue", "court", "dispute", "contract clause", "unfair",
                 "buy", "purchase", "invest", "mortgage", "loan"]
    if any(w in q for w in high_risk):
        return "high"
    medium_risk = ["renewal", "move out", "deposit", "damage", "guarantor deny"]
    if any(w in q for w in medium_risk):
        return "medium"
    return "low"


def _match_rules(query: str, query_type: str, context: dict = None) -> list[dict]:
    """Find applicable rules for this query. Safety rules only fire on actual conditions."""
    context = context or {}
    rules = db.get_active_rules()
    matched = []
    q = query.lower()
    for r in rules:
        rk = r["rule_key"]
        if query_type == "formula" and r["category"] == "cost":
            matched.append(r)
        elif query_type == "checklist" and r["category"] == "checklist":
            matched.append(r)
        elif r["category"] == "escalation":
            if rk == "viewing-escalation" and any(w in q for w in ["view", "visit", "see apartment", "schedule", "property"]):
                matched.append(r)
            elif rk == "contract-legal-escalate" and any(w in q for w in ["legal", "sue", "dispute", "court", "lawyer", "rights", "unfair"]):
                matched.append(r)
        elif r["category"] == "safety":
            # Safety rules only match when their specific condition holds
            if rk == "source-conflict-block" and context.get("source_conflict"):
                matched.append(r)
            elif rk == "stale-source-block" and context.get("source_stale"):
                matched.append(r)
            elif rk == "high-risk-case-block" and context.get("risk_level") == "high" and query_type == "case_specific":
                matched.append(r)
    return matched


def _match_faq(query: str) -> list[dict]:
    """Find matching FAQ items."""
    return db.search_faq(query, limit=5)


def _compute_missing_inputs(query: str, rules: list[dict]) -> list[str]:
    """Determine what required inputs are not yet provided."""
    missing = set()
    q = query.lower()
    for r in rules:
        required = json.loads(r.get("required_inputs") or "[]")
        for inp in required:
            if inp == "monthly_rent" and not any(c.isdigit() for c in q):
                missing.add(inp)
            elif inp == "employment_status" and not any(w in q for w in ["employed", "student", "self-employed", "freelance"]):
                missing.add(inp)
            elif inp == "budget" and "budget" not in q and not any(w in q for w in ["million", "万"]):
                missing.add(inp)
    return sorted(missing)


def route(query: str, context: dict = None, session_id: str = None) -> dict:
    """
    Main router entry point. Produces a structured decision record.

    Args:
        query: User's question text
        context: Optional dict with pre-computed fields (source_conflict, etc.)
        session_id: Optional session for traceability

    Returns:
        Complete decision dict (also persisted to router_decisions)
    """
    context = context or {}

    query_type = context.get("query_type") or _classify_query_type(query)
    risk_level = context.get("risk_level") or _assess_risk(query, query_type)

    matched_faq = _match_faq(query)
    missing_inputs_pre = []  # computed after rules

    # Build routing context for low-confidence evaluation (need source info first)
    preliminary_ctx = {
        "query_type": query_type,
        "risk_level": risk_level,
        "source_conflict": context.get("source_conflict", False),
        "source_stale": context.get("source_stale", False),
    }
    matched_rules = _match_rules(query, query_type, preliminary_ctx)
    missing_inputs = _compute_missing_inputs(query, matched_rules)

    # Build routing context for low-confidence evaluation
    retrieval_count = context.get("retrieval_count", len(matched_faq))
    source_count = context.get("source_count", 0)
    if matched_faq:
        all_sources = set()
        for faq in matched_faq:
            sources = db.get_faq_sources(faq["faq_slug"])
            reviewed = [s for s in sources if s["review_status"] == "reviewed"]
            all_sources.update(s["source_key"] for s in reviewed)
        source_count = max(source_count, len(all_sources))

    route_ctx = {
        "query_type": query_type,
        "risk_level": risk_level,
        "retrieval_count": retrieval_count,
        "source_count": source_count,
        "source_conflict": context.get("source_conflict", False),
        "source_stale": context.get("source_stale", False),
        "dynamic_refresh_ts": context.get("dynamic_refresh_ts"),
    }

    # Evaluate low-confidence triggers
    triggered = []
    for trigger in LOW_CONFIDENCE_TRIGGERS:
        if trigger["check"](route_ctx):
            triggered.append(trigger)

    # Determine confidence band
    if triggered:
        confidence_band = "low"
    elif source_count >= 2 and retrieval_count >= 2:
        confidence_band = "high"
    else:
        confidence_band = "medium"

    # Determine answer_mode and escalation
    should_escalate = False
    answer_mode = "direct"
    trace_tags = []
    auto_queue = False

    if query_type == "out_of_scope":
        answer_mode = "direct"
        trace_tags.append("out_of_scope")
    elif triggered:
        # Use the most restrictive trigger
        mode_priority = {"handoff": 0, "official_only": 1, "clarify": 2, "direct": 3}
        best_trigger = min(triggered, key=lambda t: mode_priority.get(t["answer_mode"], 3))
        answer_mode = best_trigger["answer_mode"]
        should_escalate = any(t["should_escalate"] for t in triggered)
        auto_queue = any(t.get("auto_queue") for t in triggered)
        trace_tags.extend(t["trace_tag"] for t in triggered)
    elif missing_inputs:
        answer_mode = "clarify"
        trace_tags.append("missing_inputs")
    elif matched_rules:
        # Rules exist — prefer rule execution over free generation
        safety_rules = [r for r in matched_rules if r["category"] == "safety"]
        for sr in safety_rules:
            body = sr["rule_body"].lower()
            if "should_escalate=1" in body:
                should_escalate = True
                answer_mode = "handoff"
        escalation_rules = [r for r in matched_rules if r["category"] == "escalation"]
        for er in escalation_rules:
            body = er["rule_body"].lower()
            if "should_escalate=1" in body:
                should_escalate = True
                answer_mode = "handoff"
        if should_escalate:
            trace_tags.append("rule_escalation")
            auto_queue = True
        else:
            answer_mode = "direct"
            trace_tags.append("rule_hit")
    elif matched_faq:
        answer_mode = "direct"
        trace_tags.append("faq_hit")

    if not trace_tags:
        trace_tags.append("no_match")

    # Filter rules: only non-safety operational rules for the response
    operational_rules = [r for r in matched_rules if r["category"] not in ("safety",)]

    rule_keys = [r["rule_key"] for r in operational_rules] or None
    rule_versions = [r["rule_version"] for r in operational_rules] or None
    faq_slugs = [f["faq_slug"] for f in matched_faq] or None
    source_flags = []
    if context.get("source_conflict"):
        source_flags.append("source_conflict")
    if context.get("source_stale"):
        source_flags.append("stale_source")
    if source_count < 2:
        source_flags.append("insufficient_source")

    decision = {
        "session_id": session_id,
        "query_text": query,
        "query_type": query_type,
        "risk_level": risk_level,
        "confidence_band": confidence_band,
        "selected_rule_keys": rule_keys,
        "selected_rule_versions": rule_versions,
        "selected_faq_slugs": faq_slugs,
        "missing_inputs": missing_inputs or None,
        "answer_mode": answer_mode,
        "should_escalate": should_escalate,
        "decision_reason": _build_reason(query_type, matched_rules, matched_faq, triggered, missing_inputs),
        "trace_tags": trace_tags,
        "source_issue_flags": source_flags or None,
        "retrieval_count": retrieval_count,
        "source_count": source_count,
        "source_conflict": context.get("source_conflict", False),
        "source_stale": context.get("source_stale", False),
    }

    decision_id = db.save_decision(decision)
    decision["decision_id"] = decision_id

    # Auto-queue escalation if triggered
    if should_escalate and auto_queue:
        esc_id = db.create_escalation(
            decision_id=decision_id,
            query_text=query,
            reason=decision["decision_reason"],
            risk_level=risk_level,
            confidence_band=confidence_band,
            priority_band=_compute_priority(risk_level, confidence_band),
            faq_slugs=faq_slugs,
            rule_keys=rule_keys,
            source_flags=source_flags or None,
        )
        decision["escalation_id"] = esc_id

    return decision


def _build_reason(query_type, rules, faqs, triggers, missing) -> str:
    parts = []
    if triggers:
        parts.append(f"Low-confidence triggers: {', '.join(t['name'] for t in triggers)}")
    if rules:
        parts.append(f"Rules matched: {', '.join(r['rule_key'] for r in rules)}")
    if faqs:
        parts.append(f"FAQ matched: {', '.join(f['faq_slug'] for f in faqs)}")
    if missing:
        parts.append(f"Missing inputs: {', '.join(missing)}")
    if query_type == "out_of_scope":
        parts.append("Query outside housing domain")
    return "; ".join(parts) if parts else "No specific match"


def _compute_priority(risk_level: str, confidence_band: str) -> str:
    if risk_level == "high" and confidence_band == "low":
        return "critical"
    if risk_level == "high" or confidence_band == "low":
        return "high"
    return "normal"
