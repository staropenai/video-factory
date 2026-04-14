# 公开接口限流审计 — 2026-04-13

## 已有限流的接口
./src/app/api/ai/session/open/route.ts
./src/app/api/auth/login/route.ts
./src/app/api/contact/route.ts
./src/app/api/router/route.ts
./src/app/api/router/stream/route.ts

## 未做限流的接口
./src/app/api/analytics/route.ts
./src/app/api/auth/logout/route.ts
./src/app/api/auth/session/route.ts
./src/app/api/behavior/route.ts
./src/app/api/bridge/route.ts
./src/app/api/bridge/session/route.ts
./src/app/api/cases/[id]/route.ts
./src/app/api/cases/route.ts
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
./src/app/api/sensing/scan/route.ts
./src/app/api/templates/[id]/route.ts
./src/app/api/templates/promote/route.ts
./src/app/api/templates/route.ts
./src/app/api/transcribe/route.ts
./src/app/api/usage/today/route.ts
./src/app/api/vision-extract/route.ts

## 分析

### 需要补限流的低风险接口
(需逐个评估是否受 admin-guard 保护)
### Admin-guarded (already protected, low priority):
./src/app/api/analytics/route.ts
./src/app/api/bridge/route.ts
./src/app/api/bridge/session/route.ts
./src/app/api/handoff/resolve/route.ts
./src/app/api/judgment/route.ts
./src/app/api/review/daily-summary/route.ts
./src/app/api/review/faq-candidates/[id]/publish/route.ts
./src/app/api/review/faq-candidates/[id]/route.ts
./src/app/api/review/route.ts
./src/app/api/review/stats/route.ts
./src/app/api/sensing/scan/route.ts
./src/app/api/templates/[id]/route.ts
./src/app/api/templates/promote/route.ts
./src/app/api/templates/route.ts

### Truly public (no auth, no rate limit — HIGH PRIORITY):
./src/app/api/auth/logout/route.ts
./src/app/api/auth/session/route.ts
./src/app/api/behavior/route.ts
./src/app/api/cases/[id]/route.ts
./src/app/api/cases/route.ts
./src/app/api/evidence/expired/route.ts
./src/app/api/evidence/route.ts
./src/app/api/faq/search/route.ts
./src/app/api/feedback/route.ts
./src/app/api/health/route.ts
./src/app/api/homepage/config/route.ts
./src/app/api/i18n/switch/route.ts
./src/app/api/knowledge/graph/route.ts
./src/app/api/metrics/route.ts
./src/app/api/pricing/summary/route.ts
./src/app/api/transcribe/route.ts
./src/app/api/usage/today/route.ts
./src/app/api/vision-extract/route.ts
