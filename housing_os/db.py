"""Data access layer for Foreigner Housing OS V2.0."""

from __future__ import annotations

import sqlite3
import os
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict

DB_PATH = os.environ.get("HOUSING_OS_DB", str(Path(__file__).parent.parent / "housing_os.db"))


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _uid() -> str:
    return str(uuid.uuid4())[:12]


def _now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def _json_dump(obj) -> str | None:
    if obj is None:
        return None
    return json.dumps(obj, ensure_ascii=False)


def _json_load(text: str | None):
    if text is None:
        return None
    return json.loads(text)


# ─── FAQ ─────────────────────────────────────────────────────

def get_faq(slug: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM faq_items WHERE faq_slug=?", (slug,)).fetchone()
        return dict(row) if row else None


def search_faq(query: str, limit: int = 5) -> list:
    import re
    words = [w for w in re.findall(r'[a-zA-Z\u3000-\u9fff]+', query.lower()) if len(w) >= 3]
    if not words:
        words = [query.lower().strip()]
    with get_conn() as conn:
        all_rows = conn.execute("""
            SELECT faq_slug, title, question, short_answer, content, category,
                   review_status, router_callable, risk_level, language
            FROM faq_items
            WHERE router_callable=1 AND review_status='approved'
        """).fetchall()
        scored = []
        for row in all_rows:
            r = dict(row)
            text = f"{r['title']} {r.get('question','')} {r['content']} {r['category']}".lower()
            hits = sum(1 for w in words if w in text)
            if hits > 0:
                scored.append((hits, r))
        scored.sort(key=lambda x: -x[0])
        return [r for _, r in scored[:limit]]


def get_faq_sources(slug: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT fsm.*, sr.source_name, sr.source_url, sr.freshness_policy, sr.last_verified_at
            FROM faq_source_mappings fsm
            JOIN source_registry sr ON sr.source_key=fsm.source_key
            WHERE fsm.faq_slug=? AND fsm.mapping_status='active'
        """, (slug,)).fetchall()
        return [dict(r) for r in rows]


# ─── RULES ───────────────────────────────────────────────────

def get_active_rules(category: str = None) -> list[dict]:
    with get_conn() as conn:
        if category:
            rows = conn.execute(
                "SELECT * FROM rules_catalog WHERE is_active=1 AND category=? ORDER BY rule_key",
                (category,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM rules_catalog WHERE is_active=1 ORDER BY rule_key"
            ).fetchall()
        return [dict(r) for r in rows]


def get_rule(key: str, version: int = None) -> dict | None:
    with get_conn() as conn:
        if version:
            row = conn.execute(
                "SELECT * FROM rules_catalog WHERE rule_key=? AND rule_version=?",
                (key, version)
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM rules_catalog WHERE rule_key=? AND is_active=1 ORDER BY rule_version DESC LIMIT 1",
                (key,)
            ).fetchone()
        return dict(row) if row else None


# ─── ROUTER DECISIONS ────────────────────────────────────────

def save_decision(decision: dict) -> str:
    did = decision.get("decision_id") or _uid()
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO router_decisions (
                decision_id, session_id, query_text, query_type, risk_level, confidence_band,
                selected_rule_keys, selected_rule_versions, selected_faq_slugs,
                missing_inputs, answer_mode, should_escalate, decision_reason,
                trace_tags, source_issue_flags, retrieval_count, source_count,
                source_conflict, source_stale
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            did,
            decision.get("session_id"),
            decision["query_text"],
            decision["query_type"],
            decision.get("risk_level", "low"),
            decision.get("confidence_band", "high"),
            _json_dump(decision.get("selected_rule_keys")),
            _json_dump(decision.get("selected_rule_versions")),
            _json_dump(decision.get("selected_faq_slugs")),
            _json_dump(decision.get("missing_inputs")),
            decision.get("answer_mode", "direct"),
            1 if decision.get("should_escalate") else 0,
            decision.get("decision_reason"),
            _json_dump(decision.get("trace_tags")),
            _json_dump(decision.get("source_issue_flags")),
            decision.get("retrieval_count"),
            decision.get("source_count"),
            1 if decision.get("source_conflict") else 0,
            1 if decision.get("source_stale") else 0,
        ))
    return did


def get_decision(decision_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM router_decisions WHERE decision_id=?", (decision_id,)
        ).fetchone()
        if not row:
            return None
        d = dict(row)
        for k in ("selected_rule_keys", "selected_rule_versions", "selected_faq_slugs",
                   "missing_inputs", "trace_tags", "source_issue_flags"):
            d[k] = _json_load(d.get(k))
        return d


# ─── ESCALATION ──────────────────────────────────────────────

VALID_TRANSITIONS = {
    "open":              {"assigned", "cancelled"},
    "assigned":          {"in_progress", "assigned", "cancelled"},
    "in_progress":       {"resolved", "assigned", "cancelled"},
    "resolved":          {"writeback_pending", "closed"},
    "writeback_pending": {"closed"},
    "closed":            set(),
    "cancelled":         set(),
}

EVENT_STATE_MAP = {
    "enqueue":           "open",
    "assigned":          "assigned",
    "in_progress":       "in_progress",
    "resolved":          "resolved",
    "writeback_created": "writeback_pending",
    "closed":            "closed",
    "cancelled":         "cancelled",
    "reassigned":        "assigned",
    "viewed":            None,
    "note_added":        None,
}


def _compute_sla(risk_level: str, priority_band: str) -> str:
    """SLA tiers: tier3 (15m) for critical/high-risk, tier2 (1h) for high priority, tier1 (4h) default."""
    if priority_band == "critical" or risk_level == "high":
        return "tier3"
    if priority_band == "high":
        return "tier2"
    return "tier1"


def create_escalation(decision_id: str, query_text: str, reason: str,
                       risk_level: str = "medium", confidence_band: str = "low",
                       priority_band: str = "normal", faq_slugs: list = None,
                       rule_keys: list = None, source_flags: list = None,
                       session_id: str = None) -> str:
    eid = _uid()
    sla = _compute_sla(risk_level, priority_band)
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO human_escalation_queue (
                escalation_id, decision_id, session_id, query_text, risk_level, confidence_band,
                escalation_reason, priority_band, sla_tier, selected_faq_slugs, selected_rule_keys,
                source_issue_flags, queue_status
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            eid, decision_id, session_id, query_text, risk_level, confidence_band,
            reason, priority_band, sla,
            _json_dump(faq_slugs), _json_dump(rule_keys), _json_dump(source_flags),
            "open",
        ))
        conn.execute("""
            INSERT INTO human_escalation_events (event_id, escalation_id, event_type, actor, actor_type, event_data)
            VALUES (?,?,?,?,?,?)
        """, (_uid(), eid, "enqueue", "router", "router", _json_dump({"decision_id": decision_id, "auto": True})))
    return eid


def transition_escalation(escalation_id: str, event_type: str, actor: str,
                           event_data: dict = None, resolution_type: str = None,
                           resolution_note: str = None) -> bool:
    new_status = EVENT_STATE_MAP.get(event_type)
    with get_conn() as conn:
        current = conn.execute(
            "SELECT queue_status FROM human_escalation_queue WHERE escalation_id=?",
            (escalation_id,)
        ).fetchone()
        if not current:
            raise ValueError(f"Escalation {escalation_id} not found")

        old_status = current["queue_status"]
        if new_status and new_status not in VALID_TRANSITIONS.get(old_status, set()):
            raise ValueError(f"Invalid transition: {old_status} -> {new_status} (event={event_type})")

        conn.execute("""
            INSERT INTO human_escalation_events (event_id, escalation_id, event_type, actor, event_data)
            VALUES (?,?,?,?,?)
        """, (_uid(), escalation_id, event_type, actor, _json_dump(event_data)))

        if new_status:
            updates = ["queue_status=?", "updated_at=?"]
            params = [new_status, _now()]
            if new_status == "resolved":
                updates += ["resolved_at=?", "resolution_type=?", "resolution_note=?"]
                params += [_now(), resolution_type, resolution_note]
            if new_status == "closed":
                updates.append("closed_at=?")
                params.append(_now())
            params.append(escalation_id)
            conn.execute(
                f"UPDATE human_escalation_queue SET {','.join(updates)} WHERE escalation_id=?",
                params
            )
    return True


def get_open_escalations() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT * FROM human_escalation_queue
            WHERE queue_status NOT IN ('closed','cancelled')
            ORDER BY
                CASE priority_band WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                     WHEN 'normal' THEN 2 ELSE 3 END,
                created_at
        """).fetchall()
        return [dict(r) for r in rows]


def get_escalation(escalation_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM human_escalation_queue WHERE escalation_id=?", (escalation_id,)
        ).fetchone()
        return dict(row) if row else None


def get_escalation_events(escalation_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM human_escalation_events WHERE escalation_id=? ORDER BY created_at",
            (escalation_id,)
        ).fetchall()
        return [dict(r) for r in rows]


# ─── WRITEBACK ───────────────────────────────────────────────

def create_writeback(escalation_id: str, target_type: str, target_key: str,
                      candidate_data: dict) -> str:
    wid = _uid()
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO writeback_candidates (
                writeback_id, escalation_id, target_type, target_key, candidate_data, status
            ) VALUES (?,?,?,?,?,?)
        """, (wid, escalation_id, target_type, target_key, _json_dump(candidate_data), "pending"))

        conn.execute("""
            INSERT INTO human_escalation_events (event_id, escalation_id, event_type, actor, event_data)
            VALUES (?,?,?,?,?)
        """, (_uid(), escalation_id, "writeback_created", "system",
              _json_dump({"writeback_id": wid, "target_type": target_type, "target_key": target_key})))

        conn.execute("""
            UPDATE human_escalation_queue SET queue_status='writeback_pending', updated_at=?
            WHERE escalation_id=? AND queue_status='resolved'
        """, (_now(), escalation_id))
    return wid


def apply_writeback(writeback_id: str, approved_by: str) -> bool:
    with get_conn() as conn:
        wb = conn.execute(
            "SELECT * FROM writeback_candidates WHERE writeback_id=?", (writeback_id,)
        ).fetchone()
        if not wb or wb["status"] != "pending":
            return False

        target_type = wb["target_type"]
        target_key = wb["target_key"]
        data = json.loads(wb["candidate_data"])

        if target_type == "faq_update" and target_key:
            if data.get("action") == "append":
                conn.execute("""
                    UPDATE faq_items SET content = content || char(10) || char(10) || ?,
                        content_version = content_version + 1, updated_at=?
                    WHERE faq_slug=?
                """, (data["text"], _now(), target_key))
            elif data.get("field") == "content" and data.get("text"):
                conn.execute("""
                    UPDATE faq_items SET content=?, content_version=content_version+1, updated_at=?
                    WHERE faq_slug=?
                """, (data["text"], _now(), target_key))

        elif target_type == "faq_create" and data.get("faq_slug"):
            conn.execute("""
                INSERT INTO faq_items (faq_slug, title, content, category, review_status)
                VALUES (?,?,?,?,'draft')
            """, (data["faq_slug"], data.get("title", ""), data.get("content", ""),
                  data.get("category")))

        elif target_type == "regression_case" and data.get("case_key"):
            conn.execute("""
                INSERT OR REPLACE INTO regression_cases (
                    case_key, query_text, expected_query_type, expected_answer_mode,
                    expected_should_escalate, risk_level, source_origin, source_reference
                ) VALUES (?,?,?,?,?,?,?,?)
            """, (
                data["case_key"], data.get("query_text", ""),
                data.get("expected_query_type", "faq"),
                data.get("expected_answer_mode"),
                data.get("expected_should_escalate"),
                data.get("risk_level", "low"),
                "escalation_resolution", wb["escalation_id"],
            ))

        conn.execute("""
            UPDATE writeback_candidates SET status='applied', approved_by=?, applied_at=?, updated_at=?
            WHERE writeback_id=?
        """, (approved_by, _now(), _now(), writeback_id))
    return True


def get_pending_writebacks() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT wc.*, hq.query_text AS esc_query, hq.resolution_note
            FROM writeback_candidates wc
            JOIN human_escalation_queue hq ON hq.escalation_id=wc.escalation_id
            WHERE wc.status='pending'
            ORDER BY wc.created_at
        """).fetchall()
        return [dict(r) for r in rows]


# ─── REGRESSION ──────────────────────────────────────────────

def get_active_regression_cases() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM regression_cases WHERE is_active=1 ORDER BY case_key"
        ).fetchall()
        return [dict(r) for r in rows]


def save_regression_run(run_id: str, case_key: str, result: dict) -> None:
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO regression_runs (
                run_id, case_key, actual_decision_id, actual_query_type,
                actual_rule_keys, actual_faq_slugs, actual_confidence,
                actual_answer_mode, actual_should_escalate, pass_fail, failure_details
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(run_id, case_key) DO UPDATE SET
                pass_fail=excluded.pass_fail, failure_details=excluded.failure_details
        """, (
            run_id, case_key,
            result.get("decision_id"),
            result.get("query_type"),
            _json_dump(result.get("rule_keys")),
            _json_dump(result.get("faq_slugs")),
            result.get("confidence"),
            result.get("answer_mode"),
            result.get("should_escalate"),
            result.get("pass_fail", "pending"),
            result.get("failure_details"),
        ))


# ─── VALIDATION ──────────────────────────────────────────────

def run_validation() -> dict:
    results = {}
    with get_conn() as conn:
        for view_name in (
            "v_faq_incomplete", "v_stale_mappings", "v_low_confidence_violations",
            "v_escalation_state_violations", "v_orphan_events",
            "v_writeback_traceability", "v_regression_coverage", "v_rule_integrity",
        ):
            rows = conn.execute(f"SELECT * FROM {view_name}").fetchall()
            results[view_name] = [dict(r) for r in rows]
    return results


def get_stats() -> dict:
    with get_conn() as conn:
        return {
            "faq_items": conn.execute("SELECT COUNT(*) FROM faq_items").fetchone()[0],
            "faq_approved": conn.execute("SELECT COUNT(*) FROM faq_items WHERE review_status='approved'").fetchone()[0],
            "sources": conn.execute("SELECT COUNT(*) FROM source_registry WHERE is_active=1").fetchone()[0],
            "rules": conn.execute("SELECT COUNT(*) FROM rules_catalog WHERE is_active=1").fetchone()[0],
            "decisions": conn.execute("SELECT COUNT(*) FROM router_decisions").fetchone()[0],
            "escalations_open": conn.execute("SELECT COUNT(*) FROM human_escalation_queue WHERE queue_status NOT IN ('closed','cancelled')").fetchone()[0],
            "escalations_total": conn.execute("SELECT COUNT(*) FROM human_escalation_queue").fetchone()[0],
            "regression_cases": conn.execute("SELECT COUNT(*) FROM regression_cases WHERE is_active=1").fetchone()[0],
            "writeback_pending": conn.execute("SELECT COUNT(*) FROM writeback_candidates WHERE status='pending'").fetchone()[0],
            "consultations": conn.execute("SELECT COUNT(*) FROM consultation_records").fetchone()[0],
            "consultations_pending": conn.execute("SELECT COUNT(*) FROM consultation_records WHERE ingested_to_faq=0 OR ingested_to_regression=0").fetchone()[0],
            "user_tasks": conn.execute("SELECT COUNT(*) FROM user_task_state").fetchone()[0],
        }


# ─── USER TASK STATE (Layer 3) ──────────────────────────────

def create_user_task(session_id: str, language: str = "en") -> dict:
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO user_task_state (session_id, language_pref, current_stage)
            VALUES (?,?,?)
            ON CONFLICT(session_id) DO UPDATE SET updated_at=datetime('now')
        """, (session_id, language, "initial"))
        row = conn.execute(
            "SELECT * FROM user_task_state WHERE session_id=?", (session_id,)
        ).fetchone()
        return dict(row)


def get_user_task(session_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM user_task_state WHERE session_id=?", (session_id,)
        ).fetchone()
        return dict(row) if row else None


def update_user_task(session_id: str, updates: dict) -> dict | None:
    allowed_fields = {
        "current_stage", "language_pref", "visa_status", "budget_range",
        "target_area", "commute_target", "move_in_date", "guarantor_status",
        "jp_language_level", "employment_status", "current_blocker",
        "current_answer_mode", "requires_human", "decision_ids",
    }
    filtered = {k: v for k, v in updates.items() if k in allowed_fields}
    if not filtered:
        return get_user_task(session_id)
    set_clause = ", ".join(f"{k}=?" for k in filtered)
    params = list(filtered.values()) + [_now(), session_id]
    with get_conn() as conn:
        conn.execute(
            f"UPDATE user_task_state SET {set_clause}, updated_at=? WHERE session_id=?",
            params,
        )
        row = conn.execute(
            "SELECT * FROM user_task_state WHERE session_id=?", (session_id,)
        ).fetchone()
        return dict(row) if row else None


# ─── CONSULTATION RECORDS ───────────────────────────────────

def get_consultation_records(limit: int = 50, pending_only: bool = False) -> list[dict]:
    with get_conn() as conn:
        if pending_only:
            rows = conn.execute("""
                SELECT * FROM consultation_records
                WHERE ingested_to_faq=0 OR ingested_to_regression=0
                ORDER BY created_at DESC LIMIT ?
            """, (limit,)).fetchall()
        else:
            rows = conn.execute("""
                SELECT * FROM consultation_records ORDER BY created_at DESC LIMIT ?
            """, (limit,)).fetchall()
        return [dict(r) for r in rows]


def get_consultation_record(record_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM consultation_records WHERE record_id=?", (record_id,)
        ).fetchone()
        return dict(row) if row else None
