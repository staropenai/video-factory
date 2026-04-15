#!/usr/bin/env python3
"""
CLI for Foreigner Housing OS V1.4.

Usage:
    python -m housing_os.cli status          Show system stats
    python -m housing_os.cli route "query"   Route a query through the system
    python -m housing_os.cli queue           Show open escalation queue
    python -m housing_os.cli writeback       Show pending writebacks
    python -m housing_os.cli regression      Run regression suite
    python -m housing_os.cli validate        Run all validation views
    python -m housing_os.cli faq "slug"      Show FAQ item details
    python -m housing_os.cli demo            Run end-to-end demo
"""

import sys
import json
from housing_os import db
from housing_os.router import route
from housing_os.regression import run_regression_suite


def _pp(obj):
    if isinstance(obj, dict):
        print(json.dumps(obj, indent=2, ensure_ascii=False, default=str))
    elif isinstance(obj, list):
        for item in obj:
            print(json.dumps(item, indent=2, ensure_ascii=False, default=str))
            print()
    else:
        print(obj)


def cmd_status():
    stats = db.get_stats()
    print("Foreigner Housing OS · V1.4 Status")
    print("=" * 40)
    for k, v in stats.items():
        print(f"  {k:<25} {v}")


def cmd_route(query: str):
    print(f"Routing: {query!r}")
    print("-" * 50)
    decision = route(query)
    print(f"  decision_id:      {decision['decision_id']}")
    print(f"  query_type:       {decision['query_type']}")
    print(f"  risk_level:       {decision['risk_level']}")
    print(f"  confidence_band:  {decision['confidence_band']}")
    print(f"  answer_mode:      {decision['answer_mode']}")
    print(f"  should_escalate:  {decision['should_escalate']}")
    print(f"  decision_reason:  {decision['decision_reason']}")
    if decision.get("selected_rule_keys"):
        print(f"  rules:            {decision['selected_rule_keys']}")
    if decision.get("selected_faq_slugs"):
        print(f"  faq:              {decision['selected_faq_slugs']}")
    if decision.get("missing_inputs"):
        print(f"  missing_inputs:   {decision['missing_inputs']}")
    if decision.get("trace_tags"):
        print(f"  trace_tags:       {decision['trace_tags']}")
    if decision.get("escalation_id"):
        print(f"  escalation_id:    {decision['escalation_id']}")


def cmd_queue():
    items = db.get_open_escalations()
    if not items:
        print("Escalation queue is empty.")
        return
    print(f"Open escalations: {len(items)}")
    print("-" * 60)
    for item in items:
        print(f"  [{item['priority_band'].upper():>8}] {item['escalation_id']}  {item['queue_status']}")
        print(f"           {item['query_text'][:70]}")
        print(f"           risk={item['risk_level']} conf={item['confidence_band']} reason={item['escalation_reason'][:50]}")
        print()


def cmd_writeback():
    items = db.get_pending_writebacks()
    if not items:
        print("No pending writebacks.")
        return
    print(f"Pending writebacks: {len(items)}")
    print("-" * 60)
    for item in items:
        print(f"  {item['writeback_id']}  {item['target_type']} -> {item['target_key']}")
        print(f"  From escalation: {item['escalation_id']}")
        data = json.loads(item["candidate_data"])
        print(f"  Data: {json.dumps(data, ensure_ascii=False)[:100]}")
        print()


def cmd_regression():
    print("Running regression suite...")
    print("-" * 50)
    results = run_regression_suite()
    print(f"  Run ID:   {results['run_id']}")
    print(f"  Total:    {results['total']}")
    print(f"  Passed:   {results['passed']}")
    print(f"  Failed:   {results['failed']}")
    print(f"  Errors:   {results['errors']}")
    print()
    for d in results["details"]:
        status = "PASS" if d["pass_fail"] == "pass" else "FAIL" if d["pass_fail"] == "fail" else "ERR "
        line = f"  [{status}] {d['case_key']}"
        if d.get("failures"):
            line += f"  -- {'; '.join(d['failures'][:2])}"
        if d.get("error"):
            line += f"  -- {d['error'][:60]}"
        print(line)


def cmd_validate():
    print("Running validation views...")
    print("-" * 50)
    results = db.run_validation()
    all_ok = True
    for view_name, rows in results.items():
        count = len(rows)
        status = "OK"
        if view_name == "v_stale_mappings":
            stale_count = sum(1 for r in rows if r.get("is_stale", 0) == 1)
            status = "OK" if stale_count == 0 else "ISSUE"
            count = stale_count
        elif view_name == "v_rule_integrity":
            issues = [r for r in rows if r.get("status") != "OK"]
            status = "OK" if not issues else "ISSUE"
            count = len(issues)
        elif view_name in ("v_writeback_traceability", "v_regression_coverage"):
            status = "INFO"
        elif count > 0:
            status = "ISSUE"
        if status == "ISSUE":
            all_ok = False
        print(f"  [{status:>5}] {view_name:<35} {count} rows")
    print()
    print("  RESULT:", "ALL PASS" if all_ok else "ISSUES DETECTED")


def cmd_faq(slug: str):
    faq = db.get_faq(slug)
    if not faq:
        print(f"FAQ not found: {slug}")
        return
    print(f"FAQ: {faq['faq_slug']}")
    print(f"  Title:    {faq['title']}")
    print(f"  Category: {faq['category']}")
    print(f"  Status:   {faq['review_status']}")
    print(f"  Router:   {'yes' if faq['router_callable'] else 'no'}")
    print(f"  Content:  {faq['content'][:200]}...")
    sources = db.get_faq_sources(slug)
    if sources:
        print(f"  Sources ({len(sources)}):")
        for s in sources:
            print(f"    - {s['source_key']} ({s['source_name']}) [{s['review_status']}]")


def cmd_demo():
    """Run a complete end-to-end demo showing the full V1.4 pipeline."""
    print("=" * 60)
    print("Foreigner Housing OS V1.4 — End-to-End Demo")
    print("=" * 60)

    queries = [
        "How much does it cost to rent an apartment in Tokyo?",
        "I want to see a property in Shinjuku tomorrow",
        "My landlord is refusing to return my deposit",
        "What documents do I need to apply for an apartment?",
        "Are there apartments available in Meguro right now?",
        "Write me a haiku about cherry blossoms",
    ]

    print("\n--- 1. ROUTING QUERIES ---\n")
    for q in queries:
        d = route(q)
        esc_marker = " ** ESCALATED" if d.get("escalation_id") else ""
        print(f"  Q: {q}")
        print(f"     -> {d['query_type']} | {d['confidence_band']} conf | {d['answer_mode']} | risk={d['risk_level']}{esc_marker}")
        print()

    print("--- 2. ESCALATION QUEUE ---\n")
    cmd_queue()

    print("--- 3. PENDING WRITEBACKS ---\n")
    cmd_writeback()

    print("--- 4. REGRESSION SUITE ---\n")
    cmd_regression()

    print("\n--- 5. VALIDATION ---\n")
    cmd_validate()

    print("\n--- 6. SYSTEM STATS ---\n")
    cmd_status()

    print("\n" + "=" * 60)
    print("Demo complete. All V1.4 Phase 1 components exercised.")
    print("=" * 60)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "status":
        cmd_status()
    elif cmd == "route":
        if len(sys.argv) < 3:
            print("Usage: python -m housing_os.cli route \"your query\"")
            sys.exit(1)
        cmd_route(" ".join(sys.argv[2:]))
    elif cmd == "queue":
        cmd_queue()
    elif cmd == "writeback":
        cmd_writeback()
    elif cmd == "regression":
        cmd_regression()
    elif cmd == "validate":
        cmd_validate()
    elif cmd == "faq":
        if len(sys.argv) < 3:
            print("Usage: python -m housing_os.cli faq <slug>")
            sys.exit(1)
        cmd_faq(sys.argv[2])
    elif cmd == "demo":
        cmd_demo()
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
