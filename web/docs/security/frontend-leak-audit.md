# Frontend Bundle Information Leak Audit

**Date**: 2026-04-15
**Auditor**: Claude Code (automated)
**Build**: Next.js 16, production mode

## Audit Results

### HIGH RISK — Fixed
| Item | Severity | Status |
|------|----------|--------|
| Source maps in client bundles | HIGH | CLEAN — 0 .map files in .next/static |
| productionBrowserSourceMaps | HIGH | PINNED to false in next.config.ts |
| Hardcoded API keys/tokens | HIGH | CLEAN — no patterns found |
| localhost:PORT/api URLs in bundles | HIGH | CLEAN — none found |

### MEDIUM RISK — Reviewed
| Item | Severity | Status | Rationale |
|------|----------|--------|-----------|
| /api/review in client bundle | MEDIUM | ACCEPTED | Admin review dashboard intentionally calls this endpoint |
| __private/__internal in bundle | LOW | ACCEPTED | Framework polyfill internals, not application code |

### LOW RISK — Verified Safe
| Item | Status |
|------|--------|
| console.error in error boundaries | SAFE — guarded by `NODE_ENV !== "production"` |
| devLog() utility | SAFE — production-guarded, no output in prod |
| componentStack logging | SAFE — only in dev mode |
| "staging" in comments | SAFE — comments are stripped by minifier |
| TODO/FIXME comments (7 total) | SAFE — stripped by minifier |

## Automated Checks Added
- `scripts/check-sourcemaps.sh` — post-build source map exposure check
- `scripts/check-bundle-leaks.sh` — post-build bundle information leak check

## Recommendations
1. Add both check scripts to CI pipeline
2. Periodically re-audit when new NEXT_PUBLIC_ env vars are added
3. Consider adding Content-Security-Policy header (requires careful testing)
