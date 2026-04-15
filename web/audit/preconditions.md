# JTG Audit Preconditions
Generated: 2026-04-14T15:20:31Z

## 1. Directory tree (source files only)
./.patent-internal/params.ts
./jest.config.ts
./sentry.client.config.ts
./sentry.edge.config.ts
./sentry.server.config.ts
./src/__tests__/instrumentation.test.ts
./src/app/(jtg)/[locale]/error.tsx
./src/app/(jtg)/[locale]/faq/[id]/page.tsx
./src/app/(jtg)/[locale]/layout.tsx
./src/app/(jtg)/[locale]/page.tsx
./src/app/(jtg)/layout.tsx
./src/app/(main)/about/page.tsx
./src/app/(main)/cases/page.tsx
./src/app/(main)/contact/page.tsx
./src/app/(main)/layout.tsx
./src/app/(main)/page.tsx
./src/app/(main)/privacy/page.tsx
./src/app/(main)/review/page.tsx
./src/app/(main)/templates/page.tsx
./src/app/(main)/terms/page.tsx
./src/app/(main)/test/page.tsx
./src/app/(main)/try/page.tsx
./src/app/(main)/work/page.tsx
./src/app/api/ai/session/open/route.ts
./src/app/api/analytics/route.ts
./src/app/api/auth/login/__tests__/route.test.ts
./src/app/api/auth/login/route.ts
./src/app/api/auth/logout/route.ts
./src/app/api/auth/session/route.ts
./src/app/api/auth/status/__tests__/route.test.ts
./src/app/api/auth/status/route.ts
./src/app/api/behavior/route.ts
./src/app/api/bridge/route.ts
./src/app/api/bridge/session/route.ts
./src/app/api/cases/[id]/route.ts
./src/app/api/cases/route.ts
./src/app/api/contact/route.ts
./src/app/api/evidence/expired/route.ts
./src/app/api/evidence/route.ts
./src/app/api/faq/search/__tests__/route.test.ts
./src/app/api/faq/search/route.ts
./src/app/api/feedback/route.ts
./src/app/api/handoff/resolve/route.ts
./src/app/api/health/route.ts
./src/app/api/homepage/config/route.ts
./src/app/api/i18n/switch/route.ts
./src/app/api/judgment/route.ts
./src/app/api/knowledge/graph/route.ts
./src/app/api/metrics/route.ts
./src/app/api/pricing/summary/route.ts
./src/app/api/review/daily-summary/route.ts
./src/app/api/review/faq-candidates/[id]/publish/route.ts
./src/app/api/review/faq-candidates/[id]/route.ts
./src/app/api/review/route.ts
./src/app/api/review/stats/route.ts
./src/app/api/router/__tests__/quota-gate.test.ts
./src/app/api/router/quota-gate.ts
./src/app/api/router/route.ts
./src/app/api/router/stream/__tests__/fast-path.test.ts
./src/app/api/router/stream/__tests__/route.test.ts
./src/app/api/router/stream/route.ts
./src/app/api/sensing/scan/route.ts
./src/app/api/templates/[id]/route.ts
./src/app/api/templates/promote/route.ts
./src/app/api/templates/route.ts
./src/app/api/transcribe/route.ts
./src/app/api/trust-dashboard/route.ts
./src/app/api/usage/today/route.ts
./src/app/api/verify/evidence/route.ts
./src/app/api/vision-extract/route.ts
./src/app/layout.tsx
./src/components/QuotaDisplay.tsx
./src/components/homepage/AIResponseArea.tsx
./src/components/homepage/AIZone.tsx
./src/components/homepage/EvidenceModal.tsx
./src/components/homepage/ExternalPlatformLink.tsx
./src/components/homepage/HumanHelpSection.tsx
./src/components/homepage/ListingAnalysisZone.tsx
./src/components/homepage/StreamErrorBoundary.tsx
./src/components/homepage/TrustBadge.tsx
./src/components/homepage/TrustDashboard.tsx
./src/components/jtg/AiZone.tsx
./src/components/jtg/FaqZone.tsx
./src/components/jtg/FooterZone.tsx
./src/components/jtg/HeroZone.tsx
./src/components/jtg/HomePage.tsx
./src/components/jtg/HumanHelpZone.tsx
./src/components/jtg/NavBar.tsx
./src/components/jtg/TrustZone.tsx
./src/components/layout/footer.tsx
./src/components/layout/navigation.tsx
./src/components/trust/TrustTriangleCard.tsx
./src/hooks/__tests__/useStreamQuery.test.ts
./src/hooks/useStreamQuery.ts
./src/instrumentation.ts
./src/lib/ai/__tests__/generate-stream.test.ts
./src/lib/ai/__tests__/understanding-cache.test.ts
./src/lib/ai/fallback.ts
./src/lib/ai/generate-stream.ts
./src/lib/ai/generate.ts
./src/lib/ai/openai.ts
./src/lib/ai/prompts.ts
./src/lib/ai/question-quality.ts
./src/lib/ai/types.ts
./src/lib/ai/understand.ts
./src/lib/ai/understanding-cache.ts
./src/lib/analytics/conversion-tracker.ts
./src/lib/analytics/events.ts
./src/lib/analytics/useDwell.ts
./src/lib/audit/logger.ts
./src/lib/auth/__tests__/admin-guard.test.ts
./src/lib/auth/__tests__/session-token.test.ts
./src/lib/auth/admin-guard.ts
./src/lib/auth/identity.ts
./src/lib/auth/index.ts
./src/lib/auth/session-token.ts
./src/lib/bridge/friction-reducer.ts
./src/lib/bridge/scenarios.ts
./src/lib/bridge/state-machine.ts
./src/lib/candidate/state.ts
./src/lib/company.ts
./src/lib/db/tables.ts
./src/lib/domain/contracts.ts
./src/lib/domain/enums.ts
./src/lib/domain/knowledge-card.ts
./src/lib/domain/language-bridge.ts
./src/lib/domain/providers.ts
./src/lib/domain/writeback.ts
./src/lib/evidence/__tests__/trigger-detector.test.ts
./src/lib/evidence/registry.ts
./src/lib/evidence/trigger-detector.ts
./src/lib/guardrails/review.ts
./src/lib/hooks/__tests__/useQuota.test.ts
./src/lib/hooks/useQuota.ts
./src/lib/i18n/__tests__/pick-localized.test.ts
./src/lib/i18n/homepage.ts
./src/lib/i18n/index.ts
./src/lib/i18n/pick-localized.ts
./src/lib/i18n/types.ts
./src/lib/jtg/api.ts
./src/lib/jtg/faq-data.ts
./src/lib/jtg/locale.ts
./src/lib/jtg/mock.ts
./src/lib/jtg/track.ts
./src/lib/jtg/types.ts
./src/lib/judgment/registry.ts
./src/lib/knowledge/faq-sync.ts
./src/lib/knowledge/graph.ts
./src/lib/knowledge/overlay.ts
./src/lib/knowledge/retrieve.ts
./src/lib/knowledge/seed.ts
./src/lib/monitoring/__tests__/sentry.test.ts
./src/lib/monitoring/__tests__/ttft.test.ts
./src/lib/monitoring/sentry.ts
./src/lib/monitoring/ttft.ts
./src/lib/patent/__tests__/confidence-decay.test.ts
./src/lib/patent/__tests__/evidence-reconciliation.test.ts
./src/lib/patent/__tests__/evidence-write.test.ts
./src/lib/patent/baseline-comparison.ts
./src/lib/patent/claim-mapping.ts
./src/lib/patent/confidence-decay.ts
./src/lib/patent/evidence-chain-logger.ts
./src/lib/patent/f-lang.ts
./src/lib/patent/feedback-analyzer.ts
./src/lib/patent/metrics-collector.ts
./src/lib/patent/report.ts
./src/lib/patent/technical-effect-extractor.ts
./src/lib/pipeline/gap-detector.ts
./src/lib/pipeline/writeback-hooks.ts
./src/lib/quota/__tests__/idempotency.test.ts
./src/lib/quota/__tests__/response.test.ts
./src/lib/quota/__tests__/tracker-redis.test.ts
./src/lib/quota/__tests__/tracker.test.ts
./src/lib/quota/index.ts
./src/lib/quota/response.ts
./src/lib/quota/tracker.ts
./src/lib/redis/__tests__/client.test.ts
./src/lib/redis/client.ts
./src/lib/router/classify.ts
./src/lib/router/decide.ts
./src/lib/router/types.ts
./src/lib/routing/__tests__/kb-matcher.test.ts
./src/lib/routing/__tests__/optimizer.test.ts
./src/lib/routing/kb-matcher.ts
./src/lib/routing/layer-stats.ts
./src/lib/routing/metrics.ts
./src/lib/routing/optimizer.ts
./src/lib/rules/builtins.ts
./src/lib/rules/engine.ts
./src/lib/security/__tests__/output-validator.test.ts
./src/lib/security/__tests__/rate-limit-redis.test.ts
./src/lib/security/__tests__/rate-limit.test.ts
./src/lib/security/event-log.ts
./src/lib/security/output-validator.ts
./src/lib/security/prompt-injection.ts
./src/lib/security/rate-limit.ts
./src/lib/sensing/cluster.ts
./src/lib/session-context.tsx
./src/lib/style/output-guide.ts
./src/lib/types.ts
./src/lib/utils/__tests__/api-response.test.ts
./src/lib/utils/__tests__/dev-log.test.ts
./src/lib/utils/__tests__/sanitize.test.ts
./src/lib/utils/api-response.ts
./src/lib/utils/dev-log.ts
./src/lib/utils/sanitize.ts
./src/lib/validation/guardrails.ts
./src/proxy.ts
./tests/nlpm/jtg-bridge-friction.test.ts
./tests/nlpm/jtg-core.test.ts
./tests/nlpm/jtg-p1.test.ts
./tests/nlpm/jtg-p2.test.ts
./tests/nlpm/jtg-patent.test.ts
./tests/nlpm/jtg-spec.test.ts
./tests/nlpm/jtg-v6-p0.test.ts
./tests/nlpm/jtg-v6-p1.test.ts
./tests/nlpm/jtg-v6-trust.test.ts
./tests/nlpm/jtg-v7.test.ts
./tests/nlpm/jtg-v8.test.ts
./tests/nlpm/jtg-v9.test.ts
./tests/regression/runner.ts

## 2. Build entry & scripts
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "jest --passWithNoTests",
  "test:regression": "npx tsx tests/regression/runner.ts",
  "verify": "npm run build && npm run test:regression"
}

## 3. Test framework & count
test files: 45

## 4. Husky
pre-commit

## 5. GitHub Actions
daily-inspection.yml
protected-paths.yml

## 6. Auth / Session / Middleware
./.next/server/app/api/auth
./.next/server/app/api/auth/logout
./.next/server/app/api/auth/logout/route.js
./.next/server/app/api/auth/logout/route_client-reference-manifest.js
./.next/server/app/api/auth/logout/route.js.map
./.next/server/app/api/auth/logout/route
./.next/server/app/api/auth/logout/route/build-manifest.json
./.next/server/app/api/auth/logout/route/app-paths-manifest.json
./.next/server/app/api/auth/logout/route/server-reference-manifest.json
./.next/server/app/api/auth/logout/route.js.nft.json
./.next/server/app/api/auth/status
./.next/server/app/api/auth/status/route.js
./.next/server/app/api/auth/status/route_client-reference-manifest.js
./.next/server/app/api/auth/status/route.js.map
./.next/server/app/api/auth/status/route
./.next/server/app/api/auth/status/route/build-manifest.json
./.next/server/app/api/auth/status/route/app-paths-manifest.json
./.next/server/app/api/auth/status/route/server-reference-manifest.json
./.next/server/app/api/auth/status/route.js.nft.json
./.next/server/app/api/auth/login
./.next/server/app/api/auth/login/route.js
./.next/server/app/api/auth/login/route_client-reference-manifest.js
./.next/server/app/api/auth/login/route.js.map
./.next/server/app/api/auth/login/route
./.next/server/app/api/auth/login/route/build-manifest.json
./.next/server/app/api/auth/login/route/app-paths-manifest.json
./.next/server/app/api/auth/login/route/server-reference-manifest.json
./.next/server/app/api/auth/login/route.js.nft.json
./.next/server/app/api/auth/session
./.next/server/app/api/auth/session/route.js
./.next/server/app/api/auth/session/route_client-reference-manifest.js
./.next/server/app/api/auth/session/route.js.map
./.next/server/app/api/auth/session/route
./.next/server/app/api/auth/session/route/build-manifest.json
./.next/server/app/api/auth/session/route/app-paths-manifest.json
./.next/server/app/api/auth/session/route/server-reference-manifest.json
./.next/server/app/api/auth/session/route.js.nft.json
./src/app/api/auth
./src/app/api/auth/logout
./src/app/api/auth/logout/route.ts
./src/app/api/auth/status
./src/app/api/auth/status/__tests__
./src/app/api/auth/status/__tests__/route.test.ts
./src/app/api/auth/status/route.ts
./src/app/api/auth/login
./src/app/api/auth/login/__tests__
./src/app/api/auth/login/__tests__/route.test.ts
./src/app/api/auth/login/route.ts
./src/app/api/auth/session
./src/app/api/auth/session/route.ts
./src/proxy.ts
./src/lib/auth/identity.ts
./src/lib/auth/session-token.ts

## 7. Rate limit / Quota / Idempotency / Logger
./src/app/api/ai/session/open/route.ts
./src/app/api/auth/login/route.ts
./src/app/api/auth/status/route.ts
./src/app/api/behavior/route.ts
./src/app/api/contact/route.ts
./src/app/api/faq/search/route.ts
./src/app/api/feedback/route.ts
./src/app/api/review/faq-candidates/[id]/publish/route.ts
./src/app/api/router/quota-gate.ts
./src/app/api/router/route.ts
./src/app/api/router/stream/__tests__/route.test.ts
./src/app/api/router/stream/route.ts
./src/app/api/sensing/scan/route.ts
./src/app/api/templates/[id]/route.ts
./src/app/api/templates/promote/route.ts
./src/app/api/transcribe/route.ts
./src/app/api/trust-dashboard/route.ts
./src/app/api/verify/evidence/route.ts
./src/app/api/vision-extract/route.ts
./src/hooks/useStreamQuery.ts
./src/lib/analytics/events.ts
./src/lib/patent/claim-mapping.ts
./src/lib/patent/technical-effect-extractor.ts
./src/lib/quota/__tests__/idempotency.test.ts
./src/lib/quota/tracker.ts
./src/lib/security/__tests__/rate-limit-redis.test.ts
./src/lib/security/__tests__/rate-limit.test.ts
./src/lib/security/rate-limit.ts
./src/lib/utils/__tests__/api-response.test.ts
./src/lib/utils/__tests__/dev-log.test.ts
./src/lib/utils/api-response.ts
./src/lib/utils/dev-log.ts
./src/proxy.ts
./tests/nlpm/jtg-spec.test.ts

## 8. All public API routes
./src/app/api/ai/session/open/route.ts
./src/app/api/analytics/route.ts
./src/app/api/auth/login/route.ts
./src/app/api/auth/logout/route.ts
./src/app/api/auth/session/route.ts
./src/app/api/auth/status/route.ts
./src/app/api/behavior/route.ts
./src/app/api/bridge/route.ts
./src/app/api/bridge/session/route.ts
./src/app/api/cases/[id]/route.ts
./src/app/api/cases/route.ts
./src/app/api/contact/route.ts
./src/app/api/evidence/expired/route.ts
./src/app/api/evidence/route.ts
./src/app/api/faq/search/route.ts
./src/app/api/feedback/route.ts
./src/app/api/handoff/resolve/route.ts
./src/app/api/health/route.ts
./src/app/api/homepage/config/route.ts
./src/app/api/i18n/switch/route.ts
./src/app/api/judgment/route.ts
./src/app/api/knowledge/graph/route.ts
./src/app/api/metrics/route.ts
./src/app/api/pricing/summary/route.ts
./src/app/api/review/daily-summary/route.ts
./src/app/api/review/faq-candidates/[id]/publish/route.ts
./src/app/api/review/faq-candidates/[id]/route.ts
./src/app/api/review/route.ts
./src/app/api/review/stats/route.ts
./src/app/api/router/route.ts
./src/app/api/router/stream/route.ts
./src/app/api/sensing/scan/route.ts
./src/app/api/templates/[id]/route.ts
./src/app/api/templates/promote/route.ts
./src/app/api/templates/route.ts
./src/app/api/transcribe/route.ts
./src/app/api/trust-dashboard/route.ts
./src/app/api/usage/today/route.ts
./src/app/api/verify/evidence/route.ts
./src/app/api/vision-extract/route.ts

## 9. Environment variable keys used (values NOT shown)
ALLOWED_ORIGINS
BOOK_LANG
CI
DEBUG
DOTENV_KEY
ENABLE_AUDIO_INPUT
ENABLE_IMAGE_INPUT
ENABLE_OPENAI
GOOGLE_GENAI_API_KEY
HOST
JTG_ADMIN_TOKEN
JTG_JWT_SECRET
JTG_SESSION_SECRET
KB_TIER_B_THRESHOLD
LOG_PII
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_AUTH_ENABLED
NEXT_PUBLIC_EMAIL_URL
NEXT_PUBLIC_ENABLE_STREAMING
NEXT_PUBLIC_LINE_URL
NEXT_PUBLIC_PHONE_NUMBER
NEXT_PUBLIC_SENTRY_DSN
NEXT_PUBLIC_WECHAT_URL
NEXT_PUBLIC_WHATSAPP_URL
NEXT_RUNTIME
NODE_DISABLE_COLORS
NODE_ENV
NODE_UNIQUE_ID
OPENAI_API_KEY
OPENAI_MAX_RETRIES
OPENAI_MODEL
OPENAI_TIMEOUT_MS
OPENAI_TRANSCRIBE_MODEL
OTEL_SEMCONV_STABILITY_OPT_IN
PATENT_DECAY_HALF_LIFE
PATENT_DECAY_LINEAR_RATE
PATENT_FLANG_DEFAULT
PATENT_FLANG_W
PATENT_ROUTE_ALPHA
PATENT_ROUTE_BETA
PATENT_ROUTE_GAMMA
PATENT_TAU_BRIDGE
PATENT_THETA_EVIDENCE_MIN
PATENT_TRIGGER_THETA
PATENT_TRIGGER_W
PATH
SENTRY_DSN
UPSTASH_REDIS_REST_TOKEN
UPSTASH_REDIS_REST_URL
VERCEL

## 10. console.log occurrences in business code
src/lib/utils/dev-log.ts:6: * All non-critical console.log statements in API routes should use
src/lib/utils/dev-log.ts:7: * devLog() instead of raw console.log(). This ensures sensitive data
src/lib/utils/dev-log.ts:17: * Drop-in replacement for console.log(...args).
src/lib/utils/dev-log.ts:21:    console.log(...args);
src/lib/utils/dev-log.ts:31:    console.log(JSON.stringify(obj));
src/lib/audit/logger.ts:26:    console.log(JSON.stringify(entry))
src/lib/audit/logger.ts:28:    console.log(`[${entry.level.toUpperCase()}] ${entry.event}`, entry.data)

## 11. TODO / FIXME / HACK
./src/app/api/trust-dashboard/route.ts:80:  // TODO: Replace with real DB lookup of analysis_records when evidence system is ready.
./src/app/api/verify/evidence/route.ts:36:  // TODO: query evidence_records table when it is populated
./src/lib/security/output-validator.ts:267:    // Japanese phone: 0X0-XXXX-XXXX or 0X0XXXXXXXX
./src/lib/analytics/events.ts:71:  // TODO: replace with real analytics (e.g. PostHog, Amplitude, custom endpoint)

## 12. Suspected AI call entry points
./src/app/api/vision-extract/route.ts:24: *     source: 'openai' | 'fallback',
./src/app/api/vision-extract/route.ts:36:import { openai, openaiAvailable, env as openaiEnv } from '@/lib/ai/openai'
./src/app/api/vision-extract/route.ts:87:  if (!openai || !openaiAvailable) throw new Error('openai_unavailable')
./src/app/api/vision-extract/route.ts:90:  const resp = await openai.responses.create({
./src/app/api/vision-extract/route.ts:91:    model: openaiEnv.OPENAI_MODEL,
./src/app/api/vision-extract/route.ts:138:  if (openaiEnv.ENABLE_IMAGE_INPUT && openaiAvailable) {
./src/app/api/vision-extract/route.ts:180:    if (!openaiEnv.ENABLE_IMAGE_INPUT || !openaiAvailable) {
./src/app/api/vision-extract/route.ts:193:        source: 'openai',
./src/app/api/vision-extract/route.ts:197:      logError('vision_extract_openai_error', err)
./src/app/api/vision-extract/route.ts:204:          reason: err instanceof Error ? err.message : 'openai_error',
./src/app/api/bridge/route.ts:16: * LLM wiring: if `openaiAvailable` is true and the request body does not
./src/app/api/bridge/route.ts:43:import { openai, openaiAvailable, env as openaiEnv } from '@/lib/ai/openai'
./src/app/api/bridge/route.ts:146:  if (!openaiAvailable || !openai) return null
./src/app/api/bridge/route.ts:150:    const resp = await openai.chat.completions.create({
./src/app/api/bridge/route.ts:151:      model: openaiEnv.OPENAI_MODEL,
./src/app/api/bridge/route.ts:306:        llmAvailable: openaiAvailable,
./src/app/api/transcribe/route.ts:6: * the configured transcription model (default `gpt-4o-mini-transcribe`)
./src/app/api/transcribe/route.ts:18: *     source: 'openai' | 'fallback',
./src/app/api/transcribe/route.ts:29:import { openai, openaiAvailable, env as openaiEnv } from '@/lib/ai/openai'
./src/app/api/transcribe/route.ts:56:  if (openaiEnv.ENABLE_AUDIO_INPUT && openaiAvailable && openai) {
./src/app/api/transcribe/route.ts:79:    if (!openaiEnv.ENABLE_AUDIO_INPUT || !openaiAvailable || !openai) {
./src/app/api/transcribe/route.ts:92:      const resp = await openai.audio.transcriptions.create({
./src/app/api/transcribe/route.ts:94:        model: openaiEnv.OPENAI_TRANSCRIBE_MODEL,
./src/app/api/transcribe/route.ts:102:        source: 'openai',
./src/app/api/transcribe/route.ts:106:      logError('transcribe_openai_error', err)
./src/app/api/transcribe/route.ts:113:          reason: err instanceof Error ? err.message : 'openai_error',
./src/app/api/router/route.ts:4: * Implements openai_router_production_design.md §2, §5, §11, §18.
./src/app/api/router/route.ts:48:import { env as openaiEnv } from '@/lib/ai/openai'
./src/app/api/router/route.ts:224:    const openaiUsed = understanding.source === 'openai'
./src/app/api/router/route.ts:228:    if (openaiUsed && !understandingCached) pathTrace.llmCalled = true
./src/app/api/router/route.ts:392:      if (rendered.source === 'openai') {
./src/app/api/router/route.ts:499:      originalQuery: openaiEnv.LOG_PII ? message : message.slice(0, 200),
./src/app/api/router/route.ts:553:      openaiUsed,
./src/app/api/router/route.ts:621:        costEstimate: understanding.source === 'openai' ? 0.01 : 0,
./src/lib/judgment/registry.ts:32:  domain: string           // e.g. 'staropenai' or 'jtg'
./src/lib/judgment/registry.ts:170:// Hardcoded initial rules — staropenai domain.
./src/lib/judgment/registry.ts:178:    domain: 'staropenai',
./src/lib/judgment/registry.ts:187:    evidenceSource: 'staropenai rejection logs + vacancy duration data',
./src/lib/judgment/registry.ts:198:    domain: 'staropenai',
./src/lib/judgment/registry.ts:217:    domain: 'staropenai',
./src/lib/judgment/registry.ts:235:    domain: 'staropenai',
./src/lib/judgment/registry.ts:253:    domain: 'staropenai',
./src/lib/judgment/registry.ts:272:    domain: 'staropenai',
./src/lib/judgment/registry.ts:290:    domain: 'staropenai',
./src/lib/judgment/registry.ts:307:    domain: 'staropenai',
./src/lib/judgment/registry.ts:326:    domain: 'staropenai',
./src/lib/judgment/registry.ts:345:    domain: 'staropenai',
./src/lib/knowledge/seed.ts:2336:// v9 — Import staropenai FAQ bridge for expanded coverage.
./src/lib/knowledge/seed.ts:2341:// have the staropenai_v2 directory), we silently return an empty array.
./src/lib/knowledge/seed.ts:2349:    const data = require('../../../../staropenai_v2/data/faq_v2.json') as StarFaqData
./src/lib/knowledge/faq-sync.ts:4: * Converts staropenai_v2 FAQ format (5-language flat JSON) into the main
./src/lib/knowledge/faq-sync.ts:7: * This enables the lightweight staropenai FAQ content to be:
./src/lib/knowledge/faq-sync.ts:22:// Types for staropenai FAQ format.
./src/lib/knowledge/faq-sync.ts:74: * Convert a single staropenai FAQ topic into a FaqEntry.
./src/lib/knowledge/faq-sync.ts:154: * Convert an entire staropenai FAQ data object into FaqEntry[].
./src/lib/knowledge/faq-sync.ts:173: * Compute sync diff between existing FaqEntries and staropenai topics.
./src/lib/ai/fallback.ts:4: * From openai_router_production_design.md §10 + §19. This is a *minimum*
./src/lib/ai/understand.ts:4: * Implements openai_router_production_design.md §3.1, §6, §15.
./src/lib/ai/understand.ts:13:import { openai, env, openaiAvailable } from '@/lib/ai/openai'
./src/lib/ai/understand.ts:91:  if (!openai || !openaiAvailable) {
./src/lib/ai/understand.ts:102:    // See openai_router_production_design.md §15.
./src/lib/ai/understand.ts:103:    const response = await openai.responses.create({
./src/lib/ai/understand.ts:131:      source: 'openai',
./src/lib/ai/understand.ts:136:    logError('openai_understand_error', error)
./src/lib/ai/openai.ts:4: * Implements the env contract from openai_router_production_design.md §4.
./src/lib/ai/openai.ts:7: * - If OPENAI_API_KEY is missing OR ENABLE_OPENAI=false, `openai` is null and
./src/lib/ai/openai.ts:11:import OpenAI from 'openai'
./src/lib/ai/openai.ts:15:  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
./src/lib/ai/openai.ts:17:    process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
./src/lib/ai/openai.ts:26:export const openaiAvailable: boolean = Boolean(env.OPENAI_API_KEY) && env.ENABLE_OPENAI
./src/lib/ai/openai.ts:28:export const openai: OpenAI | null = openaiAvailable
./src/lib/ai/understanding-cache.ts:51: * `source` is 'openai' (not fallback/error results).
./src/lib/ai/understanding-cache.ts:59:  if (result.source !== 'openai') return
./src/lib/ai/prompts.ts:4: * From openai_router_production_design.md §6.4 and §9.4.
./src/lib/ai/types.ts:2: * AI-layer types — mirrors openai_router_production_design.md §13.
./src/lib/ai/types.ts:47:  source: 'openai' | 'fallback'
./src/lib/ai/types.ts:55:  source: 'openai' | 'fallback'
./src/lib/ai/generate.ts:4: * Implements openai_router_production_design.md §3.1, §9, §17.
./src/lib/ai/generate.ts:14:import { openai, env, openaiAvailable } from '@/lib/ai/openai'
./src/lib/ai/generate.ts:147:  if (!openai || !openaiAvailable) {
./src/lib/ai/generate.ts:157:    const response = await openai.responses.create({
./src/lib/ai/generate.ts:176:      source: 'openai',
./src/lib/ai/generate.ts:181:    logError('openai_render_error', error)
./src/lib/ai/generate-stream.ts:10:import { openai, env, openaiAvailable } from "@/lib/ai/openai";
./src/lib/ai/generate-stream.ts:67:  if (!openai || !openaiAvailable) {
./src/lib/ai/generate-stream.ts:79:    const stream = await openai.responses.create({
./src/lib/ai/generate-stream.ts:103:    logError("openai_stream_error", error);

## 13. Suspected quota / identity fields in frontend
./src/app/api/auth/status/route.ts:22:    identityType: identity.isAuthenticated ? "authenticated" : "anonymous",
./src/app/api/auth/status/route.ts:23:    remaining: status.remaining,
./src/app/api/auth/status/route.ts:24:    canSubmit: status.remaining > 0,
./src/app/api/auth/status/route.ts:28:    resetAtText: status.resetAtText,
./src/app/api/auth/session/route.ts:15: *     identityType: "anonymous" | "lead" | "authenticated"
./src/app/api/auth/session/route.ts:26:  const identityType = deriveIdentityType(identity.isAuthenticated);
./src/app/api/auth/session/route.ts:33:    identityType,
./src/app/api/usage/today/route.ts:8: *   lang (optional): locale string for resetAtText localisation.
./src/app/api/usage/today/route.ts:34:  const identityType = deriveIdentityType(identity.isAuthenticated);
./src/app/api/usage/today/route.ts:35:  const quotaResponse = buildQuotaResponse(status, identityType);
./src/app/api/ai/session/open/route.ts:15: *   { ok: false, error: "quota_exceeded", remaining: 0, resetAtText }
./src/app/api/ai/session/open/route.ts:77:  const identityType = deriveIdentityType(identity.isAuthenticated);
./src/app/api/ai/session/open/route.ts:78:  const quotaResponse = buildQuotaResponse(status, identityType);
./src/app/api/router/quota-gate.ts:74: * @param lang         - Detected language for resetAtText localisation
./src/app/(main)/try/page.tsx:257:    if (!query.trim() || quota.remaining <= 0) return;
./src/app/(main)/try/page.tsx:324:          disabled={loading || !query.trim() || quota.remaining <= 0}
./src/app/(jtg)/[locale]/page.tsx:112:        if (typeof d.remaining === "number") setQuotaRemaining(d.remaining);
./src/app/(jtg)/[locale]/page.tsx:178:          if (typeof sessionData.remaining === "number") {
./src/app/(jtg)/[locale]/page.tsx:179:            setQuotaRemaining(sessionData.remaining);
./src/app/(jtg)/[locale]/page.tsx:184:        if (typeof sessionData.remaining === "number") {
./src/app/(jtg)/[locale]/page.tsx:185:          setQuotaRemaining(sessionData.remaining);
./src/app/(jtg)/[locale]/page.tsx:1003:          remaining={quotaRemaining}
./src/components/jtg/AiZone.tsx:19:  const disabled = data.disabled || usage.remaining <= 0;
./src/components/jtg/AiZone.tsx:72:            {usage.remaining > 0
./src/components/jtg/AiZone.tsx:73:              ? `今日剩余 ${usage.remaining}/${usage.limit} 次`
./src/components/jtg/AiZone.tsx:76:          <span>{usage.resetAtText}</span>
./src/components/jtg/AiZone.tsx:83:              usage.remaining <= 0 ? "bg-danger" : "bg-accent"
./src/components/jtg/HomePage.tsx:45:            disabled: usage.ai.remaining <= 0,
./src/components/jtg/HomePage.tsx:46:            disabledReason: usage.ai.remaining <= 0 ? "今日额度已用完" : undefined,
./src/components/jtg/HomePage.tsx:86:        disabled: usage.remaining <= 0,

## 14. .gitignore coverage
.env*
.env*.local

## 15. .env.example
present

## 16. Existing rate-limit check on each public route
(routes without rateLimit):
./src/app/api/metrics/route.ts
./src/app/api/homepage/config/route.ts
./src/app/api/evidence/route.ts
./src/app/api/evidence/expired/route.ts
./src/app/api/auth/logout/route.ts
./src/app/api/auth/session/route.ts
./src/app/api/handoff/resolve/route.ts
./src/app/api/bridge/route.ts
./src/app/api/bridge/session/route.ts
./src/app/api/judgment/route.ts
./src/app/api/health/route.ts
./src/app/api/cases/route.ts
./src/app/api/cases/[id]/route.ts
./src/app/api/usage/today/route.ts
./src/app/api/knowledge/graph/route.ts
./src/app/api/review/faq-candidates/[id]/publish/route.ts
./src/app/api/review/faq-candidates/[id]/route.ts
./src/app/api/review/daily-summary/route.ts
./src/app/api/review/route.ts
./src/app/api/review/stats/route.ts
./src/app/api/templates/promote/route.ts
./src/app/api/templates/route.ts
./src/app/api/templates/[id]/route.ts
./src/app/api/i18n/switch/route.ts
./src/app/api/sensing/scan/route.ts
./src/app/api/pricing/summary/route.ts
./src/app/api/analytics/route.ts
./src/app/api/router/stream/route.ts
./src/app/api/router/route.ts

## 17. Evidence / audit trail files
./src/lib/pipeline/writeback-hooks.ts
./src/lib/patent/evidence-chain-logger.ts
./src/lib/domain/writeback.ts

## 18. SSE / streaming endpoints
./src/app/api/router/stream/__tests__/route.test.ts:343:      expect(res.headers.get("content-type")).toBe("text/event-stream");
./src/app/api/router/stream/route.ts:470:    const readable = new ReadableStream({
./src/app/api/router/stream/route.ts:608:        "Content-Type": "text/event-stream",

## 19. Semantic cache / Redis usage
./src/app/api/router/quota-gate.ts:97:  // V5 T4: pass idempotency key for dedup when Redis is available
./src/lib/security/__tests__/rate-limit-redis.test.ts:2: * Tests for Redis-backed rate limiting.
./src/lib/security/__tests__/rate-limit-redis.test.ts:3: * Tests both the async Redis path and the in-memory fallback.
./src/lib/security/__tests__/rate-limit-redis.test.ts:6:// Mock Redis client
./src/lib/security/__tests__/rate-limit-redis.test.ts:16:let mockRedisAvailable = false;
./src/lib/security/__tests__/rate-limit-redis.test.ts:18:jest.mock("@/lib/redis/client", () => ({
./src/lib/security/__tests__/rate-limit-redis.test.ts:19:  getRedis: () =>
./src/lib/security/__tests__/rate-limit-redis.test.ts:20:    mockRedisAvailable
./src/lib/security/__tests__/rate-limit-redis.test.ts:35:    mockRedisAvailable = false;
./src/lib/security/__tests__/rate-limit-redis.test.ts:68:describe("Rate limit — async Redis path", () => {
./src/lib/security/__tests__/rate-limit-redis.test.ts:71:    mockRedisAvailable = true;
./src/lib/security/__tests__/rate-limit-redis.test.ts:78:  it("uses Redis when available", async () => {
./src/lib/security/__tests__/rate-limit-redis.test.ts:89:  it("blocks when Redis count exceeds limit", async () => {
./src/lib/security/__tests__/rate-limit-redis.test.ts:99:  it("falls back to in-memory when Redis errors", async () => {
./src/lib/security/__tests__/rate-limit-redis.test.ts:100:    mockExec.mockRejectedValue(new Error("Redis connection failed"));
./src/lib/security/__tests__/rate-limit-redis.test.ts:110:  it("falls back to in-memory when Redis is unavailable", async () => {
./src/lib/security/__tests__/rate-limit-redis.test.ts:111:    mockRedisAvailable = false;
./src/lib/security/__tests__/rate-limit-redis.test.ts:120:  it("sends correct TTL to Redis", async () => {
./src/lib/security/rate-limit.ts:5: *   - Redis (Upstash) when UPSTASH_REDIS_REST_URL is configured
./src/lib/security/rate-limit.ts:12: * - Redis backend uses INCR + EXPIRE for atomic, multi-instance safe counting
./src/lib/security/rate-limit.ts:13: * - In-memory fallback uses sliding window timestamps (same as pre-Redis behavior)
./src/lib/security/rate-limit.ts:23:import { getRedis } from "@/lib/redis/client";
./src/lib/security/rate-limit.ts:65:// Redis backend — atomic INCR + EXPIRE, multi-instance safe
./src/lib/security/rate-limit.ts:69: * Async rate limit check using Redis.
./src/lib/security/rate-limit.ts:71: * Returns null if Redis is not available (caller falls back to in-memory).
./src/lib/security/rate-limit.ts:73:async function checkRateLimitRedis(
./src/lib/security/rate-limit.ts:77:  const redis = getRedis();
./src/lib/security/rate-limit.ts:78:  if (!redis) return null;
./src/lib/security/rate-limit.ts:82:  const redisKey = `rl:${key}:${windowId}`;
./src/lib/security/rate-limit.ts:88:    const pipeline = redis.pipeline();
./src/lib/security/rate-limit.ts:89:    pipeline.incr(redisKey);
./src/lib/security/rate-limit.ts:90:    pipeline.expire(redisKey, ttlSec);
./src/lib/security/rate-limit.ts:114:    // Redis error — fall through to in-memory
./src/lib/security/rate-limit.ts:187:// Public API — tries Redis first, falls back to in-memory
./src/lib/security/rate-limit.ts:193: * When Redis is configured, uses atomic INCR + EXPIRE (multi-instance safe).
./src/lib/security/rate-limit.ts:194: * Falls back to in-memory sliding window when Redis is unavailable.
./src/lib/security/rate-limit.ts:209: * Async rate limit check — prefers Redis when available.
./src/lib/security/rate-limit.ts:211: * Falls back to in-memory if Redis is not configured or errors.
./src/lib/security/rate-limit.ts:217:  const redisResult = await checkRateLimitRedis(key, config);
./src/lib/security/rate-limit.ts:218:  if (redisResult) return redisResult;
./src/lib/redis/__tests__/client.test.ts:2: * Tests for Redis client module.
./src/lib/redis/__tests__/client.test.ts:6:// Mock @upstash/redis
./src/lib/redis/__tests__/client.test.ts:7:jest.mock("@upstash/redis", () => ({
./src/lib/redis/__tests__/client.test.ts:8:  Redis: jest.fn().mockImplementation(({ url, token }) => ({
./src/lib/redis/__tests__/client.test.ts:22:import { getRedis, isRedisAvailable, __resetForTests } from "../client";
./src/lib/redis/__tests__/client.test.ts:24:describe("Redis client", () => {
./src/lib/redis/__tests__/client.test.ts:45:    expect(getRedis()).toBeNull();
./src/lib/redis/__tests__/client.test.ts:46:    expect(isRedisAvailable()).toBe(false);
./src/lib/redis/__tests__/client.test.ts:52:    expect(getRedis()).toBeNull();
./src/lib/redis/__tests__/client.test.ts:58:    expect(getRedis()).toBeNull();
./src/lib/redis/__tests__/client.test.ts:61:  it("creates Redis client when both env vars are set", () => {
./src/lib/redis/__tests__/client.test.ts:64:    const client = getRedis();
./src/lib/redis/__tests__/client.test.ts:66:    expect(isRedisAvailable()).toBe(true);
./src/lib/redis/__tests__/client.test.ts:72:    const client1 = getRedis();
./src/lib/redis/__tests__/client.test.ts:73:    const client2 = getRedis();
./src/lib/redis/__tests__/client.test.ts:80:    expect(getRedis()).toBeNull();
./src/lib/redis/__tests__/client.test.ts:85:    expect(getRedis()).not.toBeNull();
./src/lib/redis/client.ts:2: * lib/redis/client.ts — Upstash Redis client singleton.
./src/lib/redis/client.ts:5: * Without env vars, `getRedis()` returns null and all callers fall back
./src/lib/redis/client.ts:16:import { Redis } from "@upstash/redis";
./src/lib/redis/client.ts:18:let _client: Redis | null = null;
./src/lib/redis/client.ts:22: * Get the Redis client singleton.
./src/lib/redis/client.ts:25:export function getRedis(): Redis | null {
./src/lib/redis/client.ts:37:  _client = new Redis({ url, token });
./src/lib/redis/client.ts:42: * Whether Redis is available for this deployment.
./src/lib/redis/client.ts:44:export function isRedisAvailable(): boolean {
./src/lib/redis/client.ts:45:  return getRedis() !== null;
./src/lib/ai/understanding-cache.ts:4: * Single-instance deployment — no Redis needed. Saves an OpenAI round-trip
./src/lib/quota/tracker.ts:9: *    - Redis (Upstash) when UPSTASH_REDIS_REST_URL is configured.
./src/lib/quota/tracker.ts:10: *      Uses Redis Hash with atomic HINCRBY for concurrent-safe counting.
./src/lib/quota/tracker.ts:13: *    Redis errors fall back to in-memory silently.
./src/lib/quota/tracker.ts:32:import { getRedis } from "@/lib/redis/client";
./src/lib/quota/tracker.ts:160:// Redis helpers — atomic counter with daily TTL
./src/lib/quota/tracker.ts:165:function quotaRedisKey(uid: string, dateKey: string): string {
./src/lib/quota/tracker.ts:170: * Read current usage from Redis. Returns null if Redis unavailable.
./src/lib/quota/tracker.ts:172:async function getUsedFromRedis(uid: string, dateKey: string): Promise<number | null> {
./src/lib/quota/tracker.ts:173:  const redis = getRedis();
./src/lib/quota/tracker.ts:174:  if (!redis) return null;
./src/lib/quota/tracker.ts:176:    const val = await redis.get<number>(quotaRedisKey(uid, dateKey));
./src/lib/quota/tracker.ts:184: * Atomic increment in Redis using INCR + conditional EXPIRE.
./src/lib/quota/tracker.ts:185: * Returns new count, or null if Redis unavailable.
./src/lib/quota/tracker.ts:187:async function incrQuotaRedis(uid: string, dateKey: string): Promise<number | null> {
./src/lib/quota/tracker.ts:188:  const redis = getRedis();
./src/lib/quota/tracker.ts:189:  if (!redis) return null;
./src/lib/quota/tracker.ts:191:    const key = quotaRedisKey(uid, dateKey);
./src/lib/quota/tracker.ts:192:    const pipeline = redis.pipeline();
./src/lib/quota/tracker.ts:203: * Atomic decrement (rollback) in Redis. Best-effort, no error on failure.
./src/lib/quota/tracker.ts:205:async function decrQuotaRedis(uid: string, dateKey: string): Promise<void> {
./src/lib/quota/tracker.ts:206:  const redis = getRedis();
./src/lib/quota/tracker.ts:207:  if (!redis) return;
./src/lib/quota/tracker.ts:209:    await redis.decr(quotaRedisKey(uid, dateKey));
./src/lib/quota/tracker.ts:216:// Public API — tries Redis first, falls back to in-memory
./src/lib/quota/tracker.ts:221: * Prefers Redis when configured; falls back to in-memory.
./src/lib/quota/tracker.ts:231:  // Try Redis first
./src/lib/quota/tracker.ts:232:  const redisUsed = await getUsedFromRedis(uid, dateKey);
./src/lib/quota/tracker.ts:233:  const used = redisUsed ?? ((): number => {
./src/lib/quota/tracker.ts:287: * Check and mark an idempotency key in Redis.
./src/lib/quota/tracker.ts:289: * "duplicate" if already processed, or null if Redis unavailable.
./src/lib/quota/tracker.ts:296:  const redis = getRedis();
./src/lib/quota/tracker.ts:297:  if (!redis || !key) return null;
./src/lib/quota/tracker.ts:299:    const idemRedisKey = `idem:${key}`;
./src/lib/quota/tracker.ts:301:    const result = await redis.set(idemRedisKey, "1", { nx: true, ex: 86400 });
./src/lib/quota/tracker.ts:304:    return null; // Redis error → skip idempotency check
./src/lib/quota/tracker.ts:312: * Redis path: INCR is atomic — no race conditions even across instances.
./src/lib/quota/tracker.ts:314: * Idempotency: when idempotencyKey is provided and Redis is available,
./src/lib/quota/tracker.ts:317: * In-memory path: uses per-UID promise lock (same as pre-Redis behavior).
./src/lib/quota/tracker.ts:328:  // ── V5 T4: Idempotency check (Redis only) ────────────────────
./src/lib/quota/tracker.ts:337:  // ── Try Redis (atomic, multi-instance safe) ───────────────────
./src/lib/quota/tracker.ts:338:  const redisCount = await incrQuotaRedis(uid, dateKey);
./src/lib/quota/tracker.ts:339:  if (redisCount !== null) {
./src/lib/quota/tracker.ts:340:    if (redisCount > limit) {
./src/lib/quota/tracker.ts:342:      await decrQuotaRedis(uid, dateKey);
./src/lib/quota/tracker.ts:346:        used: redisCount - 1, // actual count before our failed increment
./src/lib/quota/tracker.ts:355:    const remaining = Math.max(0, limit - redisCount);
./src/lib/quota/tracker.ts:359:      used: redisCount,
./src/lib/quota/tracker.ts:363:      showUpgradeHint: redisCount >= UPGRADE_HINT_THRESHOLD,
./src/lib/quota/__tests__/idempotency.test.ts:8: *   4. Redis unavailable → idempotency check skipped gracefully
./src/lib/quota/__tests__/idempotency.test.ts:21:// Mock Redis client with idempotency support
./src/lib/quota/__tests__/idempotency.test.ts:34:let mockRedisAvailable = false;
./src/lib/quota/__tests__/idempotency.test.ts:36:jest.mock("@/lib/redis/client", () => ({
./src/lib/quota/__tests__/idempotency.test.ts:37:  getRedis: () =>
./src/lib/quota/__tests__/idempotency.test.ts:38:    mockRedisAvailable
./src/lib/quota/__tests__/idempotency.test.ts:55:describe("Quota idempotency — Redis path", () => {
./src/lib/quota/__tests__/idempotency.test.ts:58:    mockRedisAvailable = true;
./src/lib/quota/__tests__/idempotency.test.ts:87:    // getUsageStatus reads from Redis
./src/lib/quota/__tests__/idempotency.test.ts:118:describe("Quota idempotency — fallback when Redis unavailable", () => {
./src/lib/quota/__tests__/idempotency.test.ts:121:    mockRedisAvailable = false;
./src/lib/quota/__tests__/idempotency.test.ts:125:  it("idempotency key is ignored when Redis is down", async () => {
./src/lib/quota/__tests__/idempotency.test.ts:126:    const r1 = await consumeQuota("uid-idem-5", false, "en", "key-no-redis");
./src/lib/quota/__tests__/idempotency.test.ts:127:    const r2 = await consumeQuota("uid-idem-5", false, "en", "key-no-redis");
./src/lib/quota/__tests__/idempotency.test.ts:128:    // Both consume (no idempotency without Redis)
./src/lib/quota/__tests__/idempotency.test.ts:134:describe("Quota idempotency — Redis error handling", () => {
./src/lib/quota/__tests__/idempotency.test.ts:137:    mockRedisAvailable = true;
./src/lib/quota/__tests__/idempotency.test.ts:143:  it("Redis SET error → falls through to normal consumption", async () => {
./src/lib/quota/__tests__/idempotency.test.ts:144:    mockSet.mockRejectedValue(new Error("Redis SET failed"));
./src/lib/quota/__tests__/tracker-redis.test.ts:2: * Tests for Redis-backed quota tracker.
./src/lib/quota/__tests__/tracker-redis.test.ts:3: * Validates dual-mode behavior: Redis when available, in-memory fallback.
./src/lib/quota/__tests__/tracker-redis.test.ts:16:// Mock Redis client with controllable behavior
./src/lib/quota/__tests__/tracker-redis.test.ts:28:let mockRedisAvailable = false;
./src/lib/quota/__tests__/tracker-redis.test.ts:30:jest.mock("@/lib/redis/client", () => ({
./src/lib/quota/__tests__/tracker-redis.test.ts:31:  getRedis: () =>
./src/lib/quota/__tests__/tracker-redis.test.ts:32:    mockRedisAvailable
./src/lib/quota/__tests__/tracker-redis.test.ts:54:    mockRedisAvailable = false;
./src/lib/quota/__tests__/tracker-redis.test.ts:116:describe("Quota tracker — Redis path", () => {
./src/lib/quota/__tests__/tracker-redis.test.ts:119:    mockRedisAvailable = true;
./src/lib/quota/__tests__/tracker-redis.test.ts:128:  it("consumes quota via Redis INCR", async () => {
./src/lib/quota/__tests__/tracker-redis.test.ts:137:  it("blocks and rolls back when Redis count exceeds limit", async () => {
./src/lib/quota/__tests__/tracker-redis.test.ts:146:  it("falls back to in-memory when Redis errors", async () => {
./src/lib/quota/__tests__/tracker-redis.test.ts:147:    mockExec.mockRejectedValue(new Error("Redis timeout"));
./src/lib/quota/__tests__/tracker-redis.test.ts:154:  it("getUsageStatus reads from Redis", async () => {
./src/lib/quota/__tests__/tracker-redis.test.ts:162:  it("getUsageStatus falls back to in-memory on Redis error", async () => {
./src/lib/quota/__tests__/tracker-redis.test.ts:163:    mockGet.mockRejectedValue(new Error("Redis down"));
./src/lib/quota/__tests__/tracker-redis.test.ts:170:  it("uses authenticated limit in Redis path", async () => {

## 20. SQL index coverage (pgvector / GIN)
[UNCONFIRMED] no index definitions found

## 21. CODEOWNERS
[UNCONFIRMED] not present

## 22. .gitleaks.toml
[UNCONFIRMED] not present
