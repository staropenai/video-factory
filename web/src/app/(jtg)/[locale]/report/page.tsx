"use client";

/**
 * /[locale]/report — Report Violation
 * Maturity: skeleton — will wire to reporting backend when ready
 */

import { use } from "react";
import { getCopy, type Locale } from "@/lib/i18n/homepage";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default function ReportPage({ params }: PageProps) {
  const { locale: rawLocale } = use(params);
  const locale = rawLocale as Locale;
  const copy = getCopy(locale);

  const isZh = locale === "zh-Hans";

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", minHeight: "100vh", background: "var(--color-background-primary)" }}>
      <nav style={{ padding: "12px 20px", fontSize: 12, color: "var(--color-text-secondary)" }}>
        <a href={`/${locale}`} style={{ color: "#1D9E75", textDecoration: "none" }}>
          Home
        </a>
        {" > "}
        <span>{copy.footerReportViolation}</span>
      </nav>

      <header style={{ padding: "0 20px 20px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
          {copy.footerReportViolation}
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 8, lineHeight: 1.6 }}>
          {isZh
            ? "如果您发现平台内容存在不准确、误导性信息或违规行为，请通过以下方式举报。"
            : "If you find inaccurate, misleading, or violating content on our platform, please report it below."}
        </p>
      </header>

      <section style={{ padding: "0 20px 40px" }}>
        <div style={{
          padding: "16px",
          border: "1px solid var(--color-border-tertiary)",
          borderRadius: 8,
          background: "var(--color-background-secondary)",
          fontSize: 13,
          lineHeight: 1.7,
          color: "var(--color-text-secondary)",
        }}>
          <p style={{ fontWeight: 500, margin: "0 0 12px", color: "var(--color-text-primary)" }}>
            {isZh ? "举报方式" : "How to report"}
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              {isZh ? "邮件：发送至 " : "Email: send to "}
              <span style={{ fontFamily: "var(--font-mono, monospace)", color: "#1D9E75" }}>
                {process.env.NEXT_PUBLIC_EMAIL_URL?.replace("mailto:", "") || "support@staropenai.com"}
              </span>
            </li>
            <li>{isZh ? "请注明：问题页面 URL、问题描述、截图（如有）" : "Please include: page URL, description of the issue, screenshot (if any)"}</li>
            <li>{isZh ? "我们将在 3 个工作日内回复" : "We will respond within 3 business days"}</li>
          </ul>
          <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--color-text-tertiary)" }}>
            {isZh ? "感谢您帮助我们维护平台内容质量。" : "Thank you for helping us maintain content quality."}
          </p>
        </div>
      </section>

      <footer style={{ padding: "14px 20px", borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
        <p style={{ margin: 0 }}>{copy.footerComplianceNote}</p>
      </footer>
    </div>
  );
}
