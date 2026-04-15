/**
 * lib/jtg/faq-data.ts — Homepage FAQ seed data.
 *
 * This is the curated FAQ content shown on the JTG homepage tabs.
 * In production, this module should be replaced with a CMS or DB fetch.
 *
 * The TabKey values map to the homepage tab slugs (spec §3.1).
 * Content is English-primary; the homepage i18n layer handles UI labels.
 */

export type TabKey = "rent_prep" | "signing" | "living" | "life";

export interface FaqItem {
  q: string;
  a: string;
  tag: string;
  /** ISO date string of last editorial verification */
  verified: string;
}

export const FAQ_DATA: Record<TabKey, FaqItem[]> = {
  rent_prep: [
    {
      q: "Can foreigners rent an apartment in Japan?",
      a: "Yes, but some landlords decline foreign tenants. Using a guarantor company (hoshō gaisha) reduces this significantly. Agencies that advertise 外国人可 (foreigners welcome) are the most reliable starting point.",
      tag: "Eligibility",
      verified: "2026-03-01",
    },
    {
      q: "How much is the security deposit (shikikin)? Will I get it back?",
      a: "Typically 1–2 months' rent. It is refunded at move-out minus legally-allowable deductions. The National Land Agency guidelines define what landlords can and cannot deduct — normal wear is their responsibility.",
      tag: "Costs",
      verified: "2026-03-01",
    },
    {
      q: "What is a guarantor company (hoshō gaisha) and what does it cost?",
      a: "A guarantor company underwrites your tenancy on behalf of the landlord. Initial fee is typically 0.5–1× monthly rent; annual renewal around ¥10,000. It has largely replaced personal guarantors for foreign tenants.",
      tag: "Process",
      verified: "2026-02-15",
    },
    {
      q: "I have no Japanese bank account yet. Can I still rent?",
      a: "You can sign a contract without one, but you will need an account to set up recurring rent payments. Japan Post Bank (yuucho) is one of the easiest to open with a residence card.",
      tag: "Process",
      verified: "2026-02-15",
    },
  ],
  signing: [
    {
      q: "What clauses should I check before signing?",
      a: "Key areas: special conditions (tokuyaku jikō), restoration-to-original-condition scope, pets/instruments policy, and penalty amounts. Upload the contract to AI analysis for a plain-language summary of high-risk clauses.",
      tag: "Contract",
      verified: "2026-03-01",
    },
    {
      q: "The contract is entirely in Japanese — what do I do?",
      a: "You can upload a screenshot or photo of the contract. AI will try to extract key clauses and flag unusual terms. For binding decisions, confirm findings with a human agent or a licensed judicial scrivener.",
      tag: "Contract",
      verified: "2026-03-01",
    },
    {
      q: "Full-width vs. half-width characters on forms — which to use?",
      a: "Numbers are usually half-width (1234). Names and addresses typically use full-width (１２３４). Follow the on-form instructions; mismatches can cause applications to be rejected.",
      tag: "Application",
      verified: "2026-02-01",
    },
  ],
  living: [
    {
      q: "No hot water — what should I do first?",
      a: "Check: (1) Is gas service active? (2) Does the water heater display an error code? (3) Is the set temperature too low? If none of those explain it, contact the management office (kanri gaisha) by message or phone.",
      tag: "Equipment",
      verified: "2026-03-15",
    },
    {
      q: "Move-out: what is restoration to original condition (genjokaifuku)?",
      a: "Normal aging — faded walls, small marks — is the landlord's responsibility under national guidelines. Tenant-caused damage requires repair or compensation. Upload your contract to check the specific clause in your lease.",
      tag: "Move-out",
      verified: "2026-03-15",
    },
    {
      q: "How does rubbish separation work?",
      a: "Rules differ by ward. Search '[your ward name] ゴミ 分別' for the official PDF. Generally: combustible waste 2× per week, non-combustible 1× per week, oversized items by appointment.",
      tag: "Daily life",
      verified: "2026-02-01",
    },
  ],
  life: [
    {
      q: "I just arrived — what do I need to do first?",
      a: "Priority order: (1) Register at your ward office (jūminhyō), (2) Update address on your residence card, (3) Open a bank account, (4) Get a SIM. Skipping step 1 blocks most of the others.",
      tag: "New arrival",
      verified: "2026-04-01",
    },
    {
      q: "How do I set up gas, electricity, and water?",
      a: "Water is usually pre-connected. Electricity: open the meter panel and call the utility listed inside. Gas: must be activated by an engineer in person — schedule an appointment and be home. Gas is the most common forgotten step.",
      tag: "Move-in",
      verified: "2026-04-01",
    },
    {
      q: "Which SIM card should I get in Japan?",
      a: "Short-term / passport only: IIJmio or Mineo. Long-term / residence card: Rakuten Mobile or ahamo offer good value. Airport SIMs are available as a bridge for the first few days.",
      tag: "Daily life",
      verified: "2026-03-01",
    },
  ],
};
