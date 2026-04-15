# MNK — Human Correction System

**当前状态：** P4 纠正系统上线 — POST/GET /api/corrections + GET /api/corrections/report 已部署

## 不能碰（IP/LR）
- CorrectionRecord 是 append-only 审计记录，不允许删除或修改已有记录
- correctionType 分类体系已定义，新增类型需要同步更新 CORRECTION_TYPES 数组

## 关键文件（≤5）
1. `src/lib/correction/types.ts` — CorrectionRecord / CorrectionType 类型定义
2. `src/lib/correction/store.ts` — JSONL 持久化（insert / list / markApplied）
3. `src/lib/correction/error-report.ts` — 错误归因报告生成器
4. `src/app/api/corrections/route.ts` — POST（提交纠正）/ GET（列表）
5. `src/app/api/corrections/report/route.ts` — GET 错误归因统计

## 当前 P0（≤3 条）
1. 纠正 API 无认证保护（任何人可 POST）— 需接入 admin-guard
2. `markCorrectionApplied` 用全文件重写（rewrite），高并发下有数据丢失风险
3. 前端无纠正提交 UI — 需要在 /review 页面添加纠正表单

## 危险点
- JSONL 存储在 Vercel `/tmp` 上冷启动会丢失 — Phase 2 需迁移到持久化存储
- error-report 的 `verifiedErrorRate` 计算：分母是 corrections 中 verified=true 的数量，不是全局 verified 回答总数
