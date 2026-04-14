#!/bin/bash
# evidence_gate.sh <task_id>
# V7: Evidence Gate — checks preconditions before allowing task execution.
# Outputs "GATE: OPEN" or "GATE: BLOCKED: <reason>" and exits non-zero.
#
# This is "graph theory landing": each node's entry has precondition checks.
# If preconditions aren't met, the node is not entered.

set -uo pipefail

TASK=${1:-""}
PASS=true
BLOCKED_REASONS=()

if [ -z "$TASK" ]; then
  echo "Usage: bash scripts/evidence_gate.sh <T1|T2|T3|T4|T5|T6|T7|T8>"
  exit 1
fi

case $TASK in
  T1)
    # T1 preconditions: AUDIT completed, stream route confirmed
    [ -f "audit/pre_task_scan.md" ] || [ -f "audit/v6_pre_task_scan.md" ] \
      || { BLOCKED_REASONS+=("audit scan file not found"); PASS=false; }
    # Check actual stream route exists (our path is /api/router/stream, not /api/query/stream)
    [ -f "src/app/api/router/stream/route.ts" ] \
      || { BLOCKED_REASONS+=("stream route file not found at src/app/api/router/stream/route.ts"); PASS=false; }
    ;;
  T2)
    [ -f "audit/pre_task_scan.md" ] || [ -f "audit/v6_pre_task_scan.md" ] \
      || { BLOCKED_REASONS+=("AUDIT not completed"); PASS=false; }
    # T1 must be marked complete
    grep -q "T1.*完成\|T1.*PASS\|kb_hit\|KB短路" audit/completion_report.md 2>/dev/null \
      || { BLOCKED_REASONS+=("T1 not marked complete in completion_report.md"); PASS=false; }
    ;;
  T3|T4)
    # T2 must be complete
    grep -q "T2.*完成\|T2.*PASS\|ttft_ms\|TTFT" audit/completion_report.md 2>/dev/null \
      || { BLOCKED_REASONS+=("T2 not complete"); PASS=false; }
    # Redis client module must exist (Upstash REST, not redis-cli)
    [ -f "src/lib/redis/client.ts" ] \
      || { BLOCKED_REASONS+=("Redis client module not found at src/lib/redis/client.ts"); PASS=false; }
    ;;
  T5)
    grep -q "T2.*完成\|T2.*PASS\|ttft_ms\|TTFT" audit/completion_report.md 2>/dev/null \
      || { BLOCKED_REASONS+=("T2 not complete"); PASS=false; }
    # Evidence chain logger must exist
    [ -f "src/lib/patent/evidence-chain-logger.ts" ] \
      || { BLOCKED_REASONS+=("Evidence chain logger not found"); PASS=false; }
    ;;
  T6|T7|T8)
    # P2 tasks: need real production data
    # Since we use JSONL (not DB), check evidence file line count
    EVIDENCE_FILE=".data/evidence_chain.jsonl"
    if [ -f "$EVIDENCE_FILE" ]; then
      EVIDENCE_COUNT=$(wc -l < "$EVIDENCE_FILE" | tr -d ' ')
    else
      EVIDENCE_COUNT=0
    fi
    [ "${EVIDENCE_COUNT:-0}" -ge 1000 ] \
      || { BLOCKED_REASONS+=("evidence_records < 1000 (current: ${EVIDENCE_COUNT}). P2 tasks need real production data."); PASS=false; }
    # T3 and T4 must be complete
    grep -q "T3.*完成\|T3.*PASS\|限流.*Redis\|Rate.*Redis" audit/completion_report.md 2>/dev/null \
      || { BLOCKED_REASONS+=("T3 not complete"); PASS=false; }
    grep -q "T4.*完成\|T4.*PASS\|配额.*Redis\|Quota.*Redis\|幂等" audit/completion_report.md 2>/dev/null \
      || { BLOCKED_REASONS+=("T4 not complete"); PASS=false; }
    ;;
  *)
    echo "Unknown task: $TASK"
    echo "Usage: bash scripts/evidence_gate.sh <T1|T2|T3|T4|T5|T6|T7|T8>"
    exit 1
    ;;
esac

echo ""
if $PASS; then
  echo "GATE: OPEN — $TASK preconditions satisfied, proceed."
else
  echo "GATE: BLOCKED"
  for reason in "${BLOCKED_REASONS[@]}"; do
    echo "  ✗ $reason"
  done
  echo ""
  echo "Resolve the above before continuing $TASK."
  exit 1
fi
