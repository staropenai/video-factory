#!/usr/bin/env bash
# verify_v6_homepage.sh — V6 Homepage Trust & Transparency verification
# Run from web/ directory: bash scripts/verify_v6_homepage.sh

set -uo pipefail

PASS=0
FAIL=0

check() {
  local id="$1" desc="$2" cmd="$3"
  if eval "$cmd" > /dev/null 2>&1; then
    echo "[PASS] $id: $desc"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] $id: $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== V6 Homepage Verification ==="
echo ""

# V1: TrustBadge component exists with 5 states
check "V1" "TrustBadge exports STATUS_CONFIG with 5 states" \
  "grep -q 'verified.*partial.*risk.*unknown.*pending' src/components/homepage/TrustBadge.tsx"

# V2: TrustDashboard component exists and fetches from server
check "V2" "TrustDashboard fetches via useTrustDashboard hook" \
  "grep -q 'useTrustDashboard' src/components/homepage/TrustDashboard.tsx"

# V3: EvidenceModal is normal-flow (no position:fixed in code, comments OK)
check "V3" "EvidenceModal has no position:fixed in code" \
  "! grep -v '^\s*//' src/components/homepage/EvidenceModal.tsx | grep -v '^\s*\*' | grep -q 'position.*fixed'"

# V4: trust-dashboard API route exists
check "V4" "trust-dashboard API route exists" \
  "test -f src/app/api/trust-dashboard/route.ts"

# V5: trust-dashboard uses resolveIdentity (not getSession)
check "V5" "trust-dashboard uses resolveIdentity" \
  "grep -q 'resolveIdentity' src/app/api/trust-dashboard/route.ts && ! grep -q 'getSession' src/app/api/trust-dashboard/route.ts"

# V6: verify/evidence API route exists with rate limiting
check "V6" "verify/evidence route with strict rate limit" \
  "grep -q 'RATE_LIMIT_PRESETS.strict' src/app/api/verify/evidence/route.ts"

# V7: Homepage imports TrustBadge, TrustDashboard, EvidenceModal
check "V7" "Homepage imports all V6 trust components" \
  "grep -q 'TrustBadge' src/app/\\(jtg\\)/\\[locale\\]/page.tsx && grep -q 'TrustDashboard' src/app/\\(jtg\\)/\\[locale\\]/page.tsx && grep -q 'EvidenceModal' src/app/\\(jtg\\)/\\[locale\\]/page.tsx"

# V8: Homepage has trust promise bar (ZONE 2)
check "V8" "Homepage has ZONE 2 trust promise bar" \
  "grep -q 'jtg-trust-promises' src/app/\\(jtg\\)/\\[locale\\]/page.tsx"

# V9: Homepage has trust center nav (ZONE 0)
check "V9" "Homepage has ZONE 0 trust center nav" \
  "grep -q 'trustCenterNavLabel' src/app/\\(jtg\\)/\\[locale\\]/page.tsx"

# V10: Homepage has footer compliance note (ZONE 10)
check "V10" "Homepage has ZONE 10 footer compliance note" \
  "grep -q 'footerComplianceNote' src/app/\\(jtg\\)/\\[locale\\]/page.tsx && grep -q 'footerReportViolation' src/app/\\(jtg\\)/\\[locale\\]/page.tsx"

# V11: V6 analytics events exist
check "V11" "V6 analytics events registered" \
  "grep -q 'TRUST_DASHBOARD_VIEW' src/lib/analytics/events.ts && grep -q 'EVIDENCE_VIEW' src/lib/analytics/events.ts"

# V12: TypeScript compiles clean
check "V12" "TypeScript compiles with zero errors" \
  "npx tsc --noEmit"

echo ""
echo "--- V6 Verification: $PASS passed, $FAIL failed ---"

if [ "$FAIL" -eq 0 ]; then
  echo "VERIFIED"
  exit 0
else
  echo "NOT VERIFIED"
  exit 1
fi
