#!/bin/bash
set -uo pipefail
PASS=true
echo "=== JTG 自审计 $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

# 1. 构建
echo -n "构建: "
BUILD_OUT=$(npx next build 2>&1)
echo "$BUILD_OUT" | grep -q "Build error\|Failed to compile" && { echo "❌ 构建失败"; PASS=false; } || echo "✅"

# 2. 测试
echo -n "测试: "
R=$(npx jest --no-coverage 2>&1 | grep "Tests:" | tail -1)
echo "$R" | grep -q "passed" && echo "✅ $R" || { echo "❌ $R"; PASS=false; }

# 3. TypeScript src/
echo -n "TS src/: "
N=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || true)
[ "$N" -eq 0 ] && echo "✅ 0 错误" || { echo "❌ $N 错误"; PASS=false; }

# 4. 路由响应格式（零处原始 NextResponse.json）
echo -n "响应信封: "
RAW=$(grep -rn "NextResponse\.json" src/app/api/ --include="route.ts" 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
[ "$RAW" -eq 0 ] && echo "✅ 全部使用 ok()/fail()" || { echo "❌ 还有 $RAW 处"; PASS=false; }

# 5. API/lib 中的 console.log（排除 logger/dev-log/tests/instrumentation）
echo -n "console.log: "
L=$(grep -rn "console\.log" src/app/api/ src/lib/ --include="*.ts" 2>/dev/null \
  | grep -v "logger\|dev-log\|\.test\.\|instrumentation" | wc -l | tr -d ' ')
[ "$L" -eq 0 ] && echo "✅ 0" || echo "⚠️  $L 处（建议替换为 devLog）"

# 6. 暂存区密钥扫描
echo -n "密钥扫描: "
git diff --cached 2>/dev/null | grep -qE 'sk-[a-zA-Z0-9]{20,}|eyJ[a-zA-Z0-9_-]{150,}' \
  && { echo "❌ 检测到疑似密钥"; PASS=false; } || echo "✅ 干净"

# 7. AI 路由配额守护
echo -n "AI 路由守护: "
UG=$(grep -rl "completions\.create\|responses\.create\|audio\.transcriptions" src/app/api/ --include="*.ts" 2>/dev/null \
  | grep -v ".test." \
  | xargs grep -L "consumeQuota\|quota-gate\|requireAdmin" 2>/dev/null | wc -l | tr -d ' ')
[ "$UG" -eq 0 ] && echo "✅ 全部已守护" || echo "⚠️  $UG 个路由可能缺少配额守护"

# 8. 安全头检查（proxy.ts 存在性）
echo -n "安全代理: "
[ -f "src/proxy.ts" ] && echo "✅ proxy.ts 存在" || { echo "❌ src/proxy.ts 缺失"; PASS=false; }

# 9. CODEOWNERS 激活检查
echo -n "CODEOWNERS: "
if [ -f ".github/CODEOWNERS" ]; then
  grep -q "@OWNER" .github/CODEOWNERS \
    && echo "⚠️  @OWNER 未替换为真实 GitHub 用户名" \
    || echo "✅ 已激活"
else
  echo "❌ .github/CODEOWNERS 不存在"; PASS=false
fi

# 10. 专利参数泄露扫描（核心阈值不应出现在 .md 文档中）
echo -n "专利参数: "
PATENT_LEAK=$(grep -rE "0\.77|TIER_SHORTCUT_MIN_SCORE|tier_shortcut_min" \
  docs/ audit/ *.md 2>/dev/null \
  | grep -v "REDACTED\|见源码\|internal\|source code\|self_audit\|self_verify" | wc -l | tr -d ' ')
[ "$PATENT_LEAK" -eq 0 ] && echo "✅ 无泄露" || { echo "❌ $PATENT_LEAK 处参数暴露"; PASS=false; }

# 11. 硬编码密钥深度扫描
echo -n "硬编码密钥: "
HARDCODED=$(grep -rn 'sk-[a-zA-Z0-9]\{20,\}\|OPENAI_API_KEY\s*=\s*"[^"]\{10,\}"\|SERVICE_ROLE.*=.*"eyJ' \
  src/ --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v ".env.example\|process\.env\|\.test\." | wc -l | tr -d ' ')
[ "$HARDCODED" -eq 0 ] && echo "✅ 干净" || { echo "❌ $HARDCODED 处硬编码密钥"; PASS=false; }

# 12. source map 生产泄露检查
echo -n "Source map: "
if [ -d ".next" ]; then
  MAPS=$(find .next -name "*.map" 2>/dev/null | wc -l | tr -d ' ')
  echo "⚠️  $MAPS 个 .map 文件（确保生产环境不暴露）"
else
  echo "✅ 无构建产物"
fi

echo ""
$PASS && echo "✅✅ 自审计通过" || { echo "❌❌ 自审计失败，请修复后再提交"; exit 1; }
