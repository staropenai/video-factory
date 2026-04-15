"use client";

/**
 * /[locale]/privacy — Privacy Policy
 * Maturity: skeleton — content to be filled by legal team
 */

import { use } from "react";
import { getCopy, type Locale } from "@/lib/i18n/homepage";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default function PrivacyPage({ params }: PageProps) {
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
        <span>{copy.footerPrivacy}</span>
      </nav>

      <header style={{ padding: "0 20px 20px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
          {copy.footerPrivacy}
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
            {locale === "zh-Hans" ? "隐私政策" : locale === "ja" ? "プライバシーポリシー" : "Privacy Policy"}
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>{locale === "zh-Hans" ? "我们收集的数据：分析截图（临时存储）、操作时间戳、匿名使用统计" : "Data we collect: analysis screenshots (temporary), operation timestamps, anonymous usage statistics"}</li>
            <li>{locale === "zh-Hans" ? "我们不收集的数据：真实姓名、身份证号、银行信息" : "Data we do not collect: real names, ID numbers, bank information"}</li>
            <li>{locale === "zh-Hans" ? "数据用途：仅用于为您提供服务，不用于广告投放" : "Data usage: only for providing our service, never for advertising"}</li>
            <li>{locale === "zh-Hans" ? "数据共享：不向第三方出售或共享原始数据" : "Data sharing: we do not sell or share raw data with third parties"}</li>
            <li>{locale === "zh-Hans" ? "数据删除：您可以随时要求删除您的记录" : "Data deletion: you can request deletion of your records at any time"}</li>
          </ul>
          <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--color-text-tertiary)" }}>
            {locale === "zh-Hans" ? "本页面内容待法务团队完善。如有疑问，请联系客服。" : "This page is pending legal review. Contact support for questions."}
          </p>
        </div>
      </section>

      <footer style={{ padding: "14px 20px", borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
        <p style={{ margin: 0 }}>{copy.footerComplianceNote}</p>
      </footer>
    </div>
  );
}
