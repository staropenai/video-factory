// GET /api/pricing/summary?locale=zh-Hans
// Returns pricing plans for the upgrade page

import { NextRequest } from "next/server";
import { ok, rateLimited } from "@/lib/utils/api-response";
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit';

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(`pricing:${extractClientIp(request.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  const locale = request.nextUrl.searchParams.get("locale") ?? "zh-Hans";

  // In production: localized pricing from DB/config
  return ok({
    title: "继续使用会更省事",
    plans: [
      {
        key: "starter",
        title: "Starter",
        priceText: "¥500/月",
        features: ["AI 每天 20 次", "沟通脚本不限次", "历史记录保存"],
      },
      {
        key: "pro",
        title: "Pro",
        priceText: "¥1,200/月",
        features: [
          "AI 每天 100 次",
          "沟通脚本不限次",
          "优先人工帮助",
          "合同审查辅助",
        ],
      },
    ],
    payPerUse: [
      {
        key: "deep_qa",
        title: "深度问答包",
        priceText: "¥300/次",
      },
    ],
  });
}
