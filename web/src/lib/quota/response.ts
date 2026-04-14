/**
 * lib/quota/response.ts
 *
 * Unified quota response builder.
 * All quota-related API responses MUST use this builder to ensure
 * consistent field names and derivation logic across endpoints.
 *
 * The frontend MUST NOT derive canSubmit, remaining, or upgradeHintEligible
 * on its own — these are computed server-side only.
 */

import type { UsageStatus } from "./tracker";

export type IdentityType = "anonymous" | "lead" | "authenticated";

export interface QuotaResponse {
  identityType: IdentityType;
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  resetAt: string;       // ISO 8601 (next JST midnight)
  resetAtText: string;   // Localized human-readable
  canSubmit: boolean;
  upgradeHintEligible: boolean;
}

/**
 * Compute the next JST midnight as an ISO 8601 string.
 */
function nextJstMidnightISO(): string {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const nextMidnight = new Date(jstNow);
  nextMidnight.setUTCHours(24, 0, 0, 0);
  // Convert back from JST-shifted to real UTC
  const realUtc = new Date(nextMidnight.getTime() - 9 * 60 * 60 * 1000);
  return realUtc.toISOString();
}

/**
 * Derive the identity type from auth state.
 * - authenticated: user has a valid JWT (logged in)
 * - lead: user has provided contact info but not fully verified (for now, same as authenticated since login = contact capture)
 * - anonymous: no auth token
 */
export function deriveIdentityType(
  isAuthenticated: boolean,
  _contactProvided?: boolean
): IdentityType {
  if (isAuthenticated) return "authenticated";
  // Future: if contactProvided but not authenticated, return "lead"
  return "anonymous";
}

/**
 * Build a standardized quota response from a UsageStatus.
 * This is the ONLY function that should produce quota data for API responses.
 */
export function buildQuotaResponse(
  status: UsageStatus,
  identityType?: IdentityType
): QuotaResponse {
  const type = identityType ?? deriveIdentityType(status.isAuthenticated);
  const remaining = Math.max(0, status.limit - status.used);

  return {
    identityType: type,
    dailyLimit: status.limit,
    usedToday: status.used,
    remaining,
    resetAt: nextJstMidnightISO(),
    resetAtText: status.resetAtText,
    canSubmit: remaining > 0,
    upgradeHintEligible: status.used >= 20,
  };
}
