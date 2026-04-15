"use client";

/**
 * /[locale]/verify-evidence — Evidence Verification
 * Maturity: skeleton — will integrate with evidence registry when ready
 */

import { use } from "react";
import { getCopy, type Locale } from "@/lib/i18n/homepage";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default function VerifyEvidencePage({ params }: PageProps) {
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
        <span>{copy.footerEvidenceVerify}</span>
      </nav>

      <header style={{ padding: "0 20px 20px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
          {copy.footerEvidenceVerify}
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 8, lineHeight: 1.6 }}>
          {isZh
            ? "验证您的分析记录是否完整、未被篡改。输入存证哈希摘要进行核查。"
            : "Verify that your analysis records are complete and unaltered. Enter the evidence hash to check."}
        </p>
      </header>

      <section style={{ padding: "0 20px 40px" }}>
        {/* Hash input */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
            {isZh ? "存证哈希摘要（SHA-256）" : "Evidence Hash (SHA-256)"}
          </label>
          <input
            type="text"
            placeholder={isZh ? "输入或粘贴哈希值…" : "Enter or paste hash..."}
            style={{
              width: "100%",
              padding: "10px 14px",
              fontSize: 13,
              fontFamily: "var(--font-mono, monospace)",
              border: "1px solid var(--color-border-secondary)",
              borderRadius: 8,
              background: "var(--color-background-primary)",
              color: "var(--color-text-primary)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <button
            disabled
            style={{
              marginTop: 10,
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 500,
              background: "#1D9E75",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "not-allowed",
              opacity: 0.5,
              minHeight: 44,
            }}
          >
            {isZh ? "验证（功能开发中）" : "Verify (coming soon)"}
          </button>
        </div>

        {/* How it works */}
        <div style={{
          padding: "14px",
          border: "1px solid var(--color-border-tertiary)",
          borderRadius: 8,
          background: "var(--color-background-secondary)",
          fontSize: 12,
          color: "var(--color-text-secondary)",
          lineHeight: 1.7,
        }}>
          <p style={{ fontWeight: 500, margin: "0 0 8px", color: "var(--color-text-primary)" }}>
            {isZh ? "工作原理" : "How it works"}
          </p>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>{isZh ? "每次分析生成 SHA-256 哈希摘要" : "Each analysis generates a SHA-256 hash"}</li>
            <li>{isZh ? "哈希摘要记录分析内容的「指纹」，任何修改都会导致哈希值完全不同" : "The hash is a fingerprint — any modification changes it completely"}</li>
            <li>{isZh ? "输入哈希值即可验证记录是否与原始分析一致" : "Enter the hash to verify the record matches the original analysis"}</li>
          </ol>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--color-text-tertiary)" }}>
            {isZh ? "注意：我们保存哈希摘要，不保存文件原文。" : "Note: we store the hash, not the original file."}
          </p>
        </div>
      </section>

      <footer style={{ padding: "14px 20px", borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
        <p style={{ margin: 0 }}>{copy.footerComplianceNote}</p>
      </footer>
    </div>
  );
}
