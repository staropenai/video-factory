import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { SEED_FAQS, type FaqEntry } from "@/lib/knowledge/seed";
import { LOCALES } from "@/lib/jtg/types";
import type { Lang } from "@/lib/i18n/types";
import { toLang, pickLocalized } from "@/lib/i18n/pick-localized";

/** Look up a FAQ by id. */
function findFaq(id: string): FaqEntry | undefined {
  return SEED_FAQS.find((f) => f.id === id);
}

// ---------------------------------------------------------------------------
// Human-readable labels
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<string, Record<string, string>> = {
  community: { en: "Community knowledge", zh: "社区经验", ja: "コミュニティ知識" },
  government: { en: "Government source", zh: "官方来源", ja: "公的機関情報" },
  expert: { en: "Expert advice", zh: "专家建议", ja: "専門家アドバイス" },
  seed: { en: "Editorial", zh: "编辑整理", ja: "編集情報" },
  practical: { en: "Practical experience", zh: "实用经验", ja: "実用知識" },
  official: { en: "Official source", zh: "官方来源", ja: "公式情報" },
  mixed: { en: "Multiple sources", zh: "多方来源", ja: "複数情報源" },
};

const RISK_LABELS: Record<string, Record<string, string>> = {
  medium: { en: "Medium risk", zh: "中等风险", ja: "中リスク" },
  high: { en: "High risk", zh: "高风险", ja: "高リスク" },
};

const UI: Record<string, Record<string, string>> = {
  backHome: { en: "Back to home", zh: "返回首页", ja: "ホームに戻る" },
  askAi: { en: "Ask AI", zh: "问问 AI", ja: "AIに聞く" },
  getHelp: { en: "Get help", zh: "获取帮助", ja: "サポートを受ける" },
  nextSteps: { en: "What to do next", zh: "下一步该怎么做", ja: "次にやること" },
  confirm: { en: "Confirm", zh: "确认", ja: "確認" },
  prepare: { en: "Prepare", zh: "准备", ja: "準備" },
  contact: { en: "Contact", zh: "联系", ja: "問い合わせ" },
  warning: { en: "Warning", zh: "注意", ja: "注意" },
  source: { en: "Source", zh: "来源", ja: "情報源" },
};

function ui(key: string, locale: string): string {
  const lang = toLang(locale);
  return UI[key]?.[lang] || UI[key]?.en || key;
}

// ---------------------------------------------------------------------------
// Static generation
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  const params: { locale: string; id: string }[] = [];
  for (const locale of LOCALES) {
    for (const faq of SEED_FAQS) {
      params.push({ locale, id: faq.id });
    }
  }
  return params;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const faq = findFaq(id);
  if (!faq) return { title: "Not found" };

  const title = pickLocalized(faq.representative_title, locale);
  const description = pickLocalized(faq.standard_answer, locale).slice(0, 160);

  return {
    title: `${title} | JTG`,
    description,
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function FaqDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const faq = findFaq(id);
  if (!faq) notFound();

  const lang = toLang(locale);
  const title = pickLocalized(faq.representative_title, locale);
  const answer = pickLocalized(faq.standard_answer, locale);
  const confirm = pickLocalized(faq.next_step_confirm, locale);
  const prepare = pickLocalized(faq.next_step_prepare, locale);
  const contact = pickLocalized(faq.next_step_contact, locale);
  const warning = faq.next_step_warning ? pickLocalized(faq.next_step_warning, locale) : null;

  const sourceLabel = SOURCE_LABELS[faq.source_type]?.[lang] || SOURCE_LABELS[faq.source_type]?.en || faq.source_type;
  const riskLabel = RISK_LABELS[faq.risk_level]?.[lang] || RISK_LABELS[faq.risk_level]?.en || null;
  const showRisk = faq.risk_level === "medium" || faq.risk_level === "high";

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-900 transition-colors"
        >
          <span aria-hidden="true">&larr;</span> {ui("backHome", locale)}
        </Link>

        {/* Title + badges */}
        <div className="mt-6">
          <h1 className="text-2xl font-bold text-gray-900 leading-snug sm:text-3xl">
            {title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
              {sourceLabel}
            </span>
            {showRisk && riskLabel && (
              <span
                className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium border ${
                  faq.risk_level === "high"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {riskLabel}
              </span>
            )}
          </div>
        </div>

        {/* Answer */}
        <article className="mt-8 prose prose-gray max-w-none">
          <p className="text-base leading-relaxed text-gray-700 whitespace-pre-line">
            {answer}
          </p>
        </article>

        {/* Next steps */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900">
            {ui("nextSteps", locale)}
          </h2>
          <dl className="mt-4 space-y-4">
            <div className="rounded-lg bg-emerald-50/60 p-4 border border-emerald-100">
              <dt className="text-sm font-semibold text-emerald-800">{ui("confirm", locale)}</dt>
              <dd className="mt-1 text-sm text-gray-700">{confirm}</dd>
            </div>
            <div className="rounded-lg bg-emerald-50/60 p-4 border border-emerald-100">
              <dt className="text-sm font-semibold text-emerald-800">{ui("prepare", locale)}</dt>
              <dd className="mt-1 text-sm text-gray-700">{prepare}</dd>
            </div>
            <div className="rounded-lg bg-emerald-50/60 p-4 border border-emerald-100">
              <dt className="text-sm font-semibold text-emerald-800">{ui("contact", locale)}</dt>
              <dd className="mt-1 text-sm text-gray-700">{contact}</dd>
            </div>
          </dl>
        </section>

        {/* Warning */}
        {warning && (
          <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">
              {ui("warning", locale)}
            </p>
            <p className="mt-1 text-sm text-amber-700">{warning}</p>
          </section>
        )}

        {/* Action links */}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/try"
            className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            {ui("askAi", locale)}
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center rounded-lg border border-emerald-200 bg-white px-5 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            {ui("getHelp", locale)}
          </Link>
        </div>

        {/* Footer spacer */}
        <div className="mt-16" />
      </div>
    </main>
  );
}
