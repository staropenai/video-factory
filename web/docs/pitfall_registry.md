
---

## [PIT-008] Vercel CLI 从错误目录部署选中旧版 Next.js

**发现时间：** 2026-04-15
**状态：** 🟢 已根治

**触发条件：** 在仓库根目录执行 vercel --prod，而非 web/ 目录

**根本原因：** 仓库根目录存在 staropenai_v2/（Next.js 14.2.3）和 web/（Next.js 16.2.3）两个 Next.js 项目。Dashboard Root Directory = .，CLI 从根目录执行时选中了错误的版本。

**修复方案：** 进入 web/ 目录再执行 vercel --prod

**预防规则：** 每次部署前 pwd 确认在 web/；检查构建日志 "Detected Next.js version" = 16.x

**代价：** 多次构建失败，约 2 小时调试时间
