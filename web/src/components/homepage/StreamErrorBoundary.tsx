"use client";

/**
 * components/homepage/StreamErrorBoundary.tsx
 *
 * React Error Boundary wrapping the AI response streaming area.
 * Catches unexpected runtime errors in AIResponseArea or its children
 * and shows a recoverable fallback instead of crashing the page.
 */

import React from "react";

interface Props {
  /** Localized error message */
  errorMessage: string;
  /** Localized retry label */
  retryLabel: string;
  /** Localized contact label */
  contactLabel: string;
  onContactSupport: () => void;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class StreamErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log but don't crash — the user can retry or contact support
    if (process.env.NODE_ENV !== "production") {
      console.error("[StreamErrorBoundary]", error, info.componentStack);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            margin: "0 20px 12px",
            padding: "12px 14px",
            fontSize: 13,
            color: "var(--color-text-danger, #A32D2D)",
            background: "var(--color-background-danger, #FCEBEB)",
            borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-danger, #F09595)",
          }}
        >
          <p style={{ margin: "0 0 8px" }}>{this.props.errorMessage}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={this.handleRetry}
              style={btnStyle}
            >
              {this.props.retryLabel}
            </button>
            <button
              onClick={this.props.onContactSupport}
              style={btnStyle}
            >
              {this.props.contactLabel}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const btnStyle: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  border: "0.5px solid var(--color-border-secondary)",
  borderRadius: "var(--border-radius-md)",
  background: "var(--color-background-primary)",
  color: "var(--color-text-primary)",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};
