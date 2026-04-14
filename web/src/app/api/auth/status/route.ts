import { NextRequest } from "next/server";
import { ok, rateLimited } from "@/lib/utils/api-response";
import { resolveIdentity } from "@/lib/auth/identity";
import { getUsageStatus } from "@/lib/quota/tracker";
import { checkRateLimit, extractClientIp } from "@/lib/security/rate-limit";

export async function GET(req: NextRequest) {
  // Rate limit: 60 req/min per IP
  const rl = checkRateLimit(
    `auth-status:${extractClientIp(req.headers)}`,
    { windowMs: 60_000, maxRequests: 60 },
  );
  if (!rl.allowed) {
    return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));
  }

  const lang = req.nextUrl.searchParams.get("lang") ?? "zh";
  const identity = await resolveIdentity();
  const status = await getUsageStatus(identity.uid, identity.isAuthenticated, lang);

  return ok({
    identityType: identity.isAuthenticated ? "authenticated" : "anonymous",
    remaining: status.remaining,
    canSubmit: status.remaining > 0,
    used: status.used,
    limit: status.limit,
    showUpgradeHint: status.showUpgradeHint,
    resetAtText: status.resetAtText,
  });
}
