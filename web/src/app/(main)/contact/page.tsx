"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { COMPANY } from "@/lib/company";
import { devLog } from "@/lib/utils/dev-log";

/**
 * Contact page — general inquiry form with company info.
 *
 * Structural pattern preserved from old escalation page.
 * Form submission is a stub — logs to console in staging.
 */

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    devLog("[contact_submission]", { name, email, message });
    // Best-effort POST — UI shows success regardless so we don't block the user.
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
    } catch {
      // Network failure — still show thank-you screen.
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 md:pt-32">
        <div className="max-w-lg">
          <div className="p-6 rounded-2xl border border-success/30 bg-success/5">
            <h2 className="text-headline">Thank you.</h2>
            <p className="mt-3 text-muted">
              We&apos;ve received your message and will be in touch soon.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 md:pt-32 md:pb-20">
        <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
          Contact
        </p>
        <h1 className="text-display max-w-3xl">Get in touch.</h1>
        <p className="mt-6 text-body-lg text-muted max-w-2xl">
          Questions about renting, contracts, or living in Japan? Send us a
          message and our team will respond within 1–3 business days.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-2 space-y-6 max-w-lg"
          >
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium mb-2"
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium mb-2"
              >
                Message
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-y"
              />
            </div>

            <button
              type="submit"
              className="px-8 py-3 bg-foreground text-surface rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Send message
            </button>
          </form>

          {/* Company info sidebar */}
          <aside className="lg:col-span-1">
            <div className="rounded-2xl border border-border bg-surface/50 p-6 space-y-5">
              <div>
                <p className="font-medium">{COMPANY.legalNameJa}</p>
                <p className="text-sm text-muted">{COMPANY.legalNameEn}</p>
              </div>

              <div className="text-sm text-muted space-y-1">
                <p>
                  {COMPANY.address.postal} {COMPANY.address.full}
                </p>
              </div>

              <div className="text-sm text-muted space-y-1">
                <p>TEL: {COMPANY.tel}</p>
                <p>
                  Email:{" "}
                  <a
                    href={`mailto:${COMPANY.email}`}
                    className="underline hover:text-foreground transition-colors"
                  >
                    {COMPANY.email}
                  </a>
                </p>
              </div>

              <div className="text-sm text-muted space-y-1">
                {COMPANY.credentials.map((c) => (
                  <p key={c.en}>
                    {c.ja}
                    <br />
                    <span className="text-xs">{c.en}</span>
                  </p>
                ))}
              </div>

              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted">
                  Response time: 1–3 business days
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
