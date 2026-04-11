import Link from "next/link";
import { sourceRegistry } from "@/lib/data/sources";

export const metadata = {
  title: "Our Method — StartOpenAI",
  description:
    "How we build trust: verified sources, honest limits, continuous review, human escalation.",
};

const principles = [
  {
    title: "Verified sources",
    desc: "Every piece of knowledge traces to an official source, provider documentation, or verified agent experience. We don't generate facts — we retrieve and structure them.",
    detail:
      "Our source registry tracks where each answer comes from, when it was last verified, and how frequently it should be refreshed.",
  },
  {
    title: "Honest limits",
    desc: "We explicitly mark what we know, what we're uncertain about, and what requires human expertise. Low confidence means we say so — we don't fill gaps with plausible-sounding guesses.",
    detail:
      "When retrieval results are sparse, sources conflict, or data is stale, the system blocks direct answers and either asks for clarification or escalates to a human.",
  },
  {
    title: "Structured rules",
    desc: "Business logic is encoded as testable rules, not hidden in prompts. Cost formulas, document requirements, and escalation conditions are explicit and version-controlled.",
    detail:
      "Each rule has defined inputs, outputs, and test cases. When rules conflict, the system escalates rather than guessing which one applies.",
  },
  {
    title: "Human escalation",
    desc: "High-risk situations, legal questions, and complex cases always go to qualified humans. Escalation is not failure — it's the system protecting you.",
    detail:
      "Every escalation records the reason, context, and outcome. Resolutions feed back into the knowledge base as new FAQ entries, updated rules, or regression test cases.",
  },
  {
    title: "Continuous review",
    desc: "Knowledge is reviewed regularly. Stale information is flagged. Corrections become permanent improvements. The system learns from its mistakes through structured iteration.",
    detail:
      "Our review layer checks source consistency, multilingual completeness, rule conflicts, and template integrity — automatically and continuously.",
  },
  {
    title: "Regression protection",
    desc: "When we fix something, we make sure it stays fixed. Every correction generates a test case that prevents the same error from recurring.",
    detail:
      "Our regression suite runs against every knowledge update, ensuring that improvements in one area don't break behavior in another.",
  },
];

const sourceTypeLabels: Record<string, string> = {
  official_government: "Government",
  official_provider: "Official Provider",
  internal_experience: "Agent Experience",
  legal_reference: "Legal",
  community_verified: "Community",
};

export default function MethodPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <div className="max-w-2xl mb-20">
        <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
          Our method
        </p>
        <h1 className="text-headline">How we build trust</h1>
        <p className="mt-4 text-body-lg text-muted">
          A knowledge system is only as good as its discipline. Here is how we
          ensure the guidance you receive is reliable, transparent, and
          continuously improving.
        </p>
      </div>

      {/* Principles */}
      <section className="mb-20">
        <div className="space-y-12">
          {principles.map((p, i) => (
            <div
              key={p.title}
              className="grid grid-cols-1 md:grid-cols-12 gap-6"
            >
              <div className="md:col-span-1">
                <span className="text-3xl font-light text-border">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="md:col-span-11">
                <h3 className="text-title mb-3">{p.title}</h3>
                <p className="text-muted leading-relaxed">{p.desc}</p>
                <p className="mt-3 text-sm text-muted/70 leading-relaxed">
                  {p.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Source registry */}
      <section className="mb-20">
        <h2 className="text-title mb-8">Our sources</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sourceRegistry
            .filter((s) => s.is_active)
            .map((source) => (
              <div
                key={source.source_key}
                className="p-5 rounded-xl border border-border"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-sm">{source.name.en}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent-light text-accent">
                    {sourceTypeLabels[source.source_type] || source.source_type}
                  </span>
                </div>
                <p className="text-sm text-muted mb-3">
                  {source.description.en}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span>
                    Refresh: {source.freshness_policy}
                  </span>
                  <span>
                    Verified: {source.last_verified_at}
                  </span>
                </div>
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-accent hover:underline"
                  >
                    Visit source &rarr;
                  </a>
                )}
              </div>
            ))}
        </div>
      </section>

      {/* What we don't do */}
      <section className="p-8 rounded-2xl border border-border bg-surface mb-16">
        <h2 className="text-title mb-6">What this system does not do</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            "Generate property facts without sources",
            "Make legal judgments or give legal advice",
            "Commit to prices, availability, or timelines",
            "Replace qualified human consultants",
            "Answer with false confidence when uncertain",
            "Store personal information permanently",
          ].map((item) => (
            <div key={item} className="flex gap-3 text-sm text-muted">
              <span className="text-danger flex-none">✕</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="text-center">
        <Link
          href="/start"
          className="inline-flex items-center px-6 py-3 bg-foreground text-surface rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Start your case
        </Link>
      </div>
    </div>
  );
}
