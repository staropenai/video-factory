"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { detectTrustTrigger } from "@/lib/evidence/trigger-detector";
import type { TrustTriggerResult } from "@/lib/evidence/trigger-detector";
import { TrustTriangleCard } from "@/components/trust/TrustTriangleCard";
import type { PartialLocalizedText } from "@/lib/i18n/types";
import { pickLocalized } from "@/lib/i18n/pick-localized";
import { useQuota } from "@/lib/hooks/useQuota";
import QuotaDisplay from "@/components/QuotaDisplay";

/* ── Response shape (matches /api/router output) ─────────────────── */

type KnowledgeItem = {
  id: string;
  category?: string;
  title?: PartialLocalizedText;
  answer?: PartialLocalizedText;
  next_step_confirm?: PartialLocalizedText;
  next_step_prepare?: PartialLocalizedText;
  next_step_contact?: PartialLocalizedText;
  next_step_warning?: PartialLocalizedText;
  risk_level?: string;
};

type RouterResponse = {
  ok?: boolean;
  language?: string;
  answer?: string;
  mode?: string;
  category?: string;
  riskLevel?: string;
  handoff?: boolean;
  officialOnly?: boolean;
  sources?: { id: string; title: string; type: string }[];
  knowledge?: KnowledgeItem[];
  decision?: {
    queryType?: string;
    riskLevel?: string;
    confidenceBand?: string;
    answerMode?: string;
    shouldEscalate?: boolean;
    reasons?: string[];
    traceTags?: string[];
  };
  aiAnswer?: { answer?: string };
  payload?: {
    blocks?: { content: string; label: string; source_tags?: unknown[] }[];
    blocked?: boolean;
  };
  questionQuality?: {
    score?: number;
    suggestion?: string;
    badType?: string;
  };
  debug?: Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
};

/* ── Helpers ──────────────────────────────────────────────────────── */

function getAnswerText(r: RouterResponse): string {
  return r.answer || r.aiAnswer?.answer || "";
}

function getShouldEscalate(r: RouterResponse): boolean {
  return r.handoff === true || r.decision?.shouldEscalate === true;
}

/** Collect next-step strings from the top knowledge match. */
function getNextSteps(r: RouterResponse): string[] {
  const lang = r.language || "zh";
  const items: string[] = [];
  const k = r.knowledge?.[0];
  if (!k) return items;

  const confirm = pickLocalized(k.next_step_confirm, lang);
  const prepare = pickLocalized(k.next_step_prepare, lang);
  const contact = pickLocalized(k.next_step_contact, lang);

  if (confirm) items.push(confirm);
  if (prepare) items.push(prepare);
  if (contact) items.push(contact);

  return items;
}

function getWarning(r: RouterResponse): string {
  const lang = r.language || "zh";
  const k = r.knowledge?.[0];
  if (!k) return "";
  return pickLocalized(k.next_step_warning, lang);
}

/** Same-language UI labels. */
function labels(lang: string) {
  if (lang === "ja") {
    return {
      pageTitle: "質問する",
      pageDesc: "日本での賃貸について、質問を入力してください。",
      placeholder: "例：敷金はいくらですか？",
      submit: "送信",
      submitting: "送信中…",
      answer: "回答",
      nextSteps: "次のステップ",
      sources: "情報源",
      sourceCount: (n: number) => `${n}件の関連情報に基づく回答`,
      warning: "ご注意",
      boundary: "この回答は参考情報です。法律・税務・権利に関する最終判断は、専門家または公的機関にご確認ください。",
      needHelp: "さらにサポートが必要ですか？",
      contactHuman: "スタッフに相談する",
      escalateNote: "この質問は専門スタッフの対応をおすすめします。",
      helpNote: "回答が不十分な場合は、スタッフに直接ご相談いただけます。",
      noAnswer: "回答を取得できませんでした。もう一度お試しください。",
      officialOnly: "この質問は公式情報の確認が必要です。以下の回答は参考としてお読みください。",
      progress: [
        "質問を理解しています...",
        "知識ベースを確認しています...",
        "回答を準備しています...",
      ],
    };
  }
  if (lang === "en") {
    return {
      pageTitle: "Ask a question",
      pageDesc: "Ask about renting in Japan. We'll find the best answer from our knowledge base.",
      placeholder: "e.g. How much does it cost to rent in Tokyo?",
      submit: "Submit",
      submitting: "Submitting…",
      answer: "Answer",
      nextSteps: "What to do next",
      sources: "Sources",
      sourceCount: (n: number) => `Based on ${n} related source${n > 1 ? "s" : ""}`,
      warning: "Important",
      boundary: "This answer is for reference only. For legal, tax, or rights-related decisions, please consult a professional or official authority.",
      needHelp: "Need more help?",
      contactHuman: "Talk to a person",
      escalateNote: "This question may need professional assistance.",
      helpNote: "If this answer isn't enough, you can reach our support team directly.",
      noAnswer: "Could not get an answer. Please try again.",
      officialOnly: "This question requires official verification. Please treat the answer below as reference only.",
      progress: [
        "Understanding your question...",
        "Checking our knowledge base...",
        "Preparing your answer...",
      ],
    };
  }
  // Default: zh
  return {
    pageTitle: "提问",
    pageDesc: "关于在日本租房的问题，输入后我们会从知识库中找到最合适的回答。",
    placeholder: "例如：租房子要多少钱？",
    submit: "提交",
    submitting: "提交中…",
    answer: "回答",
    nextSteps: "接下来该怎么做",
    sources: "信息来源",
    sourceCount: (n: number) => `基于 ${n} 条相关信息`,
    warning: "请注意",
    boundary: "以上回答仅供参考。涉及法律、税务、权利等问题，请以专业人士或官方机构的意见为准。",
    needHelp: "还需要帮助吗？",
    contactHuman: "联系人工客服",
    escalateNote: "这个问题建议由专业人员协助处理。",
    helpNote: "如果回答不够充分，可以直接联系我们的支持团队。",
    noAnswer: "未能获取回答，请重试。",
    officialOnly: "这个问题需要确认官方信息。以下回答仅供参考。",
    progress: [
      "正在理解你的问题...",
      "正在检索知识库...",
      "正在准备回答...",
    ],
  };
}

/** Map trust signal types to TrustTriangleCard content. */
function buildTrustCard(trigger: TrustTriggerResult, answer: string) {
  const signalLabels: Record<string, string> = {
    explicit_doubt: "信頼性の確認 / Verification",
    high_amount_topic: "費用に関する公式情報 / Official Fee Info",
    prolonged_hesitation: "基本情報 / Basics",
    repeated_question: "詳細説明 / Detailed Explanation",
    file_uploaded: "書類確認 / Document Check",
  };
  return {
    title: signalLabels[trigger.signalType ?? ""] ?? "Trust Info",
    shortAnswer: answer.slice(0, 120) + (answer.length > 120 ? "…" : ""),
    sources: trigger.suggestedEvidenceTopics.map((t) => ({
      label: t.replace(/_/g, " "),
      type: t.includes("official") || t.includes("MLIT")
        ? ("official" as const)
        : t.includes("verified") || t.includes("legal")
          ? ("verified" as const)
          : ("experience" as const),
    })),
    commonMistake:
      trigger.signalType === "high_amount_topic"
        ? "敷金・礼金の上限は法律で定められていませんが、消費者契約法により不当に高額な場合は無効になり得ます。"
        : undefined,
    nextStep:
      trigger.urgency === "high"
        ? "公式情報で確認してから判断してください。不明な場合は消費者センター（188）にご連絡ください。"
        : "次のステップに進む前に、表示された情報源を確認してください。",
  };
}

/* ── Page Component ──────────────────────────────────────────────── */

export default function TryPage() {
  return (
    <Suspense fallback={null}>
      <TryPageInner />
    </Suspense>
  );
}

function TryPageInner() {
  const searchParams = useSearchParams();
  const debugMode = searchParams.get("debug") === "1";

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RouterResponse | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [trustTrigger, setTrustTrigger] = useState<TrustTriggerResult | null>(
    null
  );
  const [showTrustCard, setShowTrustCard] = useState(true);
  const [progressStage, setProgressStage] = useState(0);
  const previousQueries = useRef<string[]>([]);

  // Advance progress stage while loading
  useEffect(() => {
    if (!loading) {
      setProgressStage(0);
      return;
    }
    const t1 = setTimeout(() => setProgressStage(1), 800);
    const t2 = setTimeout(() => setProgressStage(2), 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loading]);

  // Detect language from response or input
  const lang = result?.language || "zh";
  const l = labels(lang);

  // Quota state + session gate
  const { quota, openSession } = useQuota(lang);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || quota.remaining <= 0) return;

    // Consume quota & get session proof token
    const session = await openSession();
    if (!session.ok) {
      // quota_exceeded or network_error — state already updated by hook
      return;
    }

    setLoading(true);
    setErrorText(null);
    setResult(null);
    setTrustTrigger(null);
    setShowTrustCard(true);

    const trigger = detectTrustTrigger(query, previousQueries.current);
    if (trigger.triggered) {
      setTrustTrigger(trigger);
    }
    previousQueries.current = [...previousQueries.current.slice(-9), query];

    try {
      const res = await fetch("/api/router", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          queryText: query,
          taskState: {},
          sessionToken: session.sessionToken,
        }),
      });
      const text = await res.text();
      try {
        setResult(JSON.parse(text));
      } catch {
        setErrorText(`HTTP ${res.status}: ${text.slice(0, 500)}`);
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const answerText = result ? getAnswerText(result) : "";
  const nextSteps = result ? getNextSteps(result) : [];
  const warning = result ? getWarning(result) : "";
  const escalate = result ? getShouldEscalate(result) : false;
  const sources = result?.sources ?? [];

  return (
    <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────── */}
      <h1 className="text-2xl font-semibold mb-1">{l.pageTitle}</h1>
      <p className="text-sm text-neutral-500 mb-8">{l.pageDesc}</p>

      {/* ── Input Form ─────────────────────────────────────────── */}
      <form onSubmit={onSubmit} className="flex flex-col gap-3 mb-8">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={l.placeholder}
          rows={3}
          className="w-full border border-neutral-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
        />
        <button
          type="submit"
          disabled={loading || !query.trim() || quota.remaining <= 0}
          className="self-start bg-neutral-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity"
        >
          {loading ? l.submitting : l.submit}
        </button>
        <QuotaDisplay quota={quota} lang={lang} />
      </form>

      {/* ── Progress indicator ─────────────────────────────────── */}
      {loading && !result && (
        <div className="flex items-center gap-2.5 mb-6 text-sm text-neutral-500">
          <span
            className="inline-block h-4 w-4 rounded-full border-2 border-neutral-300 border-t-neutral-600 animate-spin"
            aria-hidden="true"
          />
          <span>{l.progress[progressStage]}</span>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────── */}
      {errorText && (
        <div className="border border-red-200 bg-red-50 text-red-800 p-4 rounded-lg mb-6 text-sm">
          {errorText}
        </div>
      )}

      {/* ── Trust Triangle Card (existing v7 behavior) ─────────── */}
      {trustTrigger?.triggered && showTrustCard && answerText && (
        <TrustTriangleCard
          {...buildTrustCard(trustTrigger, answerText)}
          onDismiss={() => setShowTrustCard(false)}
        />
      )}

      {/* ── Result (normal mode) ───────────────────────────────── */}
      {result && (
        <div className="space-y-4">
          {/* Official-only banner */}
          {result.officialOnly && (
            <div className="border border-amber-200 bg-amber-50 text-amber-900 p-4 rounded-lg text-sm">
              {l.officialOnly}
            </div>
          )}

          {/* §1 — Short Answer */}
          {answerText ? (
            <section className="border border-neutral-200 rounded-lg p-5 bg-white">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">
                {l.answer}
              </h2>
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-800">
                {answerText}
              </div>
            </section>
          ) : (
            <div className="border border-neutral-200 bg-neutral-50 text-neutral-600 p-4 rounded-lg text-sm">
              {l.noAnswer}
            </div>
          )}

          {/* §2 — What to do next (only if data exists) */}
          {nextSteps.length > 0 && (
            <section className="border border-neutral-200 rounded-lg p-5 bg-white">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">
                {l.nextSteps}
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-sm text-neutral-700">
                {nextSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              {/* Warning from knowledge card */}
              {warning && (
                <div className="mt-4 border-l-2 border-amber-400 pl-3 text-sm text-amber-800">
                  <span className="font-medium">{l.warning}:</span> {warning}
                </div>
              )}
            </section>
          )}

          {/* §3 — Sources / Trust (only if data exists) */}
          {sources.length > 0 && (
            <section className="border border-neutral-200 rounded-lg p-5 bg-white">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">
                {l.sources}
              </h2>
              <p className="text-xs text-neutral-500 mb-2">
                {l.sourceCount(sources.length)}
              </p>
              <ul className="space-y-1">
                {sources.map((s) => (
                  <li
                    key={s.id}
                    className="text-sm text-neutral-600 flex items-start gap-2"
                  >
                    <span className="shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-neutral-400" />
                    {s.title}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Boundary / disclaimer — always shown when answer exists */}
          {answerText && (
            <p className="text-xs text-neutral-400 leading-relaxed">
              {l.boundary}
            </p>
          )}

          {/* §4 — Need more help? */}
          {answerText && (
            <section
              className={`rounded-lg p-5 ${
                escalate
                  ? "border-2 border-blue-300 bg-blue-50"
                  : "border border-neutral-200 bg-neutral-50"
              }`}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">
                {l.needHelp}
              </h2>
              <p className="text-sm text-neutral-600 mb-3">
                {escalate ? l.escalateNote : l.helpNote}
              </p>
              <a
                href="/contact"
                className={`inline-block text-sm font-medium rounded-lg px-5 py-2 transition-colors ${
                  escalate
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                }`}
              >
                {l.contactHuman}
              </a>
            </section>
          )}
        </div>
      )}

      {/* ── Debug mode (?debug=1) ──────────────────────────────── */}
      {debugMode && result && (
        <section className="mt-8 border border-dashed border-neutral-300 rounded-lg p-5 bg-neutral-50">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-red-400 mb-3">
            Debug (visible because ?debug=1)
          </h2>
          {result.decision && (
            <dl className="grid grid-cols-2 gap-y-2 text-sm mb-4">
              <dt className="text-neutral-500">answerMode</dt>
              <dd className="font-mono">
                {String(result.decision.answerMode ?? "—")}
              </dd>
              <dt className="text-neutral-500">queryType</dt>
              <dd className="font-mono">
                {String(result.decision.queryType ?? "—")}
              </dd>
              <dt className="text-neutral-500">riskLevel</dt>
              <dd className="font-mono">
                {String(result.decision.riskLevel ?? "—")}
              </dd>
              <dt className="text-neutral-500">confidenceBand</dt>
              <dd className="font-mono">
                {String(result.decision.confidenceBand ?? "—")}
              </dd>
              <dt className="text-neutral-500">shouldEscalate</dt>
              <dd className="font-mono">
                {String(result.decision.shouldEscalate ?? "—")}
              </dd>
              {result.decision.reasons && result.decision.reasons.length > 0 && (
                <>
                  <dt className="text-neutral-500">reasons</dt>
                  <dd className="font-mono text-xs">
                    {result.decision.reasons.join(" · ")}
                  </dd>
                </>
              )}
              {result.decision.traceTags &&
                result.decision.traceTags.length > 0 && (
                  <>
                    <dt className="text-neutral-500">traceTags</dt>
                    <dd className="font-mono text-xs">
                      {result.decision.traceTags.join(" · ")}
                    </dd>
                  </>
                )}
            </dl>
          )}
          <details>
            <summary className="cursor-pointer text-xs text-neutral-500">
              Raw JSON
            </summary>
            <pre className="mt-3 text-xs font-mono whitespace-pre-wrap bg-white p-3 border border-neutral-200 rounded overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </section>
      )}
    </main>
  );
}
