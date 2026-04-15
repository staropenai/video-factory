# MNK — Rule System

**当前状态：** P2 规则系统重构完成 — prompt 分层、tighten-only 聚合器、5 层 memory 层级、声明式规则定义

## 不能碰（IP/LR）
- `RENDERING_SAFETY_RULES` / `UNDERSTANDING_SAFETY_RULES` 是不可变安全层，不能被动态上下文覆盖
- `aggregateRuleResults` 的 tighten-only 语义不能改成 last-writer-wins
- `PROTECTED_RULES`（high_risk_gate, escalation_gate）不允许被 team 级别禁用

## 关键文件（≤5）
1. `src/lib/ai/prompt-layers.ts` — 3 层 prompt 组合（安全→角色→动态上下文）
2. `src/lib/rules/priority.ts` — tighten-only 规则聚合器（替代 decide.ts 的 ad-hoc 循环）
3. `src/lib/rules/rule-definitions.ts` — 声明式规则定义（带版本号 + 审计信息）
4. `src/lib/rules/escalation-config.ts` — 21 个升级模式（EN/ZH/JA，每个有独立 ID）
5. `src/lib/context/memory-hierarchy.ts` — 5 层上下文层级（platform→team→user→page→case）

## 当前 P0（≤3 条）
1. `priority.ts` 已创建但 `decide.ts` 尚未切换到使用它（仍用旧的 last-writer-wins 循环）
2. `prompt-layers.ts` 已创建但 `understand.ts` / `generate.ts` 尚未切换到使用它（仍用旧的单体 prompt）
3. `rule-definitions.ts` 是声明式数据但缺少编译器（将定义编译为可执行 Rule 对象）

## 危险点
- `decide.ts` 有手动 safety override（L121: `if shouldEscalate && answerMode !== handoff`），切换到 `priority.ts` 时必须确认此逻辑被保留
- `official_only_gate`（priority 50）不能覆盖 `high_risk_gate`（priority 40）的 handoff — tighten-only 聚合器已解决此问题
