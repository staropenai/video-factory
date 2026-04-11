"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session-context";
import { submitEscalation, type EscalationResponse } from "@/lib/api-client";

const escalationReasons = [
  {
    title: "Legal or contract disputes",
    desc: "Questions about your rights, unfair charges, or contract interpretation need qualified human judgment.",
  },
  {
    title: "Complex visa situations",
    desc: "Non-standard visa status can affect your eligibility and required documents.",
  },
  {
    title: "Property viewing and negotiation",
    desc: "Scheduling viewings, negotiating terms, and coordinating with landlords.",
  },
  {
    title: "High-value or unusual transactions",
    desc: "Property purchases, commercial leases, or large financial commitments.",
  },
  {
    title: "Conflicting information",
    desc: "When sources disagree or your situation doesn't fit standard patterns.",
  },
  {
    title: "Urgent time-sensitive decisions",
    desc: "When you need to act quickly and cannot rely on general guidance alone.",
  },
];

export default function EscalationPage() {
  const { sessionId } = useSession();
  const [formData, setFormData] = useState({
    situation: "",
    email: "",
    language: "en",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EscalationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.situation.trim() || !formData.email.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await submitEscalation({
        query_text: formData.situation,
        reason: "User-submitted escalation request",
        email: formData.email,
        language: formData.language,
        session_id: sessionId || undefined,
        risk_level: "medium",
      });
      setResult(response);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to submit. The backend API may not be running."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <div className="max-w-2xl mb-16">
        <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
          Expert review
        </p>
        <h1 className="text-headline">
          Talk to someone
          <br />
          who can help.
        </h1>
        <p className="mt-4 text-body-lg text-muted">
          Some questions deserve a real conversation. Our housing consultants
          work with foreigners in Japan every day — they understand what
          you&apos;re going through.
        </p>
      </div>

      {/* Reasons */}
      <section className="mb-16">
        <h2 className="text-title mb-8">Situations where a consultant helps most</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {escalationReasons.map((reason) => (
            <div
              key={reason.title}
              className="p-5 rounded-xl border border-border"
            >
              <h3 className="font-medium text-sm mb-1.5">{reason.title}</h3>
              <p className="text-sm text-muted">{reason.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Submission result */}
      {result && (
        <div className="mb-8 p-6 rounded-2xl border-2 border-green-200 bg-green-50">
          <h3 className="font-semibold text-green-900 mb-2">
            Request submitted
          </h3>
          <p className="text-sm text-green-800 mb-3">{result.message}</p>
          <div className="text-xs text-green-700 space-y-1">
            <p>Escalation ID: {result.escalation_id}</p>
            <p>Decision ID: {result.decision_id}</p>
            <p>Email notification: {result.email_notification}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-8 p-6 rounded-2xl border border-danger/20 bg-red-50">
          <p className="text-sm text-danger font-medium mb-1">Submission failed</p>
          <p className="text-sm text-muted">{error}</p>
        </div>
      )}

      {/* Contact form */}
      {!result && (
        <section className="p-8 rounded-2xl border border-border bg-surface">
          <h2 className="text-title mb-2">Tell us what&apos;s going on</h2>
          <p className="text-sm text-muted mb-8">
            Describe your situation in your own words. A housing consultant
            will read this and respond — usually within one business day.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Your situation <span className="text-danger">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={formData.situation}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, situation: e.target.value }))
                }
                placeholder="Describe your housing situation or question..."
                className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Preferred language
                </label>
                <select
                  value={formData.language}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      language: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                >
                  <option value="en">English</option>
                  <option value="zh">中文</option>
                  <option value="ja">日本語</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !formData.situation.trim() || !formData.email.trim()}
              className="px-6 py-3 bg-foreground text-surface rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Send request"}
            </button>
          </form>

          <p className="mt-6 text-xs text-muted">
            We typically respond within 1 business day. Your information is
            only used to help with your housing question.
          </p>
        </section>
      )}

      <div className="mt-12 text-center">
        <Link
          href="/knowledge"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          &larr; Back to knowledge base
        </Link>
      </div>
    </div>
  );
}
