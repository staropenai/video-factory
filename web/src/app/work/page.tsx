import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Work — StartOpenAI",
  description: "TBD_WORK_DESCRIPTION",
};

/**
 * Work / Services page — what we offer.
 *
 * All copy is placeholder.
 */

const offerings = [
  {
    title: "TBD_SERVICE_1",
    desc: "TBD_SERVICE_1_DESCRIPTION",
  },
  {
    title: "TBD_SERVICE_2",
    desc: "TBD_SERVICE_2_DESCRIPTION",
  },
  {
    title: "TBD_SERVICE_3",
    desc: "TBD_SERVICE_3_DESCRIPTION",
  },
  {
    title: "TBD_SERVICE_4",
    desc: "TBD_SERVICE_4_DESCRIPTION",
  },
];

export default function WorkPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 md:pt-32 md:pb-20">
        <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
          Work
        </p>
        <h1 className="text-display max-w-3xl">
          TBD_WORK_HEADLINE
        </h1>
        <p className="mt-6 text-body-lg text-muted max-w-2xl">
          TBD_WORK_SUBHEADLINE
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
        <h2 className="text-headline">TBD_WORK_CTA_HEADLINE</h2>
        <p className="mt-4 text-muted max-w-md mx-auto">
          TBD_WORK_CTA_DESCRIPTION
        </p>
        <div className="mt-8">
          <Link
            href="/contact"
            className="inline-flex items-center px-8 py-3.5 bg-foreground text-surface rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Get in touch
          </Link>
        </div>
      </section>
    </>
  );
}
