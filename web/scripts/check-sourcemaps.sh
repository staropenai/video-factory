#!/usr/bin/env bash
# check-sourcemaps.sh — Verify no source maps leak to client-accessible paths.
# Run after `npm run build` to catch regressions.
# Exit 0 = safe, Exit 1 = source maps found in client paths.

set -euo pipefail

STATIC_DIR=".next/static"
PUBLIC_DIR="public"
OUT_DIR="out"  # for static export if used

errors=0

echo "🔍 Source map exposure check"
echo "─────────────────────────────"

# 1. Check .next/static (served to browsers via /_next/static/)
count=$(find "$STATIC_DIR" -name '*.map' 2>/dev/null | wc -l | tr -d ' ')
if [ "$count" -gt 0 ]; then
  echo "❌ FAIL: $count .map files in $STATIC_DIR (client-accessible)"
  find "$STATIC_DIR" -name '*.map' | head -10
  errors=$((errors + 1))
else
  echo "✅ $STATIC_DIR: 0 .map files"
fi

# 2. Check public/ directory
count=$(find "$PUBLIC_DIR" -name '*.map' 2>/dev/null | wc -l | tr -d ' ')
if [ "$count" -gt 0 ]; then
  echo "❌ FAIL: $count .map files in $PUBLIC_DIR"
  find "$PUBLIC_DIR" -name '*.map' | head -10
  errors=$((errors + 1))
else
  echo "✅ $PUBLIC_DIR: 0 .map files"
fi

# 3. Check out/ directory (static export)
if [ -d "$OUT_DIR" ]; then
  count=$(find "$OUT_DIR" -name '*.map' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$count" -gt 0 ]; then
    echo "❌ FAIL: $count .map files in $OUT_DIR"
    errors=$((errors + 1))
  else
    echo "✅ $OUT_DIR: 0 .map files"
  fi
fi

# 4. Verify next.config explicitly disables browser source maps
if grep -q 'productionBrowserSourceMaps.*true' next.config.ts next.config.js next.config.mjs 2>/dev/null; then
  echo "❌ FAIL: productionBrowserSourceMaps is enabled"
  errors=$((errors + 1))
else
  echo "✅ productionBrowserSourceMaps: not enabled"
fi

echo "─────────────────────────────"
if [ "$errors" -gt 0 ]; then
  echo "❌ $errors source map exposure issues found"
  exit 1
else
  echo "✅ No source map exposure detected"
  exit 0
fi
