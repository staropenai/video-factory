---
name: jtg-constraints
description: JTG 项目约束规则。在处理 japan-trust-gateway 项目的任务时自动加载。包含 IP/LR/IT 分层约束、禁止词表、证据门标准。
---

# JTG 项目约束（自动加载）

## 执行权限层级
IP（不可动）> LR（需授权）> IT（可优化）> 任务

## 固定原则（IP）— 违反立即停止
- IP-1: 不修改 DB schema/migration/DB访问层
- IP-2: 不修改 L6 人工升级路由
- IP-3: session.ts 保持骨架
- IP-4: remaining/canSubmit/identityType/riskLevel 唯一来源为服务端
- IP-5: evidence_write_failed 必须对用户可见
- IP-6: 测试数量不得减少
- IP-7: 构建通过，TypeScript 错误为 0
- IP-8: 禁止硬编码密钥/联系方式
- IP-9: 禁止词 → 100%可信/官方认证/政府合作/区块链保护/绝对安全

## 固定需求（LR）— 需授权才能变更
- LR-1: 首页三入口（1主CTA绿卡+2次级卡）
- LR-2: ZONE-1 损失厌恶横幅必须渲染（数据来自法务省39.3%）
- LR-3: 三步引导条默认折叠
- LR-4: FAQ Tab = 租房准备/申请与签约/入住后问题/生活
- LR-5: 外部链接标注「外部链接 ↗」
- LR-6: 联系渠道通过环境变量注入
- LR-7: 确认条 inline，禁止 position:fixed
- LR-9: 页脚4个路由有效（privacy/terms/verify-evidence/report）
- LR-10: 所有交互元素 min-height: 44px

## 证据门标准
有效证据必须：可复现 + 可独立验证 + 可定位（文件路径/命令输出）
无效：「应该在这里」「上次似乎修过」「我记得」

## 变更关键词
- 升级固定原则 → 可改 IP
- 变更固定需求 → 可改 LR
- 优化可迭代部分 → 可改 IT
