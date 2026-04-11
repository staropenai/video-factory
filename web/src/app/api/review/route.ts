import { NextResponse } from "next/server";
import { runAllChecks } from "@/lib/guardrails/review";

/**
 * API endpoint: Run AI-reviews-AI quality checks.
 * GET /api/review
 *
 * Returns structured review results for:
 * - source consistency
 * - multilingual completeness
 * - template completeness
 *
 * [DEFAULT ASSUMPTION] V1 runs checks against seed data.
 * Production would also check rule conflicts and regression.
 *
 * Extension points:
 * - POST /api/review/trigger — trigger review on content change
 * - GET /api/review/history — view past review results
 * - Connect to admin dashboard
 */
export async function GET() {
  const results = runAllChecks();
  const allPassed = results.every((r) => r.passed);

  return NextResponse.json({
    status: allPassed ? "all_pass" : "issues_found",
    total_checks: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
    timestamp: new Date().toISOString(),
  });
}
