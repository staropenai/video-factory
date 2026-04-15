
---
## 2026-04-15 全部完成 ✅

- privacy → 200 ✅
- terms → 200 ✅  
- verify-evidence → 200 ✅
- report → 200 ✅
- trust-center → 200 ✅
- TypeScript: 0 errors ✅

**新增预防规则 PIT-008：**
Vercel CLI 部署必须从 web/ 目录执行。
Dashboard Root Directory = . 时，根目录有两个 Next.js（staropenai_v2 和 web/），
CLI 会选错版本（14.x 而非 16.x）。
预防：每次 vercel --prod 前确认 CWD = web/，
验证：构建日志 "Detected Next.js version" 应为 16.x
