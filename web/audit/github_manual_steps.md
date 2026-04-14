# GitHub 平台手动配置项（Claude Code 无法代为执行）

## 必须由仓库 Owner 手动完成

### 1. 仓库可见性
Settings → Danger Zone → Change repository visibility → Private

### 2. main 分支保护规则
Settings → Branches → Add rule → Branch name pattern: main
- [x] Require a pull request before merging（Required approvals: 1）
- [x] Require status checks to pass（添加：build, test, typecheck）
- [x] Do not allow bypassing the above settings
- [x] Allow force pushes: 关闭
- [x] Allow deletions: 关闭

### 3. Secret Scanning + Push Protection
Settings → Security → Code security and analysis
- [x] Secret scanning: Enable
- [x] Push protection: Enable

### 4. 更新 CODEOWNERS
将 CODEOWNERS 文件中所有 `@owner` 替换为真实 GitHub username

### 5. 确认 GitHub Actions secrets
Settings → Secrets and variables → Actions
确认以下 secret 已配置（staging 环境）：
- `OPENAI_API_KEY` (or `OPENAI_API_KEY_STAGING`)
- `JTG_JWT_SECRET`
- `JTG_ADMIN_TOKEN`
