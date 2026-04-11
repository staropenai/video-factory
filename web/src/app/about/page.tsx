import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — StartOpenAI",
  description: "TBD_ABOUT_DESCRIPTION",
};

/**
 * About page — methodology, principles, trust.
 *
 * Structural pattern preserved from old method page.
 * All copy is placeholder.
 */

const principles = [
  {
    num: "01",
    title: "TBD_PRINCIPLE_1",
    desc: "TBD_PRINCIPLE_1_DESCRIPTION",
  },
  {
    num: "02",
    title: "TBD_PRINCIPLE_2",
    desc: "TBD_PRINCIPLE_2_DESCRIPTION",
  },
  {
    num: "03",
    title: "TBD_PRINCIPLE_3",
    desc: "TBD_PRINCIPLE_3_DESCRIPTION",
  },
  {
    num: "04",
    title: "TBD_PRINCIPLE_4",
    desc: "TBD_PRINCIPLE_4_DESCRIPTION",
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
          TBD_ABOUT_HEADLINE
        </h1>
        <p className="mt-6 text-body-lg text-muted max-w-2xl">
          TBD_ABOUT_SUBHEADLINE
        </p>
      </section>

      {/* Principles */}
      <section className="bg-surface border-y border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
            Our principles
          </p>
          <h2 className="text-headline mb-12">
            TBD_PRINCIPLES_HEADLINE
          </h2>
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
          <h2 className="text-headline">TBD_ABOUT_CTA_HEADLINE</h2>
          <p className="mt-4 text-muted">
            TBD_ABOUT_CTA_DESCRIPTION
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
    </>
  );
}
