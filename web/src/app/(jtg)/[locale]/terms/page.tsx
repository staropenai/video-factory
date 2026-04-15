"use client";

/**
 * /[locale]/terms — Terms of Service
 * Maturity: skeleton — content to be filled by legal team
 */

import { use } from "react";
import { getCopy, type Locale } from "@/lib/i18n/homepage";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default function TermsPage({ params }: PageProps) {
  const { locale: rawLocale } = use(params);
  const locale = rawLocale as Locale;
  const copy = getCopy(locale);

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", minHeight: "100vh", background: "var(--color-background-primary)" }}>
      <nav style={{ padding: "12px 20px", fontSize: 12, color: "var(--color-text-secondary)" }}>
        <a href={`/${locale}`} style={{ color: "#1D9E75", textDecoration: "none" }}>
          Home
        </a>
        {" > "}
        <span>{copy.footerTerms}</span>
      </nav>

      <header style={{ padding: "0 20px 20px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
          {copy.footerTerms}
        </h1>
      </header>

      <section style={{ padding: "0 20px 40px" }}>
        <div style={{
          padding: "16px",
          border: "1px dashed var(--color-border-tertiary)",
          borderRadius: 8,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.8,
        }}>
          <p style={{ margin: "0 0 12px" }}>
            {locale === "zh-Hans" ? "服务条款" : locale === "ja" ? "利用規約" : "Terms of Service"}
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>{locale === "zh-Hans" ? "本平台提供信息辅助服务，不构成法律、税务或投资建议" : "This platform provides informational assistance, not legal, tax, or investment advice"}</li>
            <li>{locale === "zh-Hans" ? "AI 分析结果仅供参考，签约前请与专业人士确认" : "AI analysis is for reference only — verify with professionals before signing"}</li>
            <li>{locale === "zh-Hans" ? "用户应对上传内容的合法性负责" : "Users are responsible for the legality of uploaded content"}</li>
            <li>{locale === "zh-Hans" ? "平台保留在违反条款时限制访问的权利" : "We reserve the right to restrict access for terms violations"}</li>
          </ul>
          <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--color-text-tertiary)" }}>
            {locale === "zh-Hans" ? "本页面内容待法务团队完善。" : "This page is pending legal review."}
          </p>
        </div>
      </section>

      <footer style={{ padding: "14px 20px", borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
        <p style={{ margin: 0 }}>{copy.footerComplianceNote}</p>
      </footer>
    </div>
  );
}
