import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "About — Japan Trust Gateway",
  description:
    "About Japan Trust Gateway — trusted housing guidance for foreigners in Japan",
};

/**
 * About page — methodology, principles, trust.
 *
 * Structural pattern preserved from old method page.
 */

const principles = [
  {
    num: "01",
    title: "Accuracy first",
    desc: "Every answer is grounded in official sources, real regulations, and verified practice. We never guess on legal or financial matters.",
  },
  {
    num: "02",
    title: "Your language, their system",
    desc: "We bridge the gap between Japanese housing rules and the languages you actually speak — Chinese, English, and Japanese.",
  },
  {
    num: "03",
    title: "Human when it matters",
    desc: "AI handles routine questions fast. But for contracts, disputes, and complex decisions, licensed professionals step in.",
  },
  {
    num: "04",
    title: "Transparent boundaries",
    desc: "We clearly mark what we know, what needs official confirmation, and when you should consult a specialist.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 md:pt-32 md:pb-20">
        <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
          About
        </p>
        <h1 className="text-display max-w-3xl">
          Trusted housing guidance for foreigners in Japan
        </h1>
        <p className="mt-6 text-body-lg text-muted max-w-2xl">
          Japan Trust Gateway helps foreign residents navigate renting, buying,
          and living in Japan — with verified information in your language.
        </p>
      </section>

      {/* Principles */}
      <section className="bg-surface border-y border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
            Our principles
          </p>
          <h2 className="text-headline mb-12">What we stand for</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {principles.map((p) => (
              <div key={p.num} className="flex gap-5">
                <span className="text-3xl font-light text-border shrink-0 w-10">
                  {p.num}
                </span>
                <div>
                  <h3 className="font-medium">{p.title}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    {p.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-headline">
            Have a question about housing in Japan?
          </h2>
          <p className="mt-4 text-muted">
            Whether you are preparing to move, dealing with a landlord issue, or
            trying to understand your lease — we can help.
          </p>
          <div className="mt-8">
            <Link
              href="/contact"
              className="inline-flex items-center px-6 py-3 bg-foreground text-surface rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Get in touch
            </Link>
          </div>
        </div>
      </section>

      {/* Company identity */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="max-w-2xl rounded-2xl border border-border bg-surface/50 p-8">
          <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
            Operating company
          </p>
          <p className="font-medium">{COMPANY.legalNameJa}</p>
          <p className="text-sm text-muted">{COMPANY.legalNameEn}</p>

          <div className="mt-4 space-y-1 text-sm text-muted">
            {COMPANY.credentials.map((c) => (
              <p key={c.en}>
                {c.ja} / {c.en}
              </p>
            ))}
          </div>

          <div className="mt-4 space-y-1 text-sm text-muted">
            <p>
              {COMPANY.address.postal} {COMPANY.address.full}
            </p>
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
        </div>
      </section>
    </>
  );
}
