/**
 * Rule engine executor.
 *
 * Runs all matching built-in rules against the given context,
 * in priority order (lowest priority number first).
 * Returns all matching rule results — the router aggregates them.
 */

import { BUILTIN_RULES } from '@/lib/rules/builtins'
import type { RuleContext, RuleResult } from '@/lib/router/types'

export function runRules(ctx: RuleContext): RuleResult[] {
  const results: RuleResult[] = []

  for (const rule of BUILTIN_RULES) {
    if (!rule.match(ctx)) continue
    results.push(rule.execute(ctx))
  }

  return results
}
