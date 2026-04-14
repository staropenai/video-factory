"use client";

/**
 * app/(jtg)/[locale]/error.tsx — Route-level error boundary.
 *
 * Catches unhandled runtime errors that escape the component-level
 * StreamErrorBoundary. Provides a full-page recovery UI with retry
 * and contact support options.
 *
 * Next.js automatically wraps this in a React Error Boundary.
 */

import { useEffect } from "react";

export default function JTGError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[JTG Error Boundary]", error);
    }
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        textAlign: "center",
        background: "var(--color-background-primary, #fff)",
        color: "var(--color-text-primary, #1a1a1a)",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
        }}
      >
        {/* Icon */}
        <div
          style={{
            fontSize: 40,
            marginBottom: 16,
            opacity: 0.6,
          }}
          aria-hidden="true"
        >
          &#9888;
        </div>

        {/* Title — kept minimal, works across all locales */}
        <h1
          style={{
            fontSize: 18,
            fontWeight: 600,
            margin: "0 0 8px",
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-secondary, #666)",
            margin: "0 0 24px",
            lineHeight: 1.6,
          }}
        >
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={reset}
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 500,
              background: "#1D9E75",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Try again
          </button>
          <a
            href="/contact"
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 500,
              background: "transparent",
              color: "var(--color-text-primary, #1a1a1a)",
              border: "1px solid var(--color-border-secondary, #ddd)",
              borderRadius: 8,
              textDecoration: "none",
              fontFamily: "inherit",
            }}
          >
            Contact support
          </a>
        </div>

        {/* Error digest for support reference */}
        {error.digest && (
          <p
            style={{
              fontSize: 11,
              color: "var(--color-text-tertiary, #999)",
              marginTop: 20,
            }}
          >
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
