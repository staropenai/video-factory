"""
HTTP API server for Foreigner Housing OS V2.0.

Bridges the housing_os Python backend to the Next.js frontend.
Zero external dependencies — uses stdlib http.server + json.

Endpoints:
  GET  /api/faq                       — list all approved FAQ items
  GET  /api/faq/:slug                 — get single FAQ with sources
  GET  /api/rules                     — list active rules
  GET  /api/sources                   — list active sources
  POST /api/session                   — create a new session + user_task_state
  GET  /api/session/:id               — get session state
  PUT  /api/session/:id               — update session state
  POST /api/route                     — route a query through the decision engine
  GET  /api/decisions/:id             — get a specific decision
  POST /api/escalation                — create escalation from form submission
  GET  /api/escalation                — list open escalations
  GET  /api/escalation/:id            — get escalation with events
  POST /api/escalation/:id/transition — transition escalation state
  GET  /api/consultations             — list consultation records
  GET  /api/consultations/:id         — get single consultation record
  GET  /api/stats                     — system stats
  GET  /api/validation                — run validation views
  GET  /api/health                    — health check

Run:
  python -m housing_os.api          # starts on port 8001
  HOUSING_OS_PORT=8001 python -m housing_os.api
"""

import json
import os
import sys
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime

# Ensure housing_os is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from housing_os import db
from housing_os.router import route

PORT = int(os.environ.get("HOUSING_OS_PORT", "8001"))

# In-memory session store
# [DEFAULT ASSUMPTION] V1 uses in-memory sessions. Production would use DB.
_sessions: dict[str, dict] = {}


def _json_response(handler: "APIHandler", data: dict, status: int = 200):
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode("utf-8"))


def _read_body(handler: "APIHandler") -> dict:
    length = int(handler.headers.get("Content-Length", 0))
    if length == 0:
        return {}
    raw = handler.rfile.read(length)
    return json.loads(raw.decode("utf-8"))


def _error(handler: "APIHandler", message: str, status: int = 400):
    _json_response(handler, {"error": message}, status)


class APIHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        qs = parse_qs(parsed.query)

        try:
            # Health check
            if path == "/api/health":
                _json_response(self, {"status": "ok", "timestamp": datetime.utcnow().isoformat()})

            # FAQ list
            elif path == "/api/faq":
                query = qs.get("q", [None])[0]
                if query:
                    items = db.search_faq(query, limit=10)
                else:
                    conn = db.get_conn()
                    rows = conn.execute(
                        "SELECT * FROM faq_items WHERE review_status='approved' ORDER BY category, faq_slug"
                    ).fetchall()
                    items = [dict(r) for r in rows]
                    conn.close()
                _json_response(self, {"items": items, "count": len(items)})

            # FAQ detail
            elif path.startswith("/api/faq/"):
                slug = path.split("/api/faq/")[1]
                faq = db.get_faq(slug)
                if not faq:
                    _error(self, f"FAQ not found: {slug}", 404)
                    return
                sources = db.get_faq_sources(slug)
                faq["sources"] = sources
                _json_response(self, faq)

            # Rules list
            elif path == "/api/rules":
                category = qs.get("category", [None])[0]
                rules = db.get_active_rules(category)
                _json_response(self, {"items": rules, "count": len(rules)})

            # Sources list
            elif path == "/api/sources":
                conn = db.get_conn()
                rows = conn.execute(
                    "SELECT * FROM source_registry WHERE is_active=1 ORDER BY source_key"
                ).fetchall()
                conn.close()
                _json_response(self, {"items": [dict(r) for r in rows], "count": len(rows)})

            # Session read
            elif path.startswith("/api/session/"):
                sid = path.split("/api/session/")[1]
                session = _sessions.get(sid)
                if not session:
                    _error(self, f"Session not found: {sid}", 404)
                    return
                _json_response(self, session)

            # Decision detail
            elif path.startswith("/api/decisions/"):
                did = path.split("/api/decisions/")[1]
                decision = db.get_decision(did)
                if not decision:
                    _error(self, f"Decision not found: {did}", 404)
                    return
                _json_response(self, decision)

            # Escalation list
            elif path == "/api/escalation":
                items = db.get_open_escalations()
                _json_response(self, {"items": items, "count": len(items)})

            # Escalation detail
            elif path.startswith("/api/escalation/") and "/transition" not in path:
                eid = path.split("/api/escalation/")[1]
                esc = db.get_escalation(eid)
                if not esc:
                    _error(self, f"Escalation not found: {eid}", 404)
                    return
                events = db.get_escalation_events(eid)
                esc["events"] = events
                _json_response(self, esc)

            # Consultation records list
            elif path == "/api/consultations":
                pending = qs.get("pending", ["0"])[0] == "1"
                items = db.get_consultation_records(limit=100, pending_only=pending)
                _json_response(self, {"items": items, "count": len(items)})

            # Consultation record detail
            elif path.startswith("/api/consultations/"):
                rid = path.split("/api/consultations/")[1]
                rec = db.get_consultation_record(rid)
                if not rec:
                    _error(self, f"Consultation record not found: {rid}", 404)
                    return
                _json_response(self, rec)

            # User task state
            elif path.startswith("/api/task/"):
                sid = path.split("/api/task/")[1]
                task = db.get_user_task(sid)
                if not task:
                    _error(self, f"Task state not found: {sid}", 404)
                    return
                _json_response(self, task)

            # Stats
            elif path == "/api/stats":
                stats = db.get_stats()
                _json_response(self, stats)

            # Validation
            elif path == "/api/validation":
                results = db.run_validation()
                summary = {}
                for view_name, rows in results.items():
                    summary[view_name] = {"count": len(rows), "rows": rows}
                _json_response(self, {"views": summary})

            else:
                _error(self, f"Not found: {path}", 404)

        except Exception as e:
            _error(self, str(e), 500)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        try:
            body = _read_body(self)

            # Create session
            if path == "/api/session":
                sid = str(uuid.uuid4())[:12]
                locale = body.get("locale", "en")
                session = {
                    "session_id": sid,
                    "locale": locale,
                    "intake": {},
                    "decisions": [],
                    "stage": "initial",
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                }
                _sessions[sid] = session
                # Also create DB-backed user_task_state
                try:
                    db.create_user_task(sid, locale)
                except Exception:
                    pass  # Non-blocking — session still works in-memory
                _json_response(self, session, 201)

            # Route a query
            elif path == "/api/route":
                query_text = body.get("query_text")
                if not query_text:
                    _error(self, "query_text is required")
                    return
                context = body.get("context", {})
                session_id = body.get("session_id")

                decision = route(query_text, context, session_id=session_id)

                # Link to session if provided
                if session_id and session_id in _sessions:
                    _sessions[session_id]["decisions"].append(decision["decision_id"])
                    _sessions[session_id]["updated_at"] = datetime.utcnow().isoformat()
                    # Also update user_task_state
                    try:
                        task = db.get_user_task(session_id)
                        if task:
                            existing = json.loads(task.get("decision_ids") or "[]")
                            existing.append(decision["decision_id"])
                            db.update_user_task(session_id, {"decision_ids": json.dumps(existing)})
                    except Exception:
                        pass

                _json_response(self, decision, 201)

            # Create escalation
            elif path == "/api/escalation":
                required = ["query_text", "reason"]
                for field in required:
                    if not body.get(field):
                        _error(self, f"{field} is required")
                        return

                # Route the query first to get a decision_id
                decision = route(body["query_text"], {
                    "risk_level": body.get("risk_level", "medium"),
                    "source_conflict": body.get("source_conflict", False),
                })

                eid = db.create_escalation(
                    decision_id=decision["decision_id"],
                    query_text=body["query_text"],
                    reason=body["reason"],
                    risk_level=body.get("risk_level", "medium"),
                    confidence_band=body.get("confidence_band", "low"),
                    priority_band=body.get("priority_band", "normal"),
                    faq_slugs=body.get("faq_slugs"),
                    rule_keys=body.get("rule_keys"),
                    source_flags=body.get("source_flags"),
                )

                # Record contact info as event data
                contact_data = {}
                if body.get("email"):
                    contact_data["email"] = body["email"]
                if body.get("language"):
                    contact_data["preferred_language"] = body["language"]
                if body.get("session_id"):
                    contact_data["session_id"] = body["session_id"]

                if contact_data:
                    db.transition_escalation(
                        eid, "note_added", "system",
                        event_data={"contact_info": contact_data}
                    )

                # [DEFAULT ASSUMPTION] Email notification is logged but not sent in V1.
                # Production would integrate with SendGrid/Resend/SES here.
                email_status = "not_configured"
                if body.get("email"):
                    email_status = "logged_not_sent"

                esc = db.get_escalation(eid)
                _json_response(self, {
                    "escalation_id": eid,
                    "decision_id": decision["decision_id"],
                    "queue_status": esc["queue_status"] if esc else "open",
                    "email_notification": email_status,
                    "message": "Escalation created. A consultant will review your case.",
                }, 201)

            # Transition escalation
            elif path.startswith("/api/escalation/") and path.endswith("/transition"):
                eid = path.split("/api/escalation/")[1].split("/transition")[0]
                event_type = body.get("event_type")
                actor = body.get("actor", "system")
                if not event_type:
                    _error(self, "event_type is required")
                    return

                db.transition_escalation(
                    eid, event_type, actor,
                    event_data=body.get("event_data"),
                    resolution_type=body.get("resolution_type"),
                    resolution_note=body.get("resolution_note"),
                )
                esc = db.get_escalation(eid)
                _json_response(self, esc)

            else:
                _error(self, f"Not found: {path}", 404)

        except ValueError as e:
            _error(self, str(e), 400)
        except Exception as e:
            _error(self, str(e), 500)

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        try:
            body = _read_body(self)

            # Update session
            if path.startswith("/api/session/"):
                sid = path.split("/api/session/")[1]
                if sid not in _sessions:
                    _error(self, f"Session not found: {sid}", 404)
                    return
                session = _sessions[sid]
                if "intake" in body:
                    session["intake"].update(body["intake"])
                if "stage" in body:
                    session["stage"] = body["stage"]
                if "locale" in body:
                    session["locale"] = body["locale"]
                session["updated_at"] = datetime.utcnow().isoformat()
                # Sync intake to user_task_state
                try:
                    task_updates = {}
                    intake = session.get("intake", {})
                    if intake.get("visa"):
                        task_updates["visa_status"] = intake["visa"]
                    if intake.get("budget"):
                        task_updates["budget_range"] = intake["budget"]
                    if intake.get("employment"):
                        task_updates["employment_status"] = intake["employment"]
                    if intake.get("guarantor"):
                        gmap = {"yes": "has_japanese_guarantor", "no": "needs_company", "unknown": "unknown"}
                        task_updates["guarantor_status"] = gmap.get(intake["guarantor"], "unknown")
                    if "stage" in body:
                        task_updates["current_stage"] = body["stage"]
                    if "locale" in body:
                        task_updates["language_pref"] = body["locale"]
                    if task_updates:
                        db.update_user_task(sid, task_updates)
                except Exception:
                    pass  # Non-blocking
                _json_response(self, session)

            else:
                _error(self, f"Not found: {path}", 404)

        except Exception as e:
            _error(self, str(e), 500)

    def log_message(self, format, *args):
        # Quieter logging
        sys.stderr.write(f"[API] {args[0]}\n")


def main():
    # Ensure DB is initialized
    if not os.path.exists(db.DB_PATH):
        print(f"Database not found at {db.DB_PATH}. Run: python init_db.py")
        sys.exit(1)

    server = HTTPServer(("0.0.0.0", PORT), APIHandler)
    print(f"Housing OS API server running on http://localhost:{PORT}")
    print(f"Database: {db.DB_PATH}")
    print(f"Endpoints: /api/health, /api/faq, /api/rules, /api/route, /api/escalation, /api/stats")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
