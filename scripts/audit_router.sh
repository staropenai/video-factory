#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# audit_router.sh — 审计结果自动路由脚本
# 用途：verify 脚本失败时，自动把失败信息写入 pitfall_registry.md
#       成功时，更新 baselines/latest.json
# 用法：bash scripts/audit_router.sh [pass|fail] "任务ID" "失败描述"
# ═══════════════════════════════════════════════════════════════════

set -e

RESULT="${1:-fail}"         # pass | fail
TASK_ID="${2:-TASK-UNKNOWN}"
FAILURE_DESC="${3:-未提供失败描述}"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

PITFALL_FILE="docs/pitfall_registry.md"
BASELINE_FILE="docs/baselines/latest.json"
BASELINE_HISTORY="docs/baselines/${DATE}.json"

# ─── 确认在 web/ 目录下运行 ──────────────────────────────────────
if [ ! -f "package.json" ]; then
  echo "❌ 请在 web/ 目录下运行此脚本"
  exit 1
fi

mkdir -p docs/baselines

# ─── 收集当前状态 ─────────────────────────────────────────────────
echo "📊 收集当前状态..."

TESTS_RESULT=$(npm test -- --ci --passWithNoTests 2>&1 | grep "Tests:" | tail -1 || echo "未知")
TESTS_PASSING=$(echo "$TESTS_RESULT" | grep -oP '\d+ passed' | head -1 | grep -oP '\d+' || echo "0")
TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

# ─── 处理成功结果 ─────────────────────────────────────────────────
if [ "$RESULT" = "pass" ]; then
  echo "✅ 任务成功，更新基线快照..."

  cat > "$BASELINE_FILE" << BASELINE_EOF
{
  "captured_at": "${DATE}",
  "timestamp": "${TIMESTAMP}",
  "task_id": "${TASK_ID}",
  "commit_hash": "${COMMIT_HASH}",
  "branch": "${BRANCH}",
  "tests_passing": ${TESTS_PASSING},
  "ts_errors": ${TS_ERRORS},
  "verification_result": "pass",
  "note": "由 audit_router.sh 自动生成"
}
BASELINE_EOF

  cp "$BASELINE_FILE" "$BASELINE_HISTORY"

  echo "✅ 基线已更新："
  echo "   文件：$BASELINE_FILE"
  echo "   测试通过：$TESTS_PASSING"
  echo "   TS 错误：$TS_ERRORS"
  echo ""
  echo "📝 下一步（10分钟维护）："
  echo "   1. 更新 JTG_项目交接文档.md（已完成/待办）"
  echo "   2. 更新对应 audit/mnk_cards/ 状态列"
  echo "   3. 若有重要决策，追加 docs/decision_log.md"

  exit 0
fi

# ─── 处理失败结果 ─────────────────────────────────────────────────
echo "❌ 任务失败，自动写入踩坑记录..."

# 生成 PIT ID
EXISTING_PITS=$(grep -c "^## \[PIT-" "$PITFALL_FILE" 2>/dev/null || echo "0")
PIT_NUM=$(printf "%03d" $((EXISTING_PITS + 1)))
PIT_ID="PIT-${DATE}-${PIT_NUM}"

# 收集失败快照
FAIL_SNAPSHOT="docs/baselines/${DATE}-fail-${PIT_NUM}.json"
cat > "$FAIL_SNAPSHOT" << SNAPSHOT_EOF
{
  "captured_at": "${DATE}",
  "timestamp": "${TIMESTAMP}",
  "task_id": "${TASK_ID}",
  "commit_hash": "${COMMIT_HASH}",
  "branch": "${BRANCH}",
  "tests_passing": ${TESTS_PASSING},
  "ts_errors": ${TS_ERRORS},
  "verification_result": "fail",
  "failure_description": "${FAILURE_DESC}",
  "note": "失败快照，由 audit_router.sh 自动生成"
}
SNAPSHOT_EOF

# 追加到 pitfall_registry.md
cat >> "$PITFALL_FILE" << PITFALL_EOF

---

## [${PIT_ID}] ${FAILURE_DESC}

**发现时间：** ${DATE}
**任务 ID：** ${TASK_ID}
**状态：** 🔴 未解决

**触发条件：** 执行 ${TASK_ID} 时验收失败

**表面现象：**
\`\`\`
测试通过数：${TESTS_PASSING}
TypeScript 错误：${TS_ERRORS}
Commit：${COMMIT_HASH}
\`\`\`

**根本原因：** 【待填写：不是表面现象，是本质原因】

**修复方案：** 【待填写：最终怎么解决的】

**预防规则：** 【待填写：对应的 IP/LR/CC 编号，或新增规则】

**代价：** 【待填写：花了多少时间/对用户的影响】

> 此记录由 audit_router.sh 自动生成于 ${TIMESTAMP}
> 请填写「根本原因」「修复方案」「预防规则」「代价」四个字段
PITFALL_EOF

echo ""
echo "📝 踩坑记录已写入：$PITFALL_FILE"
echo "   PIT ID：$PIT_ID"
echo "📸 失败快照已保存：$FAIL_SNAPSHOT"
echo ""
echo "⚠️  下一步（必须完成，否则不算完成）："
echo "   1. 打开 $PITFALL_FILE"
echo "   2. 找到 [$PIT_ID]"
echo "   3. 填写：根本原因 / 修复方案 / 预防规则 / 代价"
echo "   4. 修复问题后重新运行 verify 脚本"
echo ""
echo "❌ 当前任务标记为：未完成（FAILED）"

exit 1
