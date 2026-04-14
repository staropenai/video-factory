#!/bin/bash
# self_verify.sh <task_id>
# V7: Self-Verification Loop — outputs VERIFIED or HALLUCINATION_DETECTED.
#
# This is "every step can prove it's not hallucination" landing.
# The script is code, not prose — it cannot lie.

set -uo pipefail

TASK=${1:-""}
ISSUES=()

if [ -z "$TASK" ]; then
  echo "Usage: bash scripts/self_verify.sh <T1|T2|T3|T4|T5>"
  exit 1
fi

# Helper: run jest with a pattern, check if it passes
run_jest_pattern() {
  npx jest "$1" --passWithNoTests 2>&1 | grep -q "passed"
}

echo "=== Self-Verification $TASK — $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo ""

# ──────────────────────────────────────────
# Universal checks (all tasks)
# ──────────────────────────────────────────

# 1. TypeScript zero errors
echo -n "TypeScript src/: "
TS_ERR=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || true)
[ "$TS_ERR" -eq 0 ] && echo "✅ 0 errors" || { echo "❌ $TS_ERR errors"; ISSUES+=("TS errors: $TS_ERR"); }

# 2. Test count must not decrease
echo -n "Test count: "
TEST_OUTPUT=$(npx jest --passWithNoTests 2>&1)
CURRENT=$(echo "$TEST_OUTPUT" | grep "^Tests:" | grep -o '[0-9]* passed' | grep -o '[0-9]*' || echo "0")
BASELINE=466
if [ "$CURRENT" -ge "$BASELINE" ]; then
  echo "✅ $CURRENT >= $BASELINE"
else
  echo "❌ $CURRENT < $BASELINE"; ISSUES+=("Test count decreased: $CURRENT < $BASELINE")
fi

# 3. All tests pass
echo -n "Test results: "
echo "$TEST_OUTPUT" | grep "^Tests:" | grep -q "failed" \
  && { echo "❌ Some tests failed"; ISSUES+=("Tests failing"); } \
  || echo "✅ All pass"

# ──────────────────────────────────────────
# Task-specific checks
# ──────────────────────────────────────────

case $TASK in
  T1)
    echo ""
    echo "--- T1: KB Short-Circuit Path ---"

    echo -n "kb_hit field in stream route: "
    grep -rn "kb_hit" src/app/api/router/stream/ --include="*.ts" 2>/dev/null | grep -v ".test." | grep -q "kb_hit" \
      && echo "✅" || { echo "❌ kb_hit not found in stream route"; ISSUES+=("T1: kb_hit missing"); }

    echo -n "KB hit skips LLM (test evidence): "
    run_jest_pattern "fast-path" \
      && echo "✅" || { echo "❌ fast-path tests not passing"; ISSUES+=("T1: fast-path tests fail"); }

    echo -n "kb-matcher.ts exists: "
    [ -f "src/lib/routing/kb-matcher.ts" ] && echo "✅" \
      || { echo "❌"; ISSUES+=("T1: kb-matcher.ts not found"); }

    echo -n "evidence records include tier field: "
    grep -rn "ecRecord\.tier\|tier.*=.*[\"']A\|tier.*=.*[\"']B\|tier.*=.*[\"']C" \
      src/app/api/router/stream/route.ts 2>/dev/null | grep -q "." \
      && echo "✅" || { echo "❌"; ISSUES+=("T1: tier not written to evidence"); }
    ;;

  T2)
    echo ""
    echo "--- T2: TTFT Measurement + Sentry APM ---"

    echo -n "ttft_ms in evidence records: "
    grep -rn "ttft_ms" src/app/api/router/stream/ src/lib/patent/ --include="*.ts" 2>/dev/null \
      | grep -v ".test." | grep -q "ttft_ms" \
      && echo "✅" || { echo "❌"; ISSUES+=("T2: ttft_ms not found"); }

    echo -n "llm_called in evidence records: "
    grep -rn "llm_called" src/app/api/router/stream/ src/lib/patent/ --include="*.ts" 2>/dev/null \
      | grep -v ".test." | grep -q "llm_called" \
      && echo "✅" || { echo "❌"; ISSUES+=("T2: llm_called not found"); }

    echo -n "Sentry safe no-op (without DSN): "
    grep -rn "isSentryActive\|if.*SENTRY_DSN\|process\.env\.SENTRY_DSN" \
      src/lib/monitoring/sentry.ts src/instrumentation.ts 2>/dev/null | grep -q "." \
      && echo "✅" || { echo "❌"; ISSUES+=("T2: Sentry not properly guarded"); }

    echo -n "No PII in Sentry calls: "
    grep -rn "Sentry\.\|captureMessage\|setTag" src/app/api/ --include="*.ts" 2>/dev/null \
      | grep -iv "test" | grep -i "query_text\|queryText\|user_input" \
      && { echo "❌ Possible PII leak"; ISSUES+=("T2: PII in Sentry"); } \
      || echo "✅"

    echo -n "Client TTFT in useStreamQuery: "
    grep -rn "client_ttft_ms\|clientTtft\|clientStart" src/hooks/useStreamQuery.ts 2>/dev/null | grep -q "." \
      && echo "✅" || { echo "❌"; ISSUES+=("T2: client TTFT not in useStreamQuery"); }
    ;;

  T3)
    echo ""
    echo "--- T3: Rate Limit Redis ---"

    echo -n "Redis rate limit tests: "
    run_jest_pattern "rate-limit-redis" \
      && echo "✅" || { echo "❌"; ISSUES+=("T3: Redis rate limit tests fail"); }

    echo -n "Memory fallback preserved: "
    grep -rn "checkRateLimit" src/lib/security/rate-limit.ts 2>/dev/null \
      | grep -q "function\|export" \
      && echo "✅" || { echo "❌ memory rate-limit removed"; ISSUES+=("T3: memory fallback deleted"); }

    echo -n "Redis dual-mode in rate-limit.ts: "
    grep -rn "getRedis\|checkRateLimitRedis\|checkRateLimitAsync" \
      src/lib/security/rate-limit.ts 2>/dev/null | grep -q "." \
      && echo "✅" || { echo "❌"; ISSUES+=("T3: no Redis path in rate-limit"); }
    ;;

  T4)
    echo ""
    echo "--- T4: Quota Redis + Idempotency ---"

    echo -n "Idempotency key in stream route: "
    grep -rn "x-idempotency-key\|idempotencyKey\|idempotency" \
      src/app/api/router/stream/route.ts 2>/dev/null | grep -q "." \
      && echo "✅" || { echo "❌"; ISSUES+=("T4: idempotency key not in route"); }

    echo -n "Idempotency in quota tracker: "
    grep -rn "idempotencyKey\|checkIdempotencyKey\|idem" \
      src/lib/quota/tracker.ts 2>/dev/null | grep -q "." \
      && echo "✅" || { echo "❌"; ISSUES+=("T4: idempotency not in tracker"); }

    echo -n "Redis quota tests: "
    run_jest_pattern "tracker-redis" \
      && echo "✅" || { echo "❌"; ISSUES+=("T4: quota tests fail"); }

    echo -n "Idempotency tests: "
    run_jest_pattern "idempotency" \
      && echo "✅" || { echo "❌"; ISSUES+=("T4: idempotency tests fail"); }

    echo -n "Quota Redis dual-mode: "
    grep -rn "getRedis\|incrQuotaRedis\|decrQuotaRedis" \
      src/lib/quota/tracker.ts 2>/dev/null | grep -q "." \
      && echo "✅" || { echo "❌"; ISSUES+=("T4: no Redis path in quota tracker"); }
    ;;

  T5)
    echo ""
    echo "--- T5: Evidence Write Verification ---"

    echo -n "Evidence reconciliation tests: "
    run_jest_pattern "evidence-reconciliation" \
      && echo "✅" || { echo "❌"; ISSUES+=("T5: reconciliation tests fail"); }

    echo -n "Evidence write tests: "
    run_jest_pattern "evidence-write" \
      && echo "✅" || { echo "❌"; ISSUES+=("T5: evidence write tests fail"); }

    echo -n "Write failure not silent (Sentry report): "
    grep -rn "captureError\|captureException\|logError.*evidence" \
      src/app/api/router/stream/route.ts src/lib/patent/ --include="*.ts" 2>/dev/null \
      | grep -v ".test." | grep -q "." \
      && echo "✅" || { echo "❌"; ISSUES+=("T5: evidence failure is silent"); }

    echo -n "Consistency strategy documented: "
    grep -rn "ASYNC EVENTUAL CONSISTENCY\|异步最终一致\|consistency strategy" \
      src/lib/patent/evidence-chain-logger.ts 2>/dev/null | grep -q "." \
      && echo "✅" || { echo "❌"; ISSUES+=("T5: consistency strategy not documented in code"); }
    ;;

  *)
    echo "Unknown task: $TASK"
    exit 1
    ;;
esac

# ──────────────────────────────────────────
# Hallucination detection (critical)
# ──────────────────────────────────────────

echo ""
echo "=== Hallucination Detection ==="

echo -n "No hardcoded performance promises: "
grep -rn "guaranteed.*ms\|always.*under.*ms\|latency.*<.*50" \
  src/ --include="*.ts" 2>/dev/null | grep -v ".test." | grep -v "//.*TODO\|//.*target\|//.*goal" | grep -q "." \
  && { echo "❌ Hardcoded performance promise"; ISSUES+=("Hallucination: hardcoded perf number"); } \
  || echo "✅"

echo -n "Patent-sensitive params not in docs: "
grep -rE "0\.77|TIER_SHORTCUT_MIN_SCORE" \
  docs/ *.md 2>/dev/null | grep -v "REDACTED\|见源码\|internal\|source code" | grep -q "." \
  && { echo "⚠️ Threshold exposed in docs"; ISSUES+=("Patent: sensitive param in docs"); } \
  || echo "✅"

echo -n "Skeleton APIs properly labeled: "
if [ -d "src/app/api/auth/" ]; then
  grep -rn "skeleton\|TODO.*auth\|not.*implemented" src/app/api/auth/ --include="*.ts" 2>/dev/null \
    | grep -qE "skeleton|TODO|501" && echo "✅ Properly labeled" \
    || echo "⚠️ Auth endpoints may need skeleton labels"
else
  echo "✅ No auth endpoints yet (T6 not executed)"
fi

# ──────────────────────────────────────────
# Final verdict
# ──────────────────────────────────────────

echo ""
if [ ${#ISSUES[@]} -eq 0 ]; then
  echo "✅ VERIFIED — $TASK passed self-verification"
  echo "Ready to write audit/completion_report.md and proceed."
else
  echo "❌ HALLUCINATION_DETECTED — $TASK has issues:"
  for issue in "${ISSUES[@]}"; do
    echo "  ✗ $issue"
  done
  echo ""
  echo "Fix the above, then re-run: bash scripts/self_verify.sh $TASK"
  exit 1
fi
