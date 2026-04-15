# MNK — Security Hardening

**当前状态：** P0 安全加固 + P3 审计验证 + P4 纠正系统全部上线，Supabase RLS 脚本已生成待执行

## 不能碰（IP/LR）
- `productionBrowserSourceMaps: false` 不能改为 true（客户端 source map 泄露源码）
- `.vercelignore` 的 `/audit/` 必须带前缀斜杠（否则匹配 `src/lib/audit/`）
- 纠正记录是 append-only（不能删除已有的 CorrectionRecord）

## 关键文件（≤5）
1. `web/next.config.ts` — `productionBrowserSourceMaps: false` 钉死
2. `web/.vercelignore` — 部署排除规则（`/audit/` 不是 `audit/`）
3. `src/lib/audit/answer-audit.ts` — 每个回答的结构化审计记录
4. `src/lib/validation/answer-quality.ts` — 质量门（空答案/长度/prompt 泄露/语言一致性）
5. `src/lib/correction/store.ts` — 人工纠正 JSONL 持久化

## 当前 P0（≤3 条）
1. Supabase RLS 修复脚本 `docs/security/supabase-rls-fix.sql` 需要手动在 Dashboard 执行
2. `check-sourcemaps.sh` 和 `check-bundle-leaks.sh` 尚未加入 CI pipeline
3. answer-audit 目前是 console.log — 生产需要对接 Axiom/Datadog

## 危险点
- PIT-009: `.vercelignore` 中 `audit/` 不带前缀斜杠 → 排除了 `src/lib/audit/` → 28 个 module-not-found（已修复为 `/audit/`）
- `check-bundle-leaks.sh` 不能用 `set -e`（grep 无匹配返回 exit 1 会中断脚本）
- macOS 的 grep 不支持 `-P`（Perl regex），必须用 `-E`（extended regex）
