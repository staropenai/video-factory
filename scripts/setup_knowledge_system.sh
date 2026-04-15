#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# setup_knowledge_system.sh — 一键把经验积累系统提交进 Git
# 用途：把所有知识积累文件放到正确位置并提交
# 用法：在 web/ 目录下运行：bash scripts/setup_knowledge_system.sh
# ═══════════════════════════════════════════════════════════════════

set -e

echo "=== JTG 经验积累系统初始化 === $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ─── 确认在 web/ 目录下运行 ──────────────────────────────────────
if [ ! -f "package.json" ]; then
  echo "❌ 请在 web/ 目录下运行此脚本"
  exit 1
fi

# ─── 创建目录结构 ─────────────────────────────────────────────────
echo "📁 创建目录结构..."
mkdir -p docs/baselines
mkdir -p audit/mnk_cards
mkdir -p audit/templates
mkdir -p scripts

# ─── 创建初始基线快照 ─────────────────────────────────────────────
echo "📊 生成初始基线快照..."

TESTS_PASSING=$(npm test -- --ci --passWithNoTests 2>&1 \
  | grep "Tests:" | grep -oP '\d+ passed' | head -1 \
  | grep -oP '\d+' || echo "0")
TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
DATE=$(date +%Y-%m-%d)

cat > docs/baselines/latest.json << EOF
{
  "captured_at": "${DATE}",
  "task_id": "INIT",
  "commit_hash": "${COMMIT_HASH}",
  "branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "tests_passing": ${TESTS_PASSING},
  "ts_errors": ${TS_ERRORS},
  "verification_result": "init",
  "deployed_zones": ["ZONE-0", "ZONE-2", "ZONE-3", "ZONE-4", "ZONE-4b"],
  "broken_routes": [
    "/zh-Hans/privacy",
    "/zh-Hans/terms",
    "/zh-Hans/verify-evidence",
    "/zh-Hans/report"
  ],
  "note": "初始基线，由 setup_knowledge_system.sh 生成"
}
EOF

cp docs/baselines/latest.json "docs/baselines/${DATE}-init.json"
echo "✓ 基线快照：docs/baselines/latest.json（测试 $TESTS_PASSING, TS错误 $TS_ERRORS）"

# ─── 创建 pitfall_registry.md 骨架（如不存在）────────────────────
if [ ! -f "docs/pitfall_registry.md" ]; then
cat > docs/pitfall_registry.md << 'PITFALL_EOF'
# JTG 踩坑记录 (Pitfall Registry)

> **用途：** 每次验证失败、生产 bug、重复出现的问题，在这里记录。
> **核心价值：** 让同一个坑只踩一次。
> **更新方式：** 由 audit_router.sh 自动追加，人工补填根本原因和预防规则。

## 踩坑模板

```
## [PIT-YYYY-MM-DD-001] 坑的名称

**发现时间：** YYYY-MM-DD
**状态：** 🔴 未解决 / 🟡 已绕过 / 🟢 已根治

**触发条件：** ...
**根本原因：** ...
**修复方案：** ...
**预防规则：** IP/LR/CC 编号
**代价：** ...
```

---

<!-- 以下由 audit_router.sh 自动追加 -->
PITFALL_EOF
  echo "✓ 创建：docs/pitfall_registry.md"
fi

# ─── 创建 decision_log.md 骨架（如不存在）──────────────────────
if [ ! -f "docs/decision_log.md" ]; then
cat > docs/decision_log.md << 'DECISION_EOF'
# JTG 决策日志 (Decision Log)

> **更新规则：** 每次迭代后追加，不覆盖历史。每 3 次迭代回顾标记。

## 决策模板

```
## [YYYY-MM-DD] 决策标题

**背景：** ...
**选项：** A / B / C
**选定：** X — **理由：** ...
**放弃：** Y — **原因：** ...
**当时约束：** IP/LR 编号
**回看日期：** YYYY-MM-DD
**回看标记：** [ ] 待回顾 / [x] ✓ 正确 / [x] ✗ 需修正
```

---

## 2026-04-15 · Vercel 部署 Root Directory 配置

**背景：** monorepo 结构，Next.js 在 web/ 子目录，Vercel 找不到 next 依赖
**选定：** Dashboard Root Directory = web（一次性配置）
**放弃：** vercel.json 写 rootDirectory（schema 不允许）
**当时约束：** ω9（构建通过）
**回看日期：** 2026-05-15
**回看标记：** [ ] 待回顾

DECISION_EOF
  echo "✓ 创建：docs/decision_log.md"
fi

# ─── 创建 constraints.dsl.yml 骨架（如不存在）──────────────────
if [ ! -f "docs/constraints.dsl.yml" ]; then
  echo "⚠️  docs/constraints.dsl.yml 不存在"
  echo "   请把 constraints.dsl.yml 文件放到 docs/ 目录"
  echo "   文件内容见下载的 constraints.dsl.yml"
fi

# ─── 创建 audit_router.sh（如不存在）─────────────────────────────
if [ ! -f "scripts/audit_router.sh" ]; then
  echo "⚠️  scripts/audit_router.sh 不存在"
  echo "   请把 audit_router.sh 放到 scripts/ 目录并 chmod +x"
fi

# ─── 设置脚本执行权限 ─────────────────────────────────────────────
chmod +x scripts/evidence_gate*.sh 2>/dev/null || true
chmod +x scripts/verify*.sh 2>/dev/null || true
chmod +x scripts/audit_router.sh 2>/dev/null || true
echo "✓ 脚本执行权限已设置"

# ─── Git 提交 ─────────────────────────────────────────────────────
echo ""
echo "📦 准备提交到 Git..."

git add docs/ audit/ scripts/ 2>/dev/null || true

# 检查是否有内容需要提交
if git diff --cached --quiet; then
  echo "⚠️  没有新内容需要提交（文件可能已存在）"
else
  git commit -m "docs: 初始化经验积累系统 V2 — 约束DSL/决策日志/踩坑记录/MNK卡/基线快照

- docs/constraints.dsl.yml: 机器可读约束规则（IP/LR/IT/CC）
- docs/decision_log.md: 决策日志（含 Vercel 部署决策）
- docs/pitfall_registry.md: 踩坑记录（自动追加模式）
- docs/baselines/latest.json: 初始基线快照（tests: ${TESTS_PASSING}, TS: ${TS_ERRORS}）
- audit/mnk_cards/: 模块最少必要知识卡
- audit/templates/: task_packet/audit_output/pitfall 模板
- scripts/audit_router.sh: 失败自动写入 pitfall 脚本

[知识积累系统 V2.0 · EOVALU 学习循环]"

  echo "✓ Git 提交完成"
  git log --oneline -1
fi

# ─── 验收 ────────────────────────────────────────────────────────
echo ""
echo "=== 验收结果 ==="
PASS=true

for f in "docs/baselines/latest.json" "docs/pitfall_registry.md" "docs/decision_log.md"; do
  [ -f "$f" ] && echo "✓ $f" || { echo "❌ $f 缺失"; PASS=false; }
done

for d in "audit/mnk_cards" "audit/templates" "scripts"; do
  [ -d "$d" ] && echo "✓ $d/" || { echo "❌ $d/ 目录缺失"; PASS=false; }
done

echo ""
if $PASS; then
  echo "✅ 经验积累系统初始化完成"
  echo ""
  echo "下一步（今天内）："
  echo "  1. 把 constraints.dsl.yml 放入 docs/"
  echo "  2. 把 task_packet.yml / audit_output.yml 放入 audit/templates/"
  echo "  3. 把 audit_router.sh 放入 scripts/ 并 chmod +x"
  echo "  4. 在 .env.local 配置 NEXT_PUBLIC_LINE_URL 等环境变量"
  echo "  5. 运行 bash scripts/verify_v5_homepage.sh 确认基线状态"
else
  echo "❌ 部分文件缺失，请检查上方输出"
  exit 1
fi
