"""
Regression runner — executes all active regression cases against the router
and records pass/fail results.

Usage:
    from housing_os.regression import run_regression_suite
    results = run_regression_suite()
"""

import json
from housing_os import db
from housing_os.router import route


def _uid() -> str:
    return db._uid()


def run_regression_suite(run_id: str = None) -> dict:
    """
    Run all active regression cases. Returns summary dict.

    For each case:
    - Routes the query through the router
    - Compares actual vs expected fields
    - Records pass/fail to regression_runs
    """
    run_id = run_id or _uid()
    cases = db.get_active_regression_cases()

    passed = 0
    failed = 0
    errors = 0
    details = []

    for case in cases:
        case_key = case["case_key"]
        try:
            decision = route(case["query_text"])

            failures = []

            # Compare each expected field
            if case.get("expected_query_type"):
                if decision["query_type"] != case["expected_query_type"]:
                    failures.append(
                        f"query_type: expected={case['expected_query_type']}, got={decision['query_type']}"
                    )

            if case.get("expected_answer_mode"):
                if decision["answer_mode"] != case["expected_answer_mode"]:
                    failures.append(
                        f"answer_mode: expected={case['expected_answer_mode']}, got={decision['answer_mode']}"
                    )

            if case.get("expected_should_escalate") is not None:
                actual_esc = 1 if decision.get("should_escalate") else 0
                if actual_esc != case["expected_should_escalate"]:
                    failures.append(
                        f"should_escalate: expected={case['expected_should_escalate']}, got={actual_esc}"
                    )

            if case.get("expected_confidence_band"):
                if decision.get("confidence_band") != case["expected_confidence_band"]:
                    failures.append(
                        f"confidence_band: expected={case['expected_confidence_band']}, got={decision.get('confidence_band')}"
                    )

            expected_rules = json.loads(case["expected_rule_keys"]) if case.get("expected_rule_keys") else None
            if expected_rules:
                actual_rules = decision.get("selected_rule_keys") or []
                for ek in expected_rules:
                    if ek not in actual_rules:
                        failures.append(f"missing expected rule: {ek}")

            expected_faqs = json.loads(case["expected_faq_slugs"]) if case.get("expected_faq_slugs") else None
            if expected_faqs:
                actual_faqs = decision.get("selected_faq_slugs") or []
                for ef in expected_faqs:
                    if ef not in actual_faqs:
                        failures.append(f"missing expected faq: {ef}")

            pf = "fail" if failures else "pass"
            if pf == "pass":
                passed += 1
            else:
                failed += 1

            result = {
                "decision_id": decision["decision_id"],
                "query_type": decision["query_type"],
                "rule_keys": decision.get("selected_rule_keys"),
                "faq_slugs": decision.get("selected_faq_slugs"),
                "confidence": decision.get("confidence_band"),
                "answer_mode": decision["answer_mode"],
                "should_escalate": 1 if decision.get("should_escalate") else 0,
                "pass_fail": pf,
                "failure_details": "; ".join(failures) if failures else None,
            }
            db.save_regression_run(run_id, case_key, result)
            details.append({"case_key": case_key, "pass_fail": pf, "failures": failures})

        except Exception as e:
            errors += 1
            db.save_regression_run(run_id, case_key, {
                "pass_fail": "error",
                "failure_details": str(e),
            })
            details.append({"case_key": case_key, "pass_fail": "error", "error": str(e)})

    return {
        "run_id": run_id,
        "total": len(cases),
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "details": details,
    }
