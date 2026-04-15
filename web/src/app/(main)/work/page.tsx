import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Services — Japan Trust Gateway",
  description:
    "Housing guidance services for foreigners in Japan — rental support, contract help, and living assistance",
};

/**
 * Work / Services page — what we offer.
 */

const offerings = [
  {
    title: "Rental Guidance",
    desc: "Step-by-step help with finding apartments, understanding listings, and navigating the application process as a foreign resident.",
  },
  {
    title: "Contract & Document Support",
    desc: "Plain-language explanations of lease terms, required documents, guarantor options, and initial cost breakdowns.",
  },
  {
    title: "Living Support",
    desc: "Help with move-in setup, utility connections, garbage rules, and communicating with landlords and management companies.",
  },
  {
    title: "AI + Human Assistance",
    desc: "Get instant answers from our knowledge base, with licensed real estate professionals available for complex situations.",
  },
];

export default function WorkPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 md:pt-32 md:pb-20">
        <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
          Services
        </p>
        <h1 className="text-display max-w-3xl">
          How we help
        </h1>
        <p className="mt-6 text-body-lg text-muted max-w-2xl">
          Practical support for every stage of housing in Japan — from first
          search to move-out.
        </p>
      </section>

      <section className="bg-surface border-y border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {offerings.map((item) => (
              <div
                key={item.title}
                className="p-6 rounded-2xl border border-border hover:border-foreground/20 transition-all"
              >
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="text-headline">Ready to get started?</h2>
        <p className="mt-4 text-muted max-w-md mx-auto">
          Ask a question through our AI guide or contact our team directly for
          personalized support.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <Link
            href="/try"
            className="inline-flex items-center px-8 py-3.5 bg-foreground text-surface rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Ask a question
          </Link>
          <Link
            href="/contact"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Or contact us directly
          </Link>
        </div>
      </section>
    </>
  );
}
