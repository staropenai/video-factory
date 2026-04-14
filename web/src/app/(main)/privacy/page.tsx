import { COMPANY } from "@/lib/company";

export const metadata = {
  title: "Privacy Policy — Japan Trust Gateway",
};

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 pt-24 pb-16 md:pt-32">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-6 text-base leading-relaxed text-gray-700">
        Japan Trust Gateway (operated by {COMPANY.legalNameEn}) is committed to
        protecting your privacy. This policy will be updated with full details.
        For questions, contact us at{" "}
        <a href={`mailto:${COMPANY.email}`} className="underline">
          {COMPANY.email}
        </a>
        .
      </p>
    </section>
  );
}
