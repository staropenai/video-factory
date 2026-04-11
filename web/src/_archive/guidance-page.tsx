"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session-context";
import { fetchFAQList, routeQuery, type APIFAQItem, type APIDecision } from "@/lib/api-client";

const rentMap: Record<string, number> = {
  under_50k: 45000,
  "50k_80k": 65000,
  "80k_120k": 100000,
  "120k_180k": 150000,
  over_180k: 200000,
};

const budgetLabels: Record<string, string> = {
  under_50k: "Under ¥50,000/month",
  "50k_80k": "¥50,000–80,000",
  "80k_120k": "¥80,000–120,000",
  "120k_180k": "¥120,000–180,000",
  over_180k: "Over ¥180,000",
};

function estimateCosts(budget: string) {
  const rent = rentMap[budget] || 80000;
  const breakdown = [
    { label: "Security deposit (shikikin)", amount: rent },
    { label: "Key money (reikin)", amount: rent },
    { label: "First month rent", amount: rent },
    { label: "Agency fee + tax", amount: Math.round(rent * 0.55) },
    { label: "Guarantor company fee", amount: Math.round(rent * 0.5) },
    { label: "Fire insurance", amount: 18000 },
    { label: "Lock change", amount: 15000 },
  ];
  const total = breakdown.reduce((s, b) => s + b.amount, 0);
  return { rent, breakdown, total };
}

export default function GuidancePage() {
  const { session, sessionId, loading: sessionLoading } = useSession();
  const [faqItems, setFaqItems] = useState<APIFAQItem[]>([]);
  const [routeDecision, setRouteDecision] = useState<APIDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get intake from session (or URL params as fallback)
  const intake = session?.intake || {};
  const budget = intake.budget || "80k_120k";
  const visa = intake.visa || "work";
  const employment = intake.employment || "employed";
  const hasGuarantor = intake.hasGuarantor || "no";

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch FAQ from backend
        const faqs = await fetchFAQList();
        setFaqItems(faqs);

        // Route the user's situation through the decision engine
        const queryDesc = `User with ${visa} visa, ${budget} budget, ${employment} employment, guarantor: ${hasGuarantor}`;
        const decision = await routeQuery(queryDesc, sessionId || undefined, {
          visa,
          budget,
          employment,
          has_guarantor: hasGuarantor,
        });
        setRouteDecision(decision);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load guidance");
      } finally {
        setLoading(false);
      }
    }

    if (!sessionLoading) {
      loadData();
    }
  }, [sessionLoading, budget, visa, employment, hasGuarantor, sessionId]);

  const costs = estimateCosts(budget);
  const needsEscalation =
    visa === "unknown" ||
    employment === "unemployed" ||
    routeDecision?.should_escalate;

  if (sessionLoading || loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-24 text-center text-muted">
        Loading your guidance...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-24">
        <div className="p-6 rounded-2xl border border-danger/20 bg-red-50 text-sm">
          <p className="font-medium text-danger mb-2">Unable to load guidance</p>
          <p className="text-muted">{error}</p>
          <p className="mt-4 text-muted">
            The backend API may not be running. Start it with:{" "}
            <code className="bg-white px-2 py-0.5 rounded text-xs">python -m housing_os.api</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <div className="mb-12">
        <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
          Your guidance
          {routeDecision && (
            <span className="ml-2 text-muted/50">
              Decision: {routeDecision.decision_id.slice(0, 8)}
            </span>
          )}
        </p>
        <h1 className="text-headline">Based on what you&apos;ve told us</h1>
        <p className="mt-4 text-muted max-w-xl">
          This guidance is based on general rules and verified sources.
          Individual situations may vary.
        </p>
      </div>

      {/* Decision trace info */}
      {routeDecision && (
        <div className="mb-8 p-4 rounded-xl bg-accent-light/30 border border-accent/10 text-xs text-muted">
          <span className="font-medium">Decision trace:</span>{" "}
          type={routeDecision.query_type}, confidence={routeDecision.confidence_band},{" "}
          mode={routeDecision.answer_mode}
          {routeDecision.trace_tags && (
            <> | tags: {routeDecision.trace_tags.join(", ")}</>
          )}
        </div>
      )}

      {/* Escalation suggestion */}
      {needsEscalation && (
        <div className="mb-8 p-6 rounded-2xl border-2 border-amber-200 bg-amber-50">
          <h3 className="font-semibold text-amber-900 mb-2">
            You might want to talk to someone
          </h3>
          <p className="text-sm text-amber-800 mb-4">
            {visa === "unknown"
              ? "Your visa status affects which properties and guarantors are available. A consultant can look at your specific case."
              : employment === "unemployed"
                ? "Finding housing without current employment takes some extra steps. A consultant can walk you through your options."
                : "Based on what you've told us, a quick conversation with a housing consultant could save you time."}
          </p>
          <Link
            href="/escalation"
            className="inline-flex items-center px-5 py-2.5 bg-amber-900 text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Talk to a consultant
          </Link>
        </div>
      )}

      {/* Cost estimate */}
      <section className="mb-12 p-8 rounded-2xl border border-border bg-surface">
        <h2 className="text-title mb-6">Estimated initial costs</h2>
        <p className="text-sm text-muted mb-6">
          Based on your budget of{" "}
          <strong className="text-foreground">{budgetLabels[budget] || budget}</strong>,
          estimated rent of{" "}
          <strong className="text-foreground">¥{costs.rent.toLocaleString()}/month</strong>
        </p>

        <div className="space-y-3 mb-6">
          {costs.breakdown.map((item) => (
            <div
              key={item.label}
              className="flex justify-between text-sm py-2 border-b border-border/50"
            >
              <span className="text-muted">{item.label}</span>
              <span className="font-medium">¥{item.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between text-lg font-semibold pt-2">
          <span>Estimated total</span>
          <span>¥{costs.total.toLocaleString()}</span>
        </div>

        <p className="mt-4 text-xs text-muted">
          Estimate based on typical defaults. Actual costs vary by property.
        </p>
      </section>

      {/* Relevant FAQ from backend */}
      {faqItems.length > 0 && (
        <section className="mb-12">
          <h2 className="text-title mb-6">What applies to you</h2>
          <div className="space-y-4">
            {faqItems.slice(0, 6).map((faq) => (
              <details
                key={faq.faq_slug}
                className="group border border-border rounded-xl overflow-hidden"
              >
                <summary className="px-6 py-4 cursor-pointer flex items-center justify-between hover:bg-accent-light/30 transition-colors">
                  <span className="font-medium text-sm pr-4">
                    {faq.title}
                  </span>
                  <span className="text-muted group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <div className="px-6 pb-5 text-sm text-muted leading-relaxed border-t border-border/50 pt-4">
                  <p>{faq.content}</p>
                  <div className="mt-3 flex gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-zinc-100">
                      {faq.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-100">
                      Updated {faq.updated_at}
                    </span>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Next steps */}
      <section className="mb-12 p-8 rounded-2xl border border-border bg-surface">
        <h2 className="text-title mb-6">Recommended next steps</h2>
        <ol className="space-y-4">
          {[
            {
              step: "Prepare your documents",
              desc: "Gather residence card, passport, income proof, and employment certificate.",
            },
            ...(hasGuarantor !== "yes"
              ? [
                  {
                    step: "Arrange a guarantor company",
                    desc: "Your real estate agent can recommend one. Budget 0.5–1 month rent.",
                  },
                ]
              : []),
            {
              step: "Contact a real estate agency",
              desc: "Share your budget, target area, and move-in timeline.",
            },
            {
              step: "Schedule viewings",
              desc: "View multiple properties in one day if possible. Bring your documents.",
            },
            {
              step: "Review the contract carefully",
              desc: "Understand renewal fees, termination notice, and your rights before signing.",
            },
          ].map((item, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex-none w-7 h-7 rounded-full bg-foreground text-surface text-xs flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-sm">{item.step}</p>
                <p className="text-sm text-muted mt-0.5">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="text-xs text-muted border-t border-border pt-6">
        <p>
          This guidance is generated from verified knowledge sources and
          structured rules. It is not legal advice.{" "}
          <Link href="/escalation" className="text-accent hover:underline">
            Consult with our team
          </Link>{" "}
          for complex situations.
        </p>
      </div>
    </div>
  );
}
