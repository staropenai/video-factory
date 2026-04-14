"use client";
/**
 * EvidenceModal — shows complete hash + timestamp + verification guide
 *
 * maturity: skeleton
 * notEquivalentTo: not a blockchain explorer. The hash is a local SHA-256
 *   of the analysis data, not a blockchain transaction hash.
 *
 * Layout: normal-flow (NOT position:fixed — see mobile constraint §3.8)
 */

import React, { useRef } from "react";

interface EvidenceModalProps {
  evidenceHash:  string;
  timestamp:     string;
  analysisId:    string;
  locale:        string;
  isOpen:        boolean;
  onClose:       () => void;
}

export function EvidenceModal({
  evidenceHash, timestamp, analysisId, locale, isOpen, onClose,
}: EvidenceModalProps) {
  const hashRef = useRef<HTMLElement>(null);

  if (!isOpen) return null;

  const formattedTime = new Date(timestamp).toLocaleString(
    locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "zh-Hans-CN",
    { year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" }
  );

  function copyHash() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(evidenceHash).catch(() => {});
  }

  const isEn = locale === "en";

  return (
    // normal-flow faux-modal: contributes layout height, no fixed positioning
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-modal-title"
      style={{
        margin: "0 20px 16px",
        padding: "16px",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        background: "var(--color-background-primary)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <h3 id="evidence-modal-title" style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>
          {isEn ? "Evidence record" : "存证记录"}
        </h3>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16,
                   color: "var(--color-text-secondary)", minHeight: 44, minWidth: 44,
                   display: "flex", alignItems: "center", justifyContent: "center" }}
          aria-label={isEn ? "Close" : "关闭"}
        >
          ✕
        </button>
      </div>

      {/* Timestamp */}
      <div style={fieldStyle}>
        <p style={labelStyle}>{isEn ? "Timestamp" : "时间戳"}</p>
        <p style={valueStyle}>{formattedTime}</p>
      </div>

      {/* Hash — full, copyable */}
      <div style={fieldStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={labelStyle}>{isEn ? "SHA-256 digest" : "SHA-256 哈希摘要"}</p>
          <button onClick={copyHash} style={copyBtnStyle}>
            {isEn ? "Copy" : "复制"}
          </button>
        </div>
        <code
          ref={hashRef}
          style={{
            display: "block", fontSize: 11, fontFamily: "var(--font-mono)",
            wordBreak: "break-all", color: "var(--color-text-primary)",
            background: "var(--color-background-secondary)",
            padding: "8px 10px", borderRadius: "var(--border-radius-md)",
            lineHeight: 1.6, userSelect: "all",
          }}
        >
          {evidenceHash}
        </code>
      </div>

      {/* Verification guide */}
      <div style={{ ...fieldStyle, marginBottom: 0 }}>
        <p style={labelStyle}>{isEn ? "How to verify" : "如何验证"}</p>
        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.6, margin: 0 }}>
          {isEn
            ? "To verify this analysis has not been tampered with: compute the SHA-256 hash of the original analysis JSON and compare it with the digest above. They must match exactly. The hash above is a local record — it is not a blockchain transaction."
            : "要验证此分析记录未被篡改：对原始分析 JSON 计算 SHA-256 哈希值，与上方摘要对比，必须完全一致。上方哈希为本地存证记录，非区块链交易。"}
        </p>
      </div>

      {/* Disclaimer */}
      <p style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 10, lineHeight: 1.5 }}>
        {isEn
          ? "This evidence record is for reference transparency and does not have legal force. Analysis results remain for reference only — verify with a licensed professional before any transaction."
          : "本存证记录用于透明度参考，不构成法律效力。分析结果仍仅供参考，交易前请与持牌专业人士确认。"}
      </p>
    </div>
  );
}

const fieldStyle: React.CSSProperties = { marginBottom: 12 };
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 4px",
};
const valueStyle: React.CSSProperties = {
  fontSize: 13, color: "var(--color-text-primary)", margin: 0,
};
const copyBtnStyle: React.CSSProperties = {
  fontSize: 11, color: "#1D9E75", background: "none", border: "none",
  cursor: "pointer", fontFamily: "var(--font-sans)", padding: "2px 6px",
};
