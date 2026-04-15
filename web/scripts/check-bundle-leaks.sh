#!/usr/bin/env bash
# check-bundle-leaks.sh — Audit client-side JS bundles for information leaks.
# Run after `npm run build`.
# Exit 0 = clean, Exit 1 = leaks found.

set -uo pipefail

STATIC_CHUNKS=".next/static/chunks"
errors=0
warnings=0

echo "🔍 Frontend bundle information leak audit"
echo "──────────────────────────────────────────"

if [ ! -d "$STATIC_CHUNKS" ]; then
  echo "⚠️  No build output found. Run 'npm run build' first."
  exit 1
fi

# HIGH RISK: hardcoded localhost API URLs (not framework polyfills)
count=$(grep -rl 'http://localhost:[0-9]*/api' "$STATIC_CHUNKS" 2>/dev/null | wc -l | tr -d ' ')
if [ "$count" -gt 0 ]; then
  echo "❌ FAIL: $count bundles contain 'http://localhost:PORT/api' strings"
  errors=$((errors + 1))
else
  echo "✅ No localhost API URLs in client bundles"
fi

# HIGH RISK: hardcoded API keys or tokens
count=$(grep -rlE '(sk-[a-zA-Z0-9]{20}|pk_[a-zA-Z0-9]{20}|ghp_[a-zA-Z0-9]{20})' "$STATIC_CHUNKS" 2>/dev/null | wc -l | tr -d ' ')
if [ "$count" -gt 0 ]; then
  echo "❌ FAIL: $count bundles contain potential API keys"
  errors=$((errors + 1))
else
  echo "✅ No API key patterns in client bundles"
fi

# MEDIUM RISK: internal API paths that shouldn't be client-accessible
count=$(grep -rl '/api/review\|/api/admin\|/api/sensing\|/api/bridge\|/api/judgment' "$STATIC_CHUNKS" 2>/dev/null | wc -l | tr -d ' ')
if [ "$count" -gt 0 ]; then
  echo "⚠️  WARN: $count bundles reference internal API paths"
  warnings=$((warnings + 1))
else
  echo "✅ No internal API paths in client bundles"
fi

# MEDIUM RISK: debug/internal identifiers
count=$(grep -rl '__internal\|__private\|__DEBUG__\|EXPERIMENT_' "$STATIC_CHUNKS" 2>/dev/null | wc -l | tr -d ' ')
if [ "$count" -gt 0 ]; then
  echo "⚠️  WARN: $count bundles contain debug/internal identifiers"
  warnings=$((warnings + 1))
else
  echo "✅ No debug/internal identifiers in client bundles"
fi

echo "──────────────────────────────────────────"
if [ "$errors" -gt 0 ]; then
  echo "❌ $errors high-risk leaks found, $warnings warnings"
  exit 1
elif [ "$warnings" -gt 0 ]; then
  echo "⚠️  0 high-risk, $warnings warnings (review recommended)"
  exit 0
else
  echo "✅ No information leaks detected"
  exit 0
fi
