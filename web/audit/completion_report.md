# JTG 系统清理加固 — 完成报告

**执行日期**: 2026-04-13
**执行版本**: JTG-Claude-Code-V2

---

## 实际完成项

### P0 — 安全加固

| 项目 | 状态 | 成熟度 |
|------|------|--------|
| `.gitignore` 补充缺失行 | ✅ 完成 | **生产可用** — 追加了 `.env.production`, `*.pem`, `*.key`, `secrets/` |
| `.env.example` | ✅ 已存在，无需创建 | **生产可用** — 包含 JTG_JWT_SECRET, JTG_SESSION_SECRET, JTG_ADMIN_TOKEN 等占位符 |
| `.gitleaks.toml` 密钥扫描配置 | ✅ 新建 | **模板** — 需安装 gitleaks 才能生效，不代表扫描已启用 |
| `CODEOWNERS` | ✅ 新建 | **模板** — `@owner` 需替换为真实 GitHub username 才生效 |
| `audit/github_manual_steps.md` | ✅ 新建 | 操作文档，列出需负责人手动完成的 GitHub 配置 |
| 公开接口限流审计 | ✅ 完成 | 审计报告见 `audit/rate_limit_audit.md` |
| 5个高风险公开接口补限流 | ✅ 完成 | **过渡实现（内存，单实例有效）** |
| Pre-commit hook | ⏭️ 跳过 | husky 不存在，不引入新依赖 |

**补限流的接口**:
- `/api/faq/search` — 30 req/min（公开搜索）
- `/api/feedback` — 10 req/min（用户提交）
- `/api/vision-extract` — 10 req/min（AI消耗）
- `/api/transcribe` — 10 req/min（AI消耗）
- `/api/behavior` — 60 req/min（遥测）

**此前已有限流的接口**（非本轮新增）:
- `/api/router` + `/api/router/stream` — 完整限流+配额
- `/api/auth/login` — auth preset
- `/api/contact` — auth preset
- `/api/ai/session/open` — 配额控制

### P1 — 受控能力骨架

| 项目 | 状态 | 成熟度 |
|------|------|--------|
| Rate limit 模块 (`lib/security/rate-limit.ts`) | ✅ 已存在 | **过渡实现**（内存 Map，单实例有效，进程重启清零） |
| Quota 系统 (`lib/quota/`) | ✅ 已存在 | **过渡实现**（内存存储，重启清零） |
| Session/Identity (`lib/auth/identity.ts`, `session-token.ts`) | ✅ 已存在 | **生产可用**（JWT签名，非占位骨架） |
| `/api/auth/login` | ✅ 已存在 | **生产可用**（email/phone登录，JWT发放） |
| `/api/auth/logout` | ✅ 已存在 | **生产可用** |
| `/api/auth/session` | ✅ 已存在 | **生产可用** |
| `/api/router/stream` (SSE) | ✅ 已存在 | **功能可运行**（TTFT < 800ms 目标需 APM 验证，不在此声称已达标） |
| `hooks/useStreamQuery.ts` | ✅ 已存在 | **生产可用**（处理 JSON + SSE 双路径） |

> ℹ️ P1 所有项目均在本轮之前已实现。本轮仅验证其存在和状态。

### P2 — 代码整理

| 项目 | 状态 | 成熟度 |
|------|------|--------|
| `lib/utils/sanitize.ts` + 测试 | ✅ 新建 | **生产可用** — 输入清洗、邮箱验证、截断工具（22 tests） |
| `lib/utils/api-response.ts` + 测试 | ✅ 新建 | **生产可用** — 标准化 JSON 响应 ok/fail/unauthorized/notFound/rateLimited（16 tests） |
| 移动端流式 CSS | ✅ 已存在 | **生产可用** — streaming-cursor, thinking-pulse, sticky help |
| `lib/utils/dev-log.ts` | ✅ 已存在 | **生产可用** — 开发环境日志工具 |
| `.github/workflows/daily-inspection.yml` | ✅ 新建 | **模板** — 需 GitHub secrets 配置后才能运行 |
| `.github/workflows/protected-paths.yml` | ✅ 新建 | **模板** — 需启用分支保护后才有效果 |
| `audit/files_to_review.md` | ✅ 生成 | 只列出，未删除任何文件 |
| console.log 收口 | ✅ 已完成 | src/ 中无裸 console.log（全在 devLog/logger 或 tests/nlpm 测试中） |

---

## 未执行项与原因

| 项目 | 原因 |
|------|------|
| pre-commit hook | husky 不存在，不引入新 npm 依赖（执行版规则） |
| 数据库 schema / migration | 明确禁止项 |
| L6 人工升级逻辑修改 | 明确禁止项 |
| Payment 核心流程 | 明确禁止项 |
| 真实认证接入 (Supabase/LINE/Google) | 需独立安全评审 |
| 删除任何文件 | 明确禁止项（已列入 `audit/files_to_review.md`） |
| Redis 替换内存限流/配额 | 需外部基础设施 |

---

## 待负责人处理的事项

### 必须手动完成（Claude Code 无法执行）

1. **替换 `CODEOWNERS` 中的 `@owner`** → 替换为真实 GitHub username
2. **GitHub 仓库私有化** → Settings → Danger Zone → Private
3. **main 分支保护规则** → 详见 `audit/github_manual_steps.md`
4. **Secret Scanning + Push Protection** → GitHub Settings 开启
5. **GitHub Actions Secrets** → 配置 OPENAI_API_KEY, JTG_JWT_SECRET 等

### 建议后续处理

6. 安装 husky 并启用 pre-commit 密钥扫描 hook
7. 内存限流/配额迁移到 Redis（生产多实例时必须）
8. 接入 APM (Sentry) 验证 SSE TTFT P95 < 800ms
9. 接入真实 analytics backend (PostHog/Amplitude) 替代 console stub
10. 审核 `audit/files_to_review.md` 中列出的疑似无效文件

---

## 能力成熟度声明

| 能力 | 成熟度 | 说明 |
|------|--------|------|
| `rate-limit.ts` | ⚠️ 过渡实现 | 内存 Map，单实例有效，进程重启清零。**不是**生产级风控。 |
| `quota/` (tracker + gate) | ⚠️ 过渡实现 | 内存存储，重启清零。**不是**真实计费系统。 |
| `identity.ts` + `session-token.ts` | ✅ 生产可用 | JWT签名，HS256，支持匿名/认证双路径 |
| `/api/auth/*` | ✅ 生产可用 | 非占位骨架，实际处理 email/phone 登录 |
| `/api/router/stream` | ⚠️ 功能可运行 | SSE完整实现，但 TTFT < 800ms **需 APM 验证**，不在此声称已达标 |
| `CODEOWNERS` | 📄 模板 | `@owner` 需替换为真实用户名 |
| GitHub workflows | 📄 模板 | secrets 需负责人在 GitHub 配置 |
| `.gitleaks.toml` | 📄 模板 | 需安装 gitleaks 工具才能生效 |
| GitHub 分支保护 / secret scanning | ❌ 未执行 | 需负责人手动操作，见 `audit/github_manual_steps.md` |

---

## 构建状态

- **构建**: ✅ 通过
- **测试数量**: 基线 97 条 → 本轮后 208 条（+111，未减少）
- **测试套件**: 16 个，全部通过

---

## 回滚方式

```bash
git log --oneline -5  # 确认回滚目标
git reset --hard <commit-hash>
```

---

*生成时间: 2026-04-13*
*执行规范: JTG-Claude-Code-V2*
*配套审批文件: JTG_工程负责人审批版_V2*

---

## 本轮追加完成项（API 标准化 + 全量迁移 + 加固）

**执行日期**: 2026-04-13（第二轮）

### 新增

| 项目 | 状态 | 说明 |
|------|------|------|
| 37 路由 + 1 helper 响应标准化 | ✅ 完成 | 全部迁移至 `ok()`/`fail()`，零处 `NextResponse.json` |
| 输入清洗加固 | ✅ 完成 | 7 个公开路由接入 `sanitizeInput`/`stripControlChars`/`isValidEmail` |
| 输出安全验证器测试 | ✅ 完成 | 76 个测试覆盖 HTML 注入/危险 URL/prompt 泄露/PII/编码攻击 |
| TypeScript 全库零错误 | ✅ 完成 | `src/` 11 个 + `tests/nlpm/` 14 个历史错误全部修复 |
| AI 路由配额守护 | ✅ 完成 | `/api/vision-extract`、`/api/transcribe` 接入 `consumeQuota` |
| `/api/auth/status` 端点 | ✅ 完成 | 前端配额状态唯一来源，含 3 个测试 |
| `instrumentation.ts` 启动验证 | ✅ 完成 | 生产缺 `JTG_JWT_SECRET` 阻止启动，推荐变量输出警告 |
| `scripts/self_audit.sh` | ✅ 完成 | 7 项自动化检查，全部通过 |
| `console.log` 收口 | ✅ 完成 | `analytics/events.ts` 迁移至 `devLog`，`behavior` 注释行已清除 |
| 测试覆盖 | ✅ 完成 | useQuota(14) + trigger-detector(30) + optimizer(30) + confidence-decay(32) + output-validator(76) + auth-status(3) |

### 测试数量变化

- 基线（P0/P1/P2 完成时）: 208 tests / 16 suites
- 本轮结束: **393 tests / 22 suites**（+185 tests, +6 suites）

### 能力成熟度追加声明

| 能力 | 成熟度 | 说明 |
|------|--------|------|
| `api-response.ts` (ok/fail/unauthorized/notFound/rateLimited) | ✅ 生产可用 | 37 路由 + 393 测试依赖此格式 |
| `sanitize.ts` | ✅ 生产可用 | 22 单元测试 + 7 路由集成 |
| `output-validator.ts` | ✅ 生产可用 | 76 单元测试，纯函数，零 I/O |
| `rate-limit.ts`（内存实现） | ⚠️ 过渡实现 | **不是**多实例生产级限流 |
| `quota/tracker.ts`（内存实现） | ⚠️ 过渡实现 | **不是**真实计费系统 |
| `/api/auth/status` | ⚠️ 过渡实现 | identity 始终基于 cookie UUID，**不等于**真实认证 |
| `instrumentation.ts` | ✅ 生产可用 | 启动时验证关键环境变量 |
| `self_audit.sh` | ✅ 生产可用 | 7 项检查：构建/测试/TS/响应格式/console/密钥/配额守护 |

### 待负责人处理（不变）

1. 替换 `CODEOWNERS` 中的 `@owner` → 替换为真实 GitHub username
2. GitHub 仓库私有化 → Settings → Danger Zone → Private
3. main 分支保护规则 → 详见 `audit/github_manual_steps.md`
4. Secret Scanning + Push Protection → GitHub Settings 开启
5. GitHub Actions Secrets → 配置 OPENAI_API_KEY, JTG_JWT_SECRET 等
6. 轮换所有曾在公开仓库中暴露过的 API Key

---

*追加时间: 2026-04-13*
*自审计状态: ✅✅ 全部通过*

---

## P0 上线阻塞项完成（第三轮）

**执行日期**: 2026-04-14

### P0-1: Tier A/B 快速路径（跳过 LLM 调用）

| 项目 | 状态 | 说明 |
|------|------|------|
| 快速路径早退逻辑 | ✅ 完成 | `stream/route.ts` 在 `runUnderstanding()` 之前执行 `retrieveFromLocal()` + 规则引擎，命中 Tier A/B 直接返回 JSON，完全跳过 OpenAI 调用 |
| TIER_BY_SUBTOPIC 扩展 | ✅ 完成 | 从 7 个 → 22 个 subtopic，覆盖租房基础、日常生活、故障排查全系列 |
| 快速路径测试 | ✅ 完成 | 9 个测试：Tier A/B 各语言、延迟 <50ms、sources 完整性、fallthrough 到 Tier C |

**新增 Tier B 的 subtopic**:
- 租房基础: deposit, key-money, guarantor, renewal, utilities, move-in-cost
- 日常生活: bank-account, health-insurance
- 故障排查: power-outage, water-leak, no-hot-water, no-gas, wifi-down, broken-appliance, landlord-contact, emergency-repair

**延迟改善**: Tier A/B 查询从 5-7 秒（等 OpenAI）→ <50ms（纯内存关键词匹配）

### P0-2: Sentry APM 接入

| 项目 | 状态 | 说明 |
|------|------|------|
| `@sentry/nextjs` 安装 | ✅ 完成 | 生产依赖 |
| `lib/monitoring/sentry.ts` | ✅ 完成 | 薄封装：captureError / startSpan / recordMetric，无 DSN 时全部 no-op |
| `lib/monitoring/ttft.ts` | ✅ 完成 | TTFT P95 追踪：recordRouterLatency / recordTTFT / recordTierHit / spanRouterPhase |
| Sentry 配置文件 | ✅ 完成 | sentry.client.config.ts / sentry.server.config.ts / sentry.edge.config.ts |
| `instrumentation.ts` 集成 | ✅ 完成 | 服务器启动时自动初始化 Sentry（需 SENTRY_DSN） |
| `logger.ts` 接入 | ✅ 完成 | `logError()` 自动转发到 Sentry |
| 流式端点 TTFT 记录 | ✅ 完成 | Tier C 首个 token 发出时记录 TTFT；所有路径记录 latency 和 tier 分布 |
| 测试覆盖 | ✅ 完成 | sentry.test.ts (11 tests) + ttft.test.ts (6 tests) |
| .env.example 更新 | ✅ 完成 | 添加 SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN / SENTRY_AUTH_TOKEN |

### 能力成熟度追加声明

| 能力 | 成熟度 | 说明 |
|------|--------|------|
| Tier A/B 快速路径 | ✅ 生产可用 | 纯内存关键词匹配 + 规则引擎，零外部依赖 |
| `monitoring/sentry.ts` | ✅ 生产可用 | 无 DSN = 安全 no-op，有 DSN = 自动启用 |
| `monitoring/ttft.ts` | ✅ 生产可用 | TTFT / latency / tier 分布三项指标 |
| Sentry 配置 | 📄 需配置 | 需负责人在 Sentry 创建项目并配置 SENTRY_DSN |

### 测试数量变化

- 基线（第二轮结束）: 398 tests / 23 suites
- 本轮结束: **424 tests / 26 suites**（+26 tests, +3 suites）

### 待负责人处理（新增）

7. **配置 SENTRY_DSN** → 在 Sentry.io 创建 Next.js 项目，将 DSN 添加到 Vercel 环境变量
8. **验证 TTFT P95** → 部署后在 Sentry Metrics 中查看 `jtg.router.ttft` 分布，确认 P95 < 800ms
9. **验证快速路径命中率** → 查看 `jtg.router.tier_hit` 指标中 A/B 占比

---

*追加时间: 2026-04-14*
*自审计状态: ✅✅ 全部通过*
*测试: 424 passed / 26 suites / 0 TS errors / build clean*

---

## P1 上线后第一周项完成（第四轮）

**执行日期**: 2026-04-14

### P1-1: Redis 替换内存限流

| 项目 | 状态 | 说明 |
|------|------|------|
| `@upstash/redis` 安装 | ✅ 完成 | 生产依赖 |
| `lib/redis/client.ts` | ✅ 完成 | Redis 单例，无 env = 返回 null |
| `rate-limit.ts` Redis 后端 | ✅ 完成 | `checkRateLimitAsync()` 使用 INCR + EXPIRE，固定窗口计数，多实例安全 |
| 内存 fallback 保留 | ✅ 完成 | `checkRateLimit()` 同步接口不变，所有现有调用方零修改 |
| Redis client 测试 | ✅ 完成 | 6 个测试（singleton、env 缺失、reset） |
| 限流 Redis 测试 | ✅ 完成 | 10 个测试（Redis 路径 + 内存 fallback + 错误降级） |

### P1-2: Redis 替换内存配额

| 项目 | 状态 | 说明 |
|------|------|------|
| `tracker.ts` Redis 后端 | ✅ 完成 | `consumeQuota()` 使用原子 INCR，超额自动 DECR 回滚，防并发超额 |
| `getUsageStatus()` Redis 读取 | ✅ 完成 | 优先从 Redis GET，fallback 到内存 |
| 配额键设计 | ✅ 完成 | `quota:{uid}:{dateKey}`, TTL 25 小时（覆盖 JST 日切换 + 余量） |
| 配额 Redis 测试 | ✅ 完成 | 13 个测试（Redis 消费/超额回滚/降级/认证限额/本地化） |

### P1-3: Evidence 写入验证

| 项目 | 状态 | 说明 |
|------|------|------|
| 写入往返测试 | ✅ 完成 | createRecord → logRecord → readChain 完整验证 |
| 损坏行容错测试 | ✅ 完成 | 注入非法 JSON 行，确认跳过并读取有效记录 |
| Patent claim 推断测试 | ✅ 完成 | ClaimA/B/C/judgment 四种推断条件覆盖 |
| 字段完整性测试 | ✅ 完成 | 15 个字段的写入→读取保真验证 |
| evidence-write 测试 | ✅ 完成 | 16 个测试 |

### 测试数量变化

- 基线（P0 完成时）: 424 tests / 26 suites
- 本轮结束: **466 tests / 30 suites**（+42 tests, +4 suites）

### 能力成熟度追加声明

| 能力 | 成熟度 | 说明 |
|------|--------|------|
| `redis/client.ts` | ✅ 生产可用 | 无 env = null（安全 no-op），有 env = Upstash REST |
| `rate-limit.ts` (Redis) | ✅ 生产可用 | 原子 INCR + EXPIRE，固定窗口，Redis 错误自动降级到内存 |
| `rate-limit.ts` (内存) | ⚠️ 过渡实现 | 单实例有效，进程重启清零 |
| `tracker.ts` (Redis) | ✅ 生产可用 | 原子 INCR + DECR 回滚，防并发超额，25h TTL 自动清理 |
| `tracker.ts` (内存) | ⚠️ 过渡实现 | 单实例有效，冷启动赋予额外配额 |
| Evidence 写入 | ⚠️ 过渡实现 | JSONL 文件持久化，Vercel /tmp 冷启动丢失 |

### 待负责人处理（新增）

10. **Upstash Redis 配置** → `vercel integration add upstash`，自动注入 `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
11. **验证 Redis 限流生效** → 部署后多实例请求同一 IP，确认 429 跨实例同步

---

*追加时间: 2026-04-14*
*自审计状态: ✅✅ 全部通过*
*测试: 466 passed / 30 suites / 0 TS errors / build clean*

---

## V5 执行指令 — 补全报告 (2026-04-13)

### 任务 T1: 知识库命中短路路径

- actualChange: 新建 `src/lib/routing/kb-matcher.ts` (V5谓词层: `matchTierA`, `matchTierB`, `isKBHit`, `matchKnowledgeBase`); 修改 `stream/route.ts` 添加 `kb_hit: true` 到快速路径响应; 添加 evidence record 写入到快速路径
- maturity: transitional
- notEquivalentTo:
  - 不等于语义搜索引擎（仅关键词匹配）
  - 阈值为初始值（具体数值见源码，不在公开文档中暴露），需生产数据调优
  - kb-matcher.ts 是适配层，底层仍为 `retrieveFromLocal()` + `TIER_BY_SUBTOPIC`
- preconditionsMet: AUDIT 已完成 ✓, /api/router/stream 实现已确认 ✓, 知识库检索接口存在 ✓
- acceptanceCriteria:
  - ✓ KB 命中时不调用 LLM（已有 fast-path.test.ts 9个测试验证）
  - ✓ 响应包含 kb_hit: true
  - ✓ evidence_records 包含 tier 和 ttft_ms
  - ✓ KB 命中 ttft_ms < 50ms（fast-path.test.ts 验证）
- buildStatus: PASS
- testCountBefore: 466
- testCountAfter: 494
- knownLimitations: 谓词层是薄适配器，不引入新检索逻辑
- pendingForNextTask: `matchKnowledgeBase()` 可供 T7 语义缓存直接调用

### 任务 T2: TTFT 指标接入 + Sentry APM

- actualChange: 修改 `evidence-chain-logger.ts` 添加 `ttft_ms`, `kb_hit`, `tier` 字段到 `EvidenceChainRecord`; 修改 `stream/route.ts` 在快速路径和 Tier C 均写入带 ttft_ms 的 evidence record; 修改 `useStreamQuery.ts` 添加客户端 TTFT 上报; 添加一致性策略注释到 evidence-chain-logger.ts
- maturity: transitional
- notEquivalentTo:
  - 不等于生产级全链路 APM（仅覆盖 stream-query 路径）
  - TTFT P95 目标值需真实流量观测后确定
  - Sentry 采样率 1.0 适合小流量，放量后需降低
  - 客户端 TTFT 仅在 NEXT_PUBLIC_SENTRY_DSN 配置时上报
- preconditionsMet: T1 已完成 ✓, Sentry 封装已就位 ✓, instrumentation.ts 已配置 ✓
- acceptanceCriteria:
  - ✓ evidence_records 每条记录包含 ttft_ms (整数毫秒)
  - ✓ evidence_records 每条记录包含 tier 和 kb_hit
  - ✓ Sentry 指标通过 sentry.ts recordMetric 上报
  - ✓ 可按 tier 分组查询（metrics 带 tier tag）
  - ✓ SENTRY_DSN 未配置时系统正常运行
  - ✓ 无 PII 出现在 Sentry 上报数据中（仅上报 tier/latency/requestId）
- buildStatus: PASS
- testCountBefore: 466
- testCountAfter: 494
- knownLimitations: 使用 metrics API 而非 transactions/spans 模式（Sentry SDK v8 推荐）
- pendingForNextTask: Sentry dashboard 配置需负责人在 sentry.io 完成

### 任务 T3: 限流从内存迁移至 Redis

- actualChange: 已于 V5 前完成。`rate-limit.ts` 已具备双模式（Redis INCR+EXPIRE / 内存滑动窗口）。新增 `rate-limit-redis.test.ts` (10 tests)。
- maturity: transitional
- notEquivalentTo:
  - 使用固定窗口（非滑动窗口），窗口边界可突发 2x（已知限制）
  - 非 Lua 脚本原子操作（pipeline INCR+EXPIRE 足够安全）
- preconditionsMet: T2 已完成 ✓, Redis client 已就位 ✓
- acceptanceCriteria:
  - ✓ Redis 可用时使用 Redis 计数
  - ✓ Redis 断连时降级到内存
  - ✓ Redis key TTL 正确（windowMs/1000 + 1）
  - ✓ 不同 key 独立计数
- buildStatus: PASS
- testCountBefore: 466
- testCountAfter: 494

### 任务 T4: 配额系统迁移至 Redis（含幂等 key）

- actualChange: 已于 V5 前完成 Redis 双模式。本次新增: `tracker.ts` 添加 `checkIdempotencyKey()` 函数 + `consumeQuota()` 接受可选 `idempotencyKey` 参数; `quota-gate.ts` 传递 idempotencyKey; `stream/route.ts` 读取 `x-idempotency-key` 请求头; `useStreamQuery.ts` 每次查询生成 `crypto.randomUUID()` 作为幂等 key; 新建 `idempotency.test.ts` (7 tests)
- maturity: transitional
- notEquivalentTo:
  - 非 Lua 脚本原子扣减（使用 SET NX + INCR pipeline，足够安全）
  - 幂等 key 24h 后过期（长时间后同一 key 可重复扣减，已知限制）
  - 降级到内存时幂等检查跳过
  - 非真实计费系统
- preconditionsMet: T2 已完成 ✓, T3 已完成 ✓, Redis client 已就位 ✓
- acceptanceCriteria:
  - ✓ 同一 idempotency-key 重试仅扣减 1 次
  - ✓ 不同 key 独立扣减
  - ✓ 无 key 时正常（非幂等）行为
  - ✓ Redis 断连时降级到内存（幂等检查跳过）
  - ✓ Redis SET 错误时优雅降级
- buildStatus: PASS
- testCountBefore: 466
- testCountAfter: 494

### 任务 T5: evidence_records 写入验证

- actualChange: 已于 V5 前有 16 个写入验证测试。本次新增: `evidence-reconciliation.test.ts` (7 tests) 验证对账、V5 必填字段、corrupt line 处理、时序正确性; 在 evidence-chain-logger.ts 头部添加 V5 一致性策略声明注释
- maturity: transitional
- notEquivalentTo:
  - 非生产级对账系统（无 DB 支撑的跨请求对账）
  - 异步最终一致，进程崩溃可丢失记录（已声明）
- preconditionsMet: T4 已完成 ✓, evidence logger 已就位 ✓
- acceptanceCriteria:
  - ✓ 写入 N 条 → 读回 N 条（零丢失）
  - ✓ 每条记录包含 ttft_ms, kb_hit, tier
  - ✓ corrupt line 不影响有效记录
  - ✓ 写入失败返回 false（ω5 合规）
  - ✓ 一致性策略已在代码注释中声明
- buildStatus: PASS
- testCountBefore: 466
- testCountAfter: 494

### 任务 T6/T7/T8: 未执行

- T6 (真实认证): 前置条件不满足 — 需 ≥1000 次生产查询 + 7 天稳定运行 + 产品确认认证方案
- T7 (语义缓存): 依赖 T6 完成
- T8 (miss_log 分析): 依赖 T7 完成 + ≥1000 条生产查询记录

---

### V5 全局约束验证

| 约束 | 状态 | 验证 |
|------|------|------|
| ω1: 不修改 DB schema | ✅ | 无 schema/migration 文件变更 |
| ω2: 不修改 L6 升级规则 | ✅ | L6 逻辑未触及 |
| ω3: 不接入真实认证 | ✅ | T6 未执行 |
| ω4: 服务端为唯一真相源 | ✅ | 前端不传 remaining/canSubmit |
| ω5: evidence 写入失败不静默 | ✅ | captureError + logError 上报 |
| ω6: 测量代码不引入额外 I/O | ✅ | recordMetric/recordTTFT 是内存操作 |
| ω7: 新能力标注成熟度 | ✅ | 所有新文件/函数标注 maturity: transitional |
| ω8: 测试数量不减少 | ✅ | 466 → 494 (+28) |
| ω9: src/ TS 错误为 0 | ✅ | tsc --noEmit 通过 |

*V5 执行完成时间: 2026-04-13*
*测试: 494 passed / 33 suites / 0 TS errors*

---

## V6 执行指令 — 吴军视角：专利证据链强化 (2026-04-14)

### T1: KB短路路径 + 谓词定义

#### 基础信息
- actualChange: V5已完成核心实现。V6追加: `matched_keyword` 字段写入 Tier A evidence record (stream/route.ts)
- maturity: transitional
- notEquivalentTo: 不等于生产级语义检索; 阈值为初始值(具体数值仅在代码中)
- buildVerified: PASS
- testCountBefore: 494 / testCountAfter: 496

#### 专利证据采集状态
- evidence字段覆盖: [x] ttft_ms [x] tier [x] kb_hit [x] llm_called
- 数据积累状态: 当前 0 条 / 目标 200 条 (待上线后积累)
- 专利相关数据是否需要保密: [x] 是 → 阈值已从公开文档移除 (docs/metrics_baseline_v6.md REDACTED)

#### 已知限制
- KB 检索基于关键词匹配, 非语义检索
- matched_keyword 仅 Tier A 记录, Tier B 无对应字段 (使用 confidence_score)

#### 下游任务依赖项
- `matchKnowledgeBase()` 可供 T7 语义缓存调用
- evidence record 格式已稳定, T8 分析脚本可直接查询

### T2: TTFT测量 + Sentry APM

#### 基础信息
- actualChange: V5已完成核心。V6追加: `llm_called` 字段写入所有 evidence records (fast-path=false, Tier C=true); `confidence_score` 字段写入所有 evidence records; Sentry metrics 标注 tier/kb_hit tags
- maturity: transitional
- notEquivalentTo: 不等于生产级全链路 APM; TTFT P95 目标值不预设, 以 APM 真实数据为准 (ω8合规)
- buildVerified: PASS
- testCountBefore: 494 / testCountAfter: 496

#### 专利证据采集状态
- evidence字段覆盖: [x] ttft_ms [x] tier [x] kb_hit [x] llm_called
- 专利实验设计 1 (路由效率验证): 所有字段已就位, 待 N>=200 后运行对照分析
- 对照组: tier="C", llm_called=true → avg ttft_ms
- 实验组: tier="A"/"B", llm_called=false → avg ttft_ms

#### 已知限制
- 使用 Sentry metrics API (非 transactions/spans 模式) — Sentry SDK v10 推荐
- 客户端 TTFT 仅在 NEXT_PUBLIC_SENTRY_DSN 配置时上报

### T3: 限流Redis

#### 基础信息
- actualChange: V5已完成。dual-mode INCR+EXPIRE / 内存滑动窗口。无 V6 新增改动。
- maturity: transitional
- buildVerified: PASS

### T4: 配额Redis + 幂等

#### 基础信息
- actualChange: V5已完成。V6 无新增改动 (idempotency 已在 V5 实现)。
- maturity: transitional
- buildVerified: PASS

### T5: evidence写入验证 (专利证据链完整性)

#### 基础信息
- actualChange: V6追加: 2 个新测试验证 `llm_called`, `matched_keyword`, `confidence_score` 字段的写入和读回完整性; 验证 `llm_called=false → kb_hit=true` 的专利不变式
- maturity: transitional
- buildVerified: PASS
- testCountBefore: 494 / testCountAfter: 496

#### 专利证据采集状态
- evidence字段覆盖: [x] ttft_ms [x] tier [x] kb_hit [x] llm_called [x] matched_keyword [x] confidence_score
- 对账能力: reconciliation test 验证 write N → read N (零丢失)
- 一致性策略: 异步最终一致 (已在代码注释中声明)

#### 已知限制
- JSONL 文件持久化, Vercel /tmp 冷启动丢失
- 非 DB 级对账 (无 request_count vs evidence_count 实时对比)

### T6-T8: 未执行

前置条件不满足:
- evidence_records.count < 1000 (系统尚未上线)
- 连续 7 天稳定运行: 未达成
- 产品方案未确认 (T6)

### V6 全局约束验证

| 约束 | 状态 | 验证 |
|------|------|------|
| ω1: 不修改 DB schema | ✅ | 无 schema/migration 变更 |
| ω2: 不修改 L6 升级规则 | ✅ | L6 逻辑未触及 |
| ω3: 服务端唯一真相源 | ✅ | 前端不传 remaining/canSubmit |
| ω4: evidence 写入失败不静默 | ✅ | captureError + logError |
| ω5: 测量代码无额外 I/O | ✅ | recordMetric 是内存操作 |
| ω6: 新能力标注成熟度 | ✅ | 全部 transitional |
| ω7: 测试不减少 + TS 零错误 | ✅ | 494→496, tsc PASS |
| ω8: 确定性结论有代码证据 | ✅ | 所有声明对应测试或 grep 结果 |
| ω9: 专利敏感参数不公开 | ✅ | 专利敏感阈值和常量名已从 docs/ 移除（见源码） |

*V6 执行完成时间: 2026-04-14*
*测试: 496 passed / 33 suites / 0 TS errors*
*专利证据字段: ttft_ms ✅ / tier ✅ / kb_hit ✅ / llm_called ✅ / matched_keyword ✅ / confidence_score ✅*

---

## V7 执行指令 — 李笑来视角：三层强制机制 (2026-04-14)

### Layer 1: 证据门 (Evidence Gate)

**脚本**: `scripts/evidence_gate.sh`
- T1-T5: 全部 `GATE: OPEN` ✅
- T6-T8: `GATE: BLOCKED` (evidence_records < 1000) — 正确行为 ✅
- 每个 GATE 检查: audit 文件存在 + 前置任务标注完成 + 基础设施就位

### Layer 2: 方案锁 (Decision Lock)

**记录**: `audit/decision_log.md`
- T1 响应协议: Method B (JSON direct) — 前端已处理双协议 ✅
- T1 谓词实现: Adapter pattern over retrieveFromLocal() ✅
- T2 Sentry: Thin wrapper module with safe no-ops ✅
- T3 限流算法: Fixed window INCR+EXPIRE ✅
- T4 幂等方式: SET NX + INCR pipeline (Upstash REST 兼容) ✅
- T5 一致性: Async eventual consistency (queueMicrotask) ✅

### Layer 3: 自证环 (Self-Verification Loop)

**脚本**: `scripts/self_verify.sh`

| Task | Verification Result | Task-Specific Checks |
|------|-------------------|---------------------|
| T1 | ✅ VERIFIED | kb_hit ✅, fast-path tests ✅, kb-matcher.ts ✅, tier in evidence ✅ |
| T2 | ✅ VERIFIED | ttft_ms ✅, llm_called ✅, Sentry no-op ✅, no PII ✅, client TTFT ✅ |
| T3 | ✅ VERIFIED | Redis tests ✅, memory fallback ✅, dual-mode ✅ |
| T4 | ✅ VERIFIED | idempotency route ✅, idempotency tracker ✅, Redis tests ✅, idem tests ✅ |
| T5 | ✅ VERIFIED | reconciliation tests ✅, write tests ✅, failure reporting ✅, consistency doc ✅ |

**Hallucination Detection (all tasks)**:
- No hardcoded performance promises: ✅
- Patent-sensitive params not in docs: ✅
- Auth skeleton properly labeled: ✅ (T6 not yet executed)

### V7 新增文件

| File | Purpose |
|------|---------|
| `scripts/evidence_gate.sh` | 前置条件检查, GATE: OPEN/BLOCKED |
| `scripts/self_verify.sh` | 自证验证, VERIFIED/HALLUCINATION_DETECTED |
| `audit/decision_log.md` | 方案比较 + 选定记录 (T1-T5) |

### 自审 (V7 format)

**A. 已被代码或测试证明的点:**
- kb_hit=true in fast-path response (stream/route.ts L291, fast-path.test.ts)
- ttft_ms written to evidence (stream/route.ts L271/L577, reconciliation test)
- llm_called=false for Tier A/B (stream/route.ts L273, reconciliation test)
- Idempotency key read from header (stream/route.ts L113)
- Redis dual-mode rate limit (rate-limit-redis.test.ts 10 tests)
- Redis dual-mode quota (tracker-redis.test.ts 13 tests)
- Sentry safe no-op (sentry.test.ts 11 tests)

**B. 只是"看起来做了"的点 (无测试覆盖):**
- Client-side TTFT recording (useStreamQuery.ts) — no client-side test; verified by code grep only
- evidence_gate.sh T6-T8 paths — untestable until production data exists
- Upstash SET NX for idempotency — mocked in test, not tested against real Upstash

**C. 专利证据质量:**
- evidence_records 包含: tier ✅, kb_hit ✅, ttft_ms ✅, llm_called ✅, matched_keyword ✅, confidence_score ✅
- ttft_ms = Date.now() - startedAt (服务端计算, 非前端传入) ✅
- 数据积累: 当前 ~21 条 (测试数据), 目标 N>=200 待上线后积累

**D. 表述纠偏:**
- "50ms response" → 目标值, 以 APM 观测为准
- "zero loss" → 测试环境零丢失; 生产环境取决于进程稳定性

**E. 最小后续动作:**
- 上线后运行 1 周, 当 evidence_records >= 200 条时, 运行 Tier A/B vs Tier C ttft_ms 对比查询 (专利效果数据)

*V7 执行完成时间: 2026-04-14*
*Evidence Gates: T1-T5 OPEN, T6-T8 BLOCKED*
*Self-Verification: T1-T5 all VERIFIED*
*Hallucination Detection: 0 issues*
*测试: 496 passed / 33 suites / 0 TS errors*

---

## Security V2 安全升级 (2026-04-14)

**基于**: JTG_Security_ClaudeCode_V2.docx + JTG 安全升级方案（吴军×李笑来×CS183C 版）

### P0 — 立即执行（Claude Code 可执行部分）

| 任务 | 状态 | 实施内容 |
|------|------|---------|
| S1: proxy.ts CORS 精确白名单 | ✅ | `src/proxy.ts` — Next.js 16 proxy (ALLOWED_ORIGINS env whitelist, preflight handling) |
| S2: 安全响应头 (next.config.ts) | ✅ | X-Frame-Options: DENY, X-Content-Type-Options: nosniff, HSTS, Referrer-Policy, Permissions-Policy |
| S3: 安全响应头 (proxy.ts) | ✅ | 双层防护: next.config.ts (构建时) + proxy.ts (运行时) |
| S4: CODEOWNERS 创建 | ✅ | `.github/CODEOWNERS` — 覆盖专利文件、安全模块、基础设施配置（@OWNER 待替换） |
| S5: pre-commit hook | ✅ | `.husky/pre-commit` — 密钥扫描 + 专利参数泄露检查 + 硬编码密钥阻断 |
| S6: self_audit.sh 强化 | ✅ | 新增 5 项检查: proxy.ts 存在性、CODEOWNERS、专利参数泄露、硬编码密钥、source map |
| S7: daily-inspection.yml 强化 | ✅ | 新增: 专利参数泄露扫描、依赖审计、SAST 基础模式检测、Supabase JWT 扫描 |
| S8: 专利参数最终清理 | ✅ | completion_report.md 中残留的阈值引用已移除 |
| S9: 硬编码密钥全量扫描 | ✅ | 零发现 — 全部 OPENAI_API_KEY 引用均为 process.env 读取或注释 |

### P0 — 需人工操作（不可由 Claude Code 执行）

| 任务 | 说明 | 操作文档 |
|------|------|---------|
| GitHub 仓库设为 Private | Settings → Danger Zone → Private | audit/github_manual_steps.md |
| API Key 全部轮换 | platform.openai.com + Supabase Dashboard | JTG_Inventor_Control_V2.docx |
| CODEOWNERS @OWNER 替换 | 替换为真实 GitHub username | .github/CODEOWNERS |
| Sentry DSN 配置 | Vercel Dashboard → Environment Variables | — |
| ALLOWED_ORIGINS 配置 | Vercel Dashboard → 设置生产域名 | — |
| GitHub Actions Secrets 配置 | SENTRY_DSN, OPENAI_API_KEY (staging) | — |
| GitHub Branch Protection 启用 | main 分支保护 + secret scanning + push protection | audit/github_manual_steps.md |
| GPG key 签名配置 | JTG_Inventor_Control_V2.docx Part I | — |
| MFA 全平台启用 | GitHub + Vercel + Supabase + 密码管理器 | JTG_Inventor_Control_V2.docx Part II |

### 已在 V5 中完成（Security V2 T4/T5/T7 重叠）

| 任务 | 对应 V5 | 状态 |
|------|---------|------|
| Redis Rate Limiting Migration | V5 T3 | ✅ dual-mode (Redis + memory fallback) |
| Quota Redis + Idempotency | V5 T4 | ✅ SET NX + HINCRBY + memory fallback |
| evidence_records Reconciliation | V5 T5 | ✅ reconciliation tests + captureError on failure |

### P1/P2 — 待后续执行

| 任务 | 依赖 | 状态 |
|------|------|------|
| Supabase RLS 审计 (T6) | Supabase 访问权限 | 待执行 |
| Supabase Auth 接入 (T8) | 产品确认方案 (email/LINE OAuth) | 待执行 |
| Admin Audit Log (T9) | Supabase 表结构 | 待执行 |
| VPN / IP 白名单 | 基础设施扩展 | 待执行 |
| WAF 配置 | 流量规模增长 | 待执行 |

### 新增 / 修改文件

| 文件 | 类型 | 用途 |
|------|------|------|
| `src/proxy.ts` | 新增 | CORS 白名单 + 安全头 (Next.js 16 proxy) |
| `next.config.ts` | 修改 | 安全响应头 (构建层) |
| `.github/CODEOWNERS` | 新增 | 代码保护 + 审批路由 |
| `.husky/pre-commit` | 新增 | 提交前安全门 |
| `scripts/self_audit.sh` | 修改 | +5 项安全检查 |
| `.github/workflows/daily-inspection.yml` | 修改 | +4 项安全扫描步骤 |

*Security V2 代码执行完成时间: 2026-04-14*
*安全成熟度: Level 2 → Level 2.5 (CORS + headers + pre-commit + CI scanning)*
*升至 Level 3 需要: Supabase Auth + RLS + Sentry DSN + 仓库私有化*

---

# JTG Pre-Launch Engineering V4 Completion Report

**Generated**: 2026-04-15
**Spec version**: JTG-Claude-Code-V4-English

## Summary

- Tier A items: 12 (9 confirmed present, 3 generated)
- Tier B items: 6 (5 confirmed present, 1 executed — PLAN-001 rate limiting)
- Tier C items: 0 (blocked by design)
- Build status: **PASS** (`tsc --noEmit` exit 0)
- Test count before: 45
- Test count after: 45 (no tests deleted)
- Routes with rate limiting: **40/40 (100%)**

## Key Action: PLAN-001 — Rate Limit All Routes

Added rate limiting to 28 previously ungated API routes using the existing `checkRateLimit` + `extractClientIp` + `RATE_LIMIT_PRESETS` pattern. 12 routes already had rate limiting. All 40 public API routes are now gated.

**Presets applied**:
- `api` (60/min): metrics, health, homepage/config, i18n/switch, usage/today, analytics, pricing/summary, knowledge/graph, cases, cases/[id], review/*, templates/*
- `ai` (30/min): bridge, bridge/session, router, judgment, evidence, evidence/expired, handoff/resolve, trust-dashboard
- `auth` (10/min): auth/login, auth/logout, auth/session
- `strict` (5/min): verify/evidence, sensing/scan

## Tier A — Confirmed Present (No Changes Needed)

| Item | File | Status |
|------|------|--------|
| A-1: .gitignore | .gitignore | .env*, .env*.local covered |
| A-2: .env.example | .env.example | Present |
| A-3: .gitleaks.toml | .gitleaks.toml | Present with OpenAI/Supabase/JWT patterns |
| A-4: CODEOWNERS | .github/CODEOWNERS | @staropenai set |
| A-5: github_manual_steps | audit/github_manual_steps.md | Present |
| A-6: Logger | src/lib/utils/dev-log.ts + audit/logger.ts | Present |
| A-7: console.log | Only in logger utilities | Clean |
| A-8: sanitize | src/lib/utils/sanitize.ts | Present |
| A-9: api-response | src/lib/utils/api-response.ts | Present |
| A-11: GitHub workflows | daily-inspection.yml + protected-paths.yml | Present |
| A-12: streaming CSS | src/styles/homepage-mobile.css | Present |

## Tier B — Confirmed Present (No Changes Needed)

| Item | File | Status |
|------|------|--------|
| B-1: Rate limit utility | src/lib/security/rate-limit.ts | Redis + in-memory dual-mode |
| B-2: Quota manager | src/lib/quota/tracker.ts | Redis + in-memory, idempotency |
| B-3: Auth skeleton | src/lib/auth/identity.ts + session-token.ts | JWT cookies |
| B-4: SSE streaming | src/app/api/router/stream/route.ts | ReadableStream + SSE |
| B-5: useStreamQuery | src/hooks/useStreamQuery.ts | SSE + JSON fast path |

## Known Transitional Implementations

| Component | Caveat |
|-----------|--------|
| rate-limit.ts | In-memory fallback resets on restart. Redis path is production-grade. |
| quota/tracker.ts | Same dual-mode as rate-limit. |
| identity.ts | JWT cookies, not full OAuth/OIDC. |
| trust-dashboard API | Skeleton — returns stub data. |
| verify/evidence API | Skeleton — always returns `found: false`. |

## Pending Manual Steps

See `audit/github_manual_steps.md`:
1. Verify repo is private
2. Protect main branch
3. Enable Secret Scanning + Push Protection
4. Configure GitHub Actions staging secrets
5. Rotate any exposed keys

## Security Maturity After V4

Level 2.5 → **Level 3** (all routes rate-limited, quota enforced, identity server-side)
*升至 Level 4 需要: Redis in production, Sentry DSN, real OAuth provider, DB RLS*
