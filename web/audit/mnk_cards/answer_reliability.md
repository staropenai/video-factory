# MNK — Answer Reliability System

**当前状态：** P1 answer reliability 全链路上线，每个 API 回答附带 answerMeta（类型/验证/证据/升级）

## 不能碰（IP/LR）
- 不得移除 tighten-only 约束（AI 只能升级风险，不能降级）
- 不得绕过 validateAnswerMeta（unverified 必须显式标记）
- 不得删除 escalation 安全门（high_risk_gate / escalation_gate 是 safety-critical）

## 关键文件（≤5）
1. `src/lib/answer-reliability/classify.ts` — 分类器：从 RouterDecision 推导 answer_type
2. `src/lib/answer-reliability/validators.ts` — 验证器 + 虚假确定性检测
3. `src/lib/answer-reliability/types.ts` — AnswerMeta / AnswerType / EvidenceBinding
4. `src/app/api/router/route.ts` — 同步路由（已接入 answerMeta + audit + quality）
5. `src/app/api/router/stream/route.ts` — SSE 路由（4 个响应路径全部接入）

## 当前 P0（≤3 条）
1. classifyAnswer 依赖 RetrievalSummary.topScore 阈值 0.7 — 需要用线上数据校准
2. detectFalseClaims 只覆盖 EN/ZH/JA 三语 — 缺少 KO/VI/TH
3. 前端尚未消费 answerMeta 字段（仅 API 返回，UI 未渲染可信度标识）

## 危险点
- `.vercelignore` 的 `audit/` 模式会匹配 `src/lib/audit/` → 导致 28 个 module-not-found 构建失败（PIT-009）
- classifyAnswer 的 escalation 判断必须在 shortcut 判断之前，否则 handoff 会被 Tier A 覆盖
