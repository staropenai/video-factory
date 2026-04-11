"use client";

import type { FormEvent } from "react";
import { useState } from "react";

/**
 * Contact page — general inquiry form.
 *
 * Structural pattern preserved from old escalation page.
 * Form submission is a stub — logs to console in staging.
 * All copy is placeholder.
 */

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // [Default Assumption] Stub — no backend form handler in staging.
    console.log("[contact_submission]", { name, email, message });
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
        <h1 className="text-display max-w-3xl">
          Get in touch.
        </h1>
        <p className="mt-6 text-body-lg text-muted max-w-2xl">
          TBD_CONTACT_DESCRIPTION
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
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
      </section>
    </>
  );
}
