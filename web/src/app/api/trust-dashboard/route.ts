/**
 * GET /api/trust-dashboard?analysisId={uuid}&lang={locale}
 *
 * maturity: skeleton
 * notEquivalentTo: not a real blockchain attestation system.
 *   Returns derived trust state from the analysis record.
 *   evidenceHash is a SHA-256 of the analysis JSON, NOT a blockchain transaction.
 *
 * Security constraints (Security_Master_V2):
 *   - analysisId must belong to the current session (or be anonymous session-scoped)
 *   - Never expose internal IDs, DB row IDs, or raw model outputs
 *   - All status values computed server-side — frontend receives read-only state
 *   - evidence_write_failed must surface to the user, never silently swallowed (ω5)
 *
 * Rate limit: 30 req/min per IP
 */

import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { ok, fail, rateLimited } from "@/lib/utils/api-response";
import {
  checkRateLimit,
  extractClientIp,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rate-limit";
import { resolveIdentity } from "@/lib/auth/identity";

// ── Types ────────────────────────────────────────────────────────────────────

type TrustStatusCode = "verified" | "partial" | "risk" | "unknown" | "pending";
type RiskLevel       = "low" | "medium" | "high" | "unknown";
type EngineTier      = "tier-a-keyword" | "tier-b-semantic" | "tier-c-llm";
type ConfidenceLevel = "high" | "medium" | "low";

interface TrustDashboardData {
  analysisId:            string;
  listingStatus:         TrustStatusCode;
  documentCompleteness:  TrustStatusCode;
  riskSummary:           RiskLevel;
  riskBasis:             string;
  riskKnownItems:        string[];
  riskUnknownItems:      string[];
  costTransparency:      TrustStatusCode;
  costEstimate?:         { min: number; max: number; currency: "JPY" };
  onlineEligible:        boolean;
  evidenceTimestamp?:    string;
  evidenceHash?:         string;
  engineTier:            EngineTier;
  confidenceLevel:       ConfidenceLevel;
  dataSources:           Array<{ label: string; url?: string; external: true }>;
  disclaimer:            string;
  trustDashboardReady:   boolean;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Rate limit
  const rl = checkRateLimit(
    `trust-dash:${extractClientIp(req.headers)}`,
    RATE_LIMIT_PRESETS.ai,
  );
  if (!rl.allowed) {
    return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));
  }

  const { searchParams } = req.nextUrl;
  const analysisId = searchParams.get("analysisId");
  const lang       = searchParams.get("lang") ?? "zh-Hans";

  if (!analysisId || !/^[0-9a-f-]{36}$/i.test(analysisId)) {
    return fail("invalid_analysis_id", 400);
  }

  // Session check: anonymous sessions can query their own analysisId
  // Real auth binding deferred until identity system is upgraded (ω3)
  const _identity = await resolveIdentity();

  // ── Stub implementation (skeleton) ────────────────────────────────────────
  // TODO: Replace with real DB lookup of analysis_records when evidence system is ready.
  // For now: derive a deterministic trust state from the analysisId itself
  // so the frontend can be built and tested end-to-end.

  const evidenceTimestamp = new Date().toISOString();

  // Generate a deterministic hash from analysisId + timestamp for demo
  // This is NOT a real blockchain hash — it is a local SHA-256
  let evidenceHash: string | undefined;
  let evidenceWriteFailed = false;
  try {
    evidenceHash = createHash("sha256")
      .update(`${analysisId}:${evidenceTimestamp}`)
      .digest("hex");
  } catch {
    evidenceWriteFailed = true;
    // ω5: evidence write failure must NOT be silent
    console.error("[trust-dashboard] evidence hash generation failed", { analysisId });
  }

  // Stub risk data — replace with real analysis record lookup
  const data: TrustDashboardData = {
    analysisId,
    listingStatus:        "partial",
    documentCompleteness: "partial",
    riskSummary:          "medium",
    riskBasis:            lang === "en"
      ? "Based on screenshot extraction. Some fields could not be confirmed."
      : "基于截图提取，部分字段未能确认。",
    riskKnownItems: lang === "en"
      ? ["Security deposit clause requires human verification",
         "Short-term cancellation penalty clause present"]
      : ["押金条款需要人工核实", "短期解约违约金条款存在"],
    riskUnknownItems: lang === "en"
      ? ["Specific loan conditions", "Personal tax situation", "Guarantor company specific terms"]
      : ["具体贷款条件", "个人税务状况", "保证会社具体条款"],
    costTransparency: "partial",
    onlineEligible:   true,
    evidenceTimestamp: evidenceWriteFailed ? undefined : evidenceTimestamp,
    evidenceHash:      evidenceWriteFailed ? undefined : evidenceHash,
    engineTier:        "tier-c-llm",
    confidenceLevel:   "medium",
    dataSources: [
      {
        label: lang === "en"
          ? "MLIT Guidelines on Restoration to Original Condition"
          : "国土交通省 原状回復をめぐるトラブルとガイドライン",
        url: "https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000021.html",
        external: true as const,
      },
      {
        label: lang === "en"
          ? "National Consumer Affairs Center — Rental Housing Disputes"
          : "国民生活中心「賃貸住宅のトラブル」",
        url: "https://www.kokusen.go.jp/",
        external: true as const,
      },
    ],
    // Server controls disclaimer copy — frontend MUST display this verbatim
    disclaimer: lang === "en"
      ? "Analysis is based on screenshot content only and is for reference. Verify all details with a licensed professional before signing."
      : "分析基于截图内容，仅供参考。签约前请与持牌专业人士确认所有细节。",
    trustDashboardReady: !evidenceWriteFailed,
  };

  // ω5: surface evidence failure to client, not silently ignore
  if (evidenceWriteFailed) {
    return ok({
      ...data,
      _evidenceError: true,
    });
  }

  return ok(data);
}
