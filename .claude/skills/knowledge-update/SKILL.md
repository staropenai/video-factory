---
name: knowledge-update
description: 任务完成或失败后更新知识资产。当任务执行结束时调用：更新基线快照、MNK卡状态、踩坑记录。
---

# 知识更新流程

## 成功时执行
1. 刷新基线：更新 docs/baselines/latest.json
   - 记录：时间、commit hash、测试数、TS错误数
2. 更新 MNK 卡：找到对应模块的 audit/mnk_cards/*.md，更新状态列
3. 提交：git add docs/ audit/ && git commit -m "docs: 更新知识资产 [TASK-ID]"

## 失败时执行
1. 追加 pitfall 记录到 docs/pitfall_registry.md
   格式：## [PIT-日期-序号] 失败描述
   必填：触发条件/根本原因/修复方案/预防规则
2. 保存失败快照：docs/baselines/YYYY-MM-DD-fail.json
3. 标记任务未完成，不继续执行下一个任务

## 何时不需要更新
- 纯讨论（仅讨论，不执行）
- 文档只读（不涉及代码改动）
- 任务被证据门阻断（还未开始执行）
