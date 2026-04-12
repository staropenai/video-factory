#!/usr/bin/env python3
"""
Bootstrap script for Foreigner Housing OS V1.4.
Creates database, applies schema, loads seed data.
Idempotent — safe to re-run.
"""

import sqlite3
import os
import sys
from pathlib import Path

DB_PATH = os.environ.get("HOUSING_OS_DB", "housing_os.db")
SCHEMA_PATH = Path(__file__).parent / "schema.sql"
SEED_PATH = Path(__file__).parent / "seed.sql"


def init_db():
    print("=" * 50)
    print("Foreigner Housing OS · V1.4 — Database Bootstrap")
    print("=" * 50)

    conn = sqlite3.connect(DB_PATH)

    # Apply schema
    print(f"\n[1/3] Applying schema to {DB_PATH}...")
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
    print("      Schema applied (12 tables, 10 views)")

    # Apply seeds
    print("[2/3] Loading seed data...")
    with open(SEED_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
    print("      Seeds loaded (idempotent)")

    # Verify
    print("[3/3] Verifying...")
    counts = {}
    for table in [
        "faq_items", "source_registry", "faq_source_mappings",
        "rules_catalog", "user_task_state", "router_decisions",
        "human_escalation_queue", "human_escalation_events",
        "regression_cases", "writeback_candidates", "consultation_records",
    ]:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        counts[table] = count

    conn.close()

    print()
    print("  Table                     Rows")
    print("  " + "-" * 38)
    for t, c in counts.items():
        print(f"  {t:<28}{c}")

    # Validation checks
    conn = sqlite3.connect(DB_PATH)
    violations = conn.execute("SELECT COUNT(*) FROM v_low_confidence_violations").fetchone()[0]
    orphans = conn.execute("SELECT COUNT(*) FROM v_orphan_events").fetchone()[0]
    state_violations = conn.execute("SELECT COUNT(*) FROM v_escalation_state_violations").fetchone()[0]
    eligible = conn.execute("SELECT COUNT(*) FROM v_router_eligible_faq").fetchone()[0]
    regression_coverage = conn.execute(
        "SELECT COUNT(DISTINCT source_origin) FROM regression_cases WHERE is_active=1"
    ).fetchone()[0]
    conn.close()

    print()
    print("  Validation")
    print("  " + "-" * 38)
    print(f"  Low-confidence violations:  {violations}")
    print(f"  Orphan events:              {orphans}")
    print(f"  State violations:           {state_violations}")
    print(f"  Router-eligible FAQ:        {eligible}")
    print(f"  Regression origin coverage: {regression_coverage} types")

    all_ok = violations == 0 and orphans == 0 and state_violations == 0
    print()
    if all_ok:
        print("  STATUS: ALL CHECKS PASS")
    else:
        print("  STATUS: VALIDATION ISSUES DETECTED")
        sys.exit(1)

    print()
    print(f"Database ready: {os.path.abspath(DB_PATH)}")
    print("Run: python -m housing_os.cli status")
    return True


if __name__ == "__main__":
    init_db()
