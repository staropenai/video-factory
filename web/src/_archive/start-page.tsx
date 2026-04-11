"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";

interface IntakeData {
  visa: string;
  budget: string;
  area: string;
  moveDate: string;
  hasGuarantor: string;
  employment: string;
}

const visaOptions = [
  { value: "work", label: "Work visa" },
  { value: "student", label: "Student visa" },
  { value: "spouse", label: "Spouse / dependent visa" },
  { value: "permanent_resident", label: "Permanent resident" },
  { value: "specified_activities", label: "Specified activities" },
  { value: "unknown", label: "Not sure / other" },
];

const budgetOptions = [
  { value: "under_50k", label: "Under ¥50,000/month" },
  { value: "50k_80k", label: "¥50,000–80,000/month" },
  { value: "80k_120k", label: "¥80,000–120,000/month" },
  { value: "120k_180k", label: "¥120,000–180,000/month" },
  { value: "over_180k", label: "Over ¥180,000/month" },
];

const employmentOptions = [
  { value: "employed", label: "Full-time employed" },
  { value: "self_employed", label: "Self-employed / freelance" },
  { value: "student", label: "Student" },
  { value: "unemployed", label: "Currently seeking work" },
];

export default function StartPage() {
  const router = useRouter();
  const { setIntake, setStage, sessionId, loading: sessionLoading } = useSession();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<IntakeData>({
    visa: "",
    budget: "",
    area: "",
    moveDate: "",
    hasGuarantor: "",
    employment: "",
  });

  const update = (field: keyof IntakeData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Persist intake to session backend
      const intakeData: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value) intakeData[key] = value;
      }
      await setIntake(intakeData);
      await setStage("exploring");

      // Navigate to guidance with session context
      router.push("/guidance");
    } catch {
      // Fallback: navigate with URL params if session fails
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(data)) {
        if (value) params.set(key, value);
      }
      router.push(`/guidance?${params.toString()}`);
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    {
      field: "visa" as const,
      label: "What is your visa status in Japan?",
      hint: "This affects which properties and guarantor options are available to you.",
      options: visaOptions,
    },
    {
      field: "budget" as const,
      label: "What is your monthly rent budget?",
      hint: "Initial costs are typically 4-6 months of rent. We'll estimate the total.",
      options: budgetOptions,
    },
    {
      field: "employment" as const,
      label: "What is your employment status?",
      hint: "This determines which documents you'll need for your application.",
      options: employmentOptions,
    },
    {
      field: "hasGuarantor" as const,
      label: "Do you have a Japanese guarantor?",
      hint: "If not, a guarantor company can help — most foreigners use one.",
      options: [
        { value: "yes", label: "Yes, I have a guarantor" },
        { value: "no", label: "No, I'll need a guarantor company" },
        { value: "unsure", label: "I'm not sure" },
      ],
    },
  ];

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;
  const canProceed = currentStep ? !!data[currentStep.field] : false;

  if (sessionLoading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center text-muted">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
      <div className="mb-12">
        <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
          Step {step + 1} of {steps.length}
          {sessionId && (
            <span className="ml-2 text-muted/50">
              Session: {sessionId.slice(0, 8)}
            </span>
          )}
        </p>
        <div className="h-1 bg-border rounded-full overflow-hidden mb-8">
          <div
            className="h-full bg-foreground rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {currentStep && (
        <div className="animate-fade-in" key={step}>
          <h1 className="text-headline mb-3">{currentStep.label}</h1>
          <p className="text-muted mb-10">{currentStep.hint}</p>

          <div className="space-y-3">
            {currentStep.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => update(currentStep.field, opt.value)}
                className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${
                  data[currentStep.field] === opt.value
                    ? "border-foreground bg-foreground/5"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-12 flex items-center justify-between">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                &larr; Back
              </button>
            ) : (
              <Link
                href="/knowledge"
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                Skip — browse knowledge instead
              </Link>
            )}

            {isLastStep ? (
              <button
                onClick={handleSubmit}
                disabled={!canProceed || submitting}
                className="px-6 py-3 bg-foreground text-surface rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Saving..." : "Get guidance"}
              </button>
            ) : (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed}
                className="px-6 py-3 bg-foreground text-surface rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
