"use client";

/**
 * /[locale]/trust-center — Trust Center (skeleton)
 *
 * Maturity: skeleton — will be completed when evidence system is ready.
 * Contains 5 verifiable commitments with anchors:
 *   #identity, #documents, #process, #risk, #data
 */

import { use } from "react";
import { getCopy, type Locale } from "@/lib/i18n/homepage";
import { TrustCommitmentCard } from "@/components/homepage/TrustCommitmentCard";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default function TrustCenterPage({ params }: PageProps) {
  const { locale: rawLocale } = use(params);
  const locale = rawLocale as Locale;
  const copy = getCopy(locale);

  const commitments = [
    {
      id: "identity",
      icon: "🛡️",
      title: copy.trustPromise1,
      summary: copy.trustPromise1Detail,
      detail: copy.trustPromise1Detail,
      status: "verified" as const,
      actions: [{ label: copy.trustAction1Label, href: "https://etsuran.mlit.go.jp/TAKKEN/takkenKensaku.do", external: true }],
    },
    {
      id: "documents",
      icon: "📄",
      title: copy.trustPromise2,
      summary: copy.trustPromise2Detail,
      detail: copy.trustPromise2Detail,
      status: "verified" as const,
      actions: [
        { label: copy.trustAction2aLabel },
        { label: copy.trustAction2bLabel },
      ],
    },
    {
      id: "process",
      icon: "📋",
      title: copy.trustPromise3,
      summary: copy.trustPromise3Detail,
      detail: copy.trustPromise3Detail,
      status: "verified" as const,
      actions: [{ label: `${copy.trustAction3Label} (${copy.trustAction3LoginHint})` }],
    },
    {
      id: "risk",
      icon: "⚠️",
      title: copy.trustPromise4,
      summary: copy.trustPromise4Detail,
      detail: copy.trustPromise4Detail,
      status: "partial" as const,
      actions: [{ label: copy.trustAction4Label }],
    },
    {
      id: "data",
      icon: "🔒",
      title: copy.trustPromise5,
      summary: copy.trustPromise5Detail,
      detail: copy.trustPromise5Detail,
      status: "verified" as const,
      actions: [
        { label: copy.trustAction5aLabel, href: `/${locale}/privacy` },
        { label: copy.trustAction5bLabel },
      ],
    },
  ];

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", minHeight: "100vh", background: "var(--color-background-primary)" }}>
      {/* Breadcrumb */}
      <nav style={{ padding: "12px 20px", fontSize: 12, color: "var(--color-text-secondary)" }}>
        <a href={`/${locale}`} style={{ color: "#1D9E75", textDecoration: "none" }}>
          {copy.eyebrow.split("?")[0] || "Home"}
        </a>
        {" > "}
        <span>{copy.trustCenterNavLabel}</span>
      </nav>

      <header style={{ padding: "0 20px 20px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
          {copy.trustCenterNavLabel}
        </h1>
      </header>

      <section style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {commitments.map((c) => (
          <div key={c.id} id={c.id}>
            <TrustCommitmentCard
              icon={c.icon}
              title={c.title}
              summary={c.summary}
              detail={c.detail}
              actions={c.actions}
              status={c.status}
              locale={locale}
              commitmentName={c.id}
            />
          </div>
        ))}
      </section>

      <footer style={{ padding: "14px 20px", borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
        <p style={{ margin: 0 }}>{copy.footerComplianceNote}</p>
      </footer>
    </div>
  );
}
