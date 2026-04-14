import { COMPANY } from "@/lib/company";

export const metadata = {
  title: "Terms — Japan Trust Gateway",
};

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 pt-24 pb-16 md:pt-32">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-6 text-base leading-relaxed text-gray-700">
        Japan Trust Gateway (operated by {COMPANY.legalNameEn}) provides housing
        guidance for informational purposes. This is not legal advice. For
        binding decisions, consult a licensed professional. Full terms will be
        published here. Contact:{" "}
        <a href={`mailto:${COMPANY.email}`} className="underline">
          {COMPANY.email}
        </a>
        .
      </p>
    </section>
  );
}
