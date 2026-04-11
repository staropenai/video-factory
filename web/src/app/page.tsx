"use client";

import { useState } from "react";

type AnswerMode = "direct_answer" | "clarify" | "official_only" | "handoff";

type Decision = {
  queryType: string;
  riskLevel: "low" | "medium" | "high";
  confidenceBand: string;
  answerMode: AnswerMode;
  shouldEscalate: boolean;
  decisionReason: string;
  traceTags: string[];
  selectedFaqSlugs: string[];
  missingInputs: string[];
};

type LocalizedText = { en: string; zh: string; ja: string };

type KnowledgeItem = {
  id: string;
  category: "renting" | "home_buying" | "visa" | "daily_life";
  title: LocalizedText;
  answer: LocalizedText;
  next_step_confirm: LocalizedText;
  next_step_prepare: LocalizedText;
  next_step_contact: LocalizedText;
  next_step_warning: LocalizedText | null;
  risk_level: "low" | "medium" | "high";
};

type AiAnswer = {
  answer: string;
  nextStepConfirm: string;
  nextStepPrepare: string;
  nextStepContact: string;
  warning: string | null;
};

type RouterResponse = {
  ok?: boolean;
  decision?: Decision;
  knowledge?: KnowledgeItem[];
  detectedLanguage?: Lang;
  aiAnswer?: AiAnswer | null;
  understanding?: {
    source: "ai" | "fallback";
    intent: string;
    category: string;
    subtopic: string;
    missingInfo: string[];
  };
  error?: string;
};

type Lang = "en" | "zh" | "ja";

type UserGuidance = {
  empathy: string;
  situation: string;
  nextStepsLabel: string;
  nextSteps: string[];
  whereToGo?: { label: string; href?: string; heading: string };
  warning?: { heading: string; body: string };
};

/**
 * Detect the query language from its characters.
 * - hiragana/katakana present → Japanese
 * - CJK ideographs (no kana) → Chinese (simplified assumed)
 * - otherwise → English
 * Intentionally simple, no external APIs.
 */
function detectLanguage(text: string): Lang {
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja";
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh";
  return "en";
}

/**
 * Pure presentation layer. Maps an internal RouterDecision + detected language
 * to user-facing guidance. Routing logic is unchanged.
 */
function toGuidance(d: Decision, lang: Lang): UserGuidance {
  const highRisk = d.riskLevel === "high" || d.shouldEscalate;
  const missing = d.missingInputs.filter(Boolean);

  if (lang === "zh") return toGuidanceZh(d.answerMode, highRisk, missing);
  if (lang === "ja") return toGuidanceJa(d.answerMode, highRisk, missing);
  return toGuidanceEn(d.answerMode, highRisk, missing);
}

// ---------- English ----------
function toGuidanceEn(mode: AnswerMode, highRisk: boolean, missing: string[]): UserGuidance {
  const L = {
    nextSteps: "What to do next",
    whereToGo: "Where to go",
    pleaseRead: "Please read",
  };
  switch (mode) {
    case "direct_answer":
      return {
        empathy: "Good news — this one's straightforward.",
        situation:
          "We have enough information to answer you directly. Read it through once, then take it step by step.",
        nextStepsLabel: L.nextSteps,
        nextSteps: [
          "Read the answer above carefully, even the parts that look obvious.",
          "Check that the details match your situation — your visa, your city, your timeline.",
          "If anything feels off, ask a follow-up here with the specifics.",
        ],
      };
    case "clarify":
      return {
        empathy: "Totally fair question — we just need a little more to give you a real answer.",
        situation:
          "Right now there isn't enough detail to help you without guessing, and we'd rather not guess on something that affects your life in Japan.",
        nextStepsLabel: L.nextSteps,
        nextSteps:
          missing.length > 0
            ? [
                `Tell us these things: ${missing.join(", ")}.`,
                "Add one sentence about your current situation (who you live with, how long you've been in Japan, what's urgent).",
                "Send the question again — we'll take another look right away.",
              ]
            : [
                "Add your visa status, which city you're in, and your timeline.",
                "Say what you've already tried or looked at.",
                "Send the question again — we'll take another look right away.",
              ],
      };
    case "official_only":
      return {
        empathy: "This is one of those things where we really don't want to get it wrong for you.",
        situation:
          "Rules like this change, and they can depend on your visa, your city, or your employer. The safest move is to hear it from the people who actually decide.",
        nextStepsLabel: L.nextSteps,
        nextSteps: [
          "Go to your city or ward office (市役所 / 区役所) during weekday hours — they have a foreign-resident counter and most have English support.",
          "Bring your residence card (在留カード), passport, and any related paperwork or letters you've received.",
          "Ask them directly: tell them your situation in plain words and let them tell you the official answer.",
        ],
        whereToGo: {
          heading: L.whereToGo,
          label: "Your local city or ward office (市役所 / 区役所)",
        },
        warning: {
          heading: L.pleaseRead,
          body: "Please don't rely on us — or any chatbot — as the final word on visa, tax, or legal matters. Get it confirmed in person.",
        },
      };
    case "handoff":
      return {
        empathy: highRisk
          ? "That sounds stressful — and it's the kind of thing we don't want you handling alone."
          : "Thanks for bringing this here — it's a bit beyond what we should answer automatically.",
        situation: highRisk
          ? "What you're describing can have real legal or financial consequences, and the right move is to talk to a real person before you do anything else."
          : "A real person can walk you through this properly in a few minutes, instead of you piecing it together from forms and websites.",
        nextStepsLabel: L.nextSteps,
        nextSteps: [
          "Write down the key facts: dates, who's involved, what documents you have, and what you've already done.",
          highRisk
            ? "Contact a lawyer, a licensed agent, or your city office's free consultation desk (many wards offer free legal advice for residents)."
            : "Message us through the contact page, or visit your city's foreign-resident support counter — they're used to questions like this.",
          "Until you've talked to someone, don't sign papers, don't transfer money, and don't agree to anything in writing.",
        ],
        whereToGo: {
          heading: L.whereToGo,
          label: highRisk
            ? "Your city's free legal consultation desk (無料法律相談)"
            : "Get in touch",
          href: highRisk ? undefined : "/contact",
        },
        warning: highRisk
          ? {
              heading: L.pleaseRead,
              body: "If anyone is pressuring you to sign or pay today, that alone is a reason to stop and get help first.",
            }
          : undefined,
      };
  }
}

// ---------- 简体中文 ----------
function toGuidanceZh(mode: AnswerMode, highRisk: boolean, missing: string[]): UserGuidance {
  const L = {
    nextSteps: "接下来怎么做",
    whereToGo: "去哪里",
    pleaseRead: "请注意",
  };
  switch (mode) {
    case "direct_answer":
      return {
        empathy: "好消息，这个问题比较直接。",
        situation: "我们有足够的信息可以直接回答你。先认真看一遍，再一步一步来。",
        nextStepsLabel: L.nextSteps,
        nextSteps: [
          "把上面的回答完整看一遍，哪怕看起来很明显的部分也别跳过。",
          "对照一下你自己的情况——签证、所在城市、时间安排，看细节是否对得上。",
          "如果哪里感觉不对，直接在这里继续追问，把具体情况说清楚。",
        ],
      };
    case "clarify":
      return {
        empathy: "这个问题问得没错，只是我们还需要一点细节才能给你真正有用的答案。",
        situation:
          "现在的信息还不足以在不猜的情况下帮到你——在日本生活这种事上，我们宁可多问一句也不愿意乱猜。",
        nextStepsLabel: L.nextSteps,
        nextSteps:
          missing.length > 0
            ? [
                `告诉我们这几点：${missing.join("、")}。`,
                "再补一句你的现状（和谁住、来日本多久、是不是比较急）。",
                "然后把问题重新发一次，我们马上再看一下。",
              ]
            : [
                "告诉我们你的签证类型、所在城市，以及大致的时间安排。",
                "顺便说一下你已经试过或查过什么。",
                "然后把问题重新发一次，我们马上再看一下。",
              ],
      };
    case "official_only":
      return {
        empathy: "这种事情我们真的不想给你答错。",
        situation:
          "这个问题需要以官方信息为准。相关规定会变动，而且跟你的签证、城市、雇主都有关系——最稳妥的做法是直接问真正有决定权的那一方。",
        nextStepsLabel: L.nextSteps,
        nextSteps: [
          "工作日去一趟你所在的市役所或区役所——那里有外国人窗口，很多都能提供英文或中文支持。",
          "带上你的在留卡、护照，以及和这件事相关的文件或通知书。",
          "直接把你的情况用平时的话说清楚，让他们告诉你官方的答案。",
        ],
        whereToGo: {
          heading: L.whereToGo,
          label: "你所在的市役所 / 区役所",
        },
        warning: {
          heading: L.pleaseRead,
          body: "签证、税务、法律方面的事情，请不要把我们（或任何聊天机器人）当成最终依据，一定要当面再确认一次。",
        },
      };
    case "handoff":
      return {
        empathy: highRisk
          ? "听起来挺让人头疼的——这种情况我们不建议你一个人扛。"
          : "谢谢你把这个问题带过来——这件事稍微超出我们能自动回答的范围了。",
        situation: highRisk
          ? "你描述的事情可能会带来实际的法律或经济后果，在做任何决定之前，先找一个真正的人聊一下最安心。"
          : "找真人聊几分钟就能把事情讲清楚，比你自己从一堆表格和网页里拼答案要省事得多。",
        nextStepsLabel: L.nextSteps,
        nextSteps: [
          "把关键信息写下来：时间、涉及的人、你手上有哪些文件、目前已经做过什么。",
          highRisk
            ? "联系律师、有资质的中介，或者你所在市役所的免费咨询窗口（很多区都有面向居民的免费法律咨询）。"
            : "通过联系页面发消息给我们，或者直接去你所在城市的外国人支援窗口——他们很熟悉这类问题。",
          "在跟人当面谈过之前，先不要签字、不要汇款、也不要口头或书面答应任何事情。",
        ],
        whereToGo: {
          heading: L.whereToGo,
          label: highRisk ? "你所在城市的免费法律咨询（無料法律相談）" : "联系我们",
          href: highRisk ? undefined : "/contact",
        },
        warning: highRisk
          ? {
              heading: L.pleaseRead,
              body: "如果对方在逼你今天就签字或付款，光这一点就足够让你先停下来找人帮忙了。",
            }
          : undefined,
      };
  }
}

// ---------- 日本語 ----------
function toGuidanceJa(mode: AnswerMode, highRisk: boolean, missing: string[]): UserGuidance {
  const L = {
    nextSteps: "次にすること",
    whereToGo: "行き先",
    pleaseRead: "ご注意ください",
  };
  switch (mode) {
    case "direct_answer":
      return {
        empathy: "よかった、これはシンプルな話です。",
        situation:
          "お答えするのに十分な情報がそろっています。まずは上の回答をひと通り読んで、一歩ずつ進めていきましょう。",
        nextStepsLabel: L.nextSteps,
        nextSteps: [
          "上の回答を最後まで目を通してください。当たり前に見えるところも飛ばさずに。",
          "ご自身の状況——ビザ、お住まいの市区町村、スケジュール——と照らし合わせて確認してください。",
          "何か引っかかるところがあれば、ここで具体的に続きの質問をしてください。",
        ],
      };
    case "clarify":
      return {
        empathy: "ご質問ありがとうございます。きちんとお答えするために、もう少しだけ情報をいただけますか。",
        situation:
          "今の情報だけでは推測になってしまいます。日本での生活に関わることなので、当て推量ではお答えしたくありません。",
        nextStepsLabel: L.nextSteps,
        nextSteps:
          missing.length > 0
            ? [
                `次のことを教えてください：${missing.join("、")}。`,
                "現在のご状況について一言（同居のご家族、来日からの期間、お急ぎかどうか）。",
                "もう一度送っていただければ、すぐに見直します。",
              ]
            : [
                "ビザの種類、お住まいの市区町村、だいたいの時期を教えてください。",
                "すでに試されたことや調べたことがあれば教えてください。",
                "もう一度送っていただければ、すぐに見直します。",
              ],
      };
    case "official_only":
      return {
        empathy: "これは間違えたくないタイプの話ですね。",
        situation:
          "この内容は公式情報を確認する必要があります。制度は変わることもありますし、ビザや自治体、勤務先によっても扱いが違います。確実なのは、実際に判断する担当の方に直接うかがうことです。",
        nextStepsLabel: L.nextSteps,
        nextSteps: [
          "平日にお住まいの市役所・区役所へ行ってみてください。外国人向けの窓口があり、英語で対応している自治体も多いです。",
          "在留カード、パスポート、関係する書類や通知書があれば一緒に持っていってください。",
          "窓口で、ご自身の状況をそのままの言葉で伝え、公式な回答を教えてもらってください。",
        ],
        whereToGo: {
          heading: L.whereToGo,
          label: "お住まいの市役所・区役所",
        },
        warning: {
          heading: L.pleaseRead,
          body: "ビザ・税金・法律に関することは、当サービスを含めチャットボットの回答を最終判断にしないでください。必ず窓口でご確認ください。",
        },
      };
    case "handoff":
      return {
        empathy: highRisk
          ? "それは大変ですね。ひとりで抱え込んでほしくない種類のお話です。"
          : "ご相談ありがとうございます。これは自動でお答えするには少し難しい内容です。",
        situation: highRisk
          ? "お話の内容には、実際に法律や金銭面の影響が出る可能性があります。何かを決める前に、まず人に相談するのがいちばん安心です。"
          : "人と数分お話するほうが、書類やサイトから自力で答えを組み立てるよりずっと早く片付きます。",
        nextStepsLabel: L.nextSteps,
        nextSteps: [
          "要点をメモに書き出してください：日付、関係者、手元にある書類、これまでにしたこと。",
          highRisk
            ? "弁護士、資格のある担当者、または市区町村の無料相談窓口にご連絡ください（多くの区で住民向けの無料法律相談があります）。"
            : "お問い合わせページからご連絡いただくか、お住まいの自治体の外国人支援窓口へ行ってみてください。慣れている方々です。",
          "どなたかに相談するまでは、書類にサインしたり、送金したり、口約束をしたりしないでください。",
        ],
        whereToGo: {
          heading: L.whereToGo,
          label: highRisk ? "お住まいの自治体の無料法律相談" : "お問い合わせ",
          href: highRisk ? undefined : "/contact",
        },
        warning: highRisk
          ? {
              heading: L.pleaseRead,
              body: "もし相手から「今日中にサインして」「すぐ払って」と急かされているなら、それだけでも一度立ち止まって相談していい理由になります。",
            }
          : undefined,
      };
  }
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RouterResponse | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [feedbackState, setFeedbackState] = useState<"idle" | "submitting" | "submitted">("idle");
  const [showCorrection, setShowCorrection] = useState(false);
  const [correction, setCorrection] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setErrorText(null);
    setResult(null);
    setFeedbackState("idle");
    setShowCorrection(false);
    setCorrection("");
    setSubmittedQuery(query.trim());
    const detectedLang = detectLanguage(query);
    setLang(detectedLang);
    try {
      const res = await fetch("/api/router", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ queryText: query, taskState: {} }),
      });
      const text = await res.text();
      let parsed: RouterResponse | null = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        setErrorText("Something went wrong on our side. Please try again in a moment.");
        return;
      }
      if (!res.ok || parsed?.error) {
        setErrorText("We couldn't process that question. Please try rephrasing and resubmit.");
        return;
      }
      // Server-side detection is authoritative — it comes from the AI
      // understanding layer, falling back to the same regex we used client-side.
      if (parsed?.detectedLanguage) setLang(parsed.detectedLanguage);
      setResult(parsed);
    } catch {
      setErrorText("Network issue — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const guidance = result?.decision ? toGuidance(result.decision, lang) : null;
  const aiAnswer = result?.aiAnswer ?? null;
  const primaryKnowledge =
    !aiAnswer &&
    result?.decision?.answerMode === "direct_answer" &&
    result.knowledge &&
    result.knowledge.length > 0
      ? result.knowledge[0]
      : null;
  const relatedKnowledge =
    result?.knowledge && result.knowledge.length > 1 ? result.knowledge.slice(1) : [];

  function buildSystemAnswerText(): string {
    if (aiAnswer) {
      return [
        aiAnswer.answer,
        aiAnswer.nextStepConfirm,
        aiAnswer.nextStepPrepare,
        aiAnswer.nextStepContact,
        aiAnswer.warning ?? "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    if (primaryKnowledge) {
      const parts = [
        primaryKnowledge.title[lang],
        primaryKnowledge.answer[lang],
        primaryKnowledge.next_step_confirm[lang],
        primaryKnowledge.next_step_prepare[lang],
        primaryKnowledge.next_step_contact[lang],
      ];
      if (primaryKnowledge.next_step_warning) {
        parts.push(primaryKnowledge.next_step_warning[lang]);
      }
      return parts.filter(Boolean).join("\n\n");
    }
    if (guidance) {
      return [
        guidance.empathy,
        guidance.situation,
        ...guidance.nextSteps.map((s, i) => `${i + 1}. ${s}`),
        guidance.whereToGo?.label ?? "",
        guidance.warning?.body ?? "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    return "";
  }

  async function submitFeedback(isSatisfied: boolean, humanReply: string) {
    if (!result?.decision) return;
    setFeedbackState("submitting");
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          queryText: submittedQuery,
          systemAnswer: buildSystemAnswerText(),
          answerMode: result.decision.answerMode,
          isSatisfied,
          humanReply,
          language: lang,
        }),
      });
      setFeedbackState("submitted");
    } catch {
      setFeedbackState("idle");
    }
  }

  const fbLabels = {
    en: {
      prompt: "Was this helpful?",
      yes: "👍 Helpful",
      no: "👎 Not helpful",
      placeholder: "Write the correct or better answer",
      submit: "Submit feedback",
      thanks: "Thanks — feedback recorded.",
    },
    zh: {
      prompt: "这个回答有帮助吗？",
      yes: "👍 有帮助",
      no: "👎 没帮助",
      placeholder: "请写出正确或更好的回答",
      submit: "提交反馈",
      thanks: "谢谢，反馈已记录。",
    },
    ja: {
      prompt: "この回答は役に立ちましたか？",
      yes: "👍 役に立った",
      no: "👎 役に立たなかった",
      placeholder: "正しい・より良い回答を入力してください",
      submit: "フィードバックを送信",
      thanks: "ありがとうございます。フィードバックを記録しました。",
    },
  }[lang];

  return (
    <main className="min-h-screen flex flex-col">
      <section className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-2xl">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label htmlFor="q" className="sr-only">
              Ask anything about living in Japan
            </label>
            <textarea
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about living in Japan / 关于在日本生活的任何问题 / 日本での暮らしについて"
              rows={3}
              className="w-full border border-border rounded-2xl px-6 py-5 text-body-lg bg-surface placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40 transition-colors resize-none"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="self-center px-8 py-3 bg-foreground text-surface rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? "…" : "Ask"}
            </button>
          </form>

          {errorText && (
            <div className="mt-8 border border-border rounded-2xl p-6 bg-surface">
              <p className="text-body-lg">{errorText}</p>
            </div>
          )}

          {guidance && (
            <div className="mt-10 space-y-6 animate-fade-in" lang={lang}>
              {aiAnswer ? (
                <>
                  <div className="border border-border rounded-2xl p-6 bg-surface">
                    <p className="text-body-lg leading-relaxed whitespace-pre-line">
                      {aiAnswer.answer}
                    </p>
                  </div>

                  {/* Only render the structured next-step box when at least
                      one of the next-step fields is non-empty. The new
                      OpenAI render layer returns a single answer paragraph
                      (with steps embedded), so these are typically blank. */}
                  {(aiAnswer.nextStepConfirm || aiAnswer.nextStepPrepare || aiAnswer.nextStepContact) && (
                    <div className="border border-border rounded-2xl p-6 bg-surface space-y-5">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted">
                        {lang === "zh"
                          ? "接下来怎么做"
                          : lang === "ja"
                            ? "次にすること"
                            : "What to do next"}
                      </p>
                      {aiAnswer.nextStepConfirm && (
                        <div>
                          <p className="text-xs font-medium text-muted mb-1">
                            {lang === "zh" ? "先确认" : lang === "ja" ? "まず確認" : "First, confirm"}
                          </p>
                          <p className="text-body-lg leading-relaxed whitespace-pre-line">
                            {aiAnswer.nextStepConfirm}
                          </p>
                        </div>
                      )}
                      {aiAnswer.nextStepPrepare && (
                        <div>
                          <p className="text-xs font-medium text-muted mb-1">
                            {lang === "zh" ? "需要准备" : lang === "ja" ? "準備するもの" : "Prepare"}
                          </p>
                          <p className="text-body-lg leading-relaxed whitespace-pre-line">
                            {aiAnswer.nextStepPrepare}
                          </p>
                        </div>
                      )}
                      {aiAnswer.nextStepContact && (
                        <div>
                          <p className="text-xs font-medium text-muted mb-1">
                            {lang === "zh" ? "去哪里 / 联系谁" : lang === "ja" ? "行き先・連絡先" : "Where to go / who to contact"}
                          </p>
                          <p className="text-body-lg leading-relaxed whitespace-pre-line">
                            {aiAnswer.nextStepContact}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {aiAnswer.warning && (
                    <div className="border-2 border-foreground/20 rounded-2xl p-6 bg-surface">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted mb-2">
                        {lang === "zh" ? "请注意" : lang === "ja" ? "ご注意ください" : "Please read"}
                      </p>
                      <p className="text-body-lg leading-relaxed whitespace-pre-line">
                        {aiAnswer.warning}
                      </p>
                    </div>
                  )}
                </>
              ) : primaryKnowledge ? (
                <>
                  <div className="border border-border rounded-2xl p-6 bg-surface">
                    <h2 className="text-headline mb-4">{primaryKnowledge.title[lang]}</h2>
                    <p className="text-body-lg leading-relaxed whitespace-pre-line">
                      {primaryKnowledge.answer[lang]}
                    </p>
                  </div>

                  <div className="border border-border rounded-2xl p-6 bg-surface space-y-5">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">
                      {lang === "zh"
                        ? "接下来怎么做"
                        : lang === "ja"
                          ? "次にすること"
                          : "What to do next"}
                    </p>
                    <div>
                      <p className="text-xs font-medium text-muted mb-1">
                        {lang === "zh" ? "先确认" : lang === "ja" ? "まず確認" : "First, confirm"}
                      </p>
                      <p className="text-body-lg leading-relaxed whitespace-pre-line">
                        {primaryKnowledge.next_step_confirm[lang]}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted mb-1">
                        {lang === "zh" ? "需要准备" : lang === "ja" ? "準備するもの" : "Prepare"}
                      </p>
                      <p className="text-body-lg leading-relaxed whitespace-pre-line">
                        {primaryKnowledge.next_step_prepare[lang]}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted mb-1">
                        {lang === "zh" ? "去哪里 / 联系谁" : lang === "ja" ? "行き先・連絡先" : "Where to go / who to contact"}
                      </p>
                      <p className="text-body-lg leading-relaxed whitespace-pre-line">
                        {primaryKnowledge.next_step_contact[lang]}
                      </p>
                    </div>
                  </div>

                  {primaryKnowledge.next_step_warning && (
                    <div className="border-2 border-foreground/20 rounded-2xl p-6 bg-surface">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted mb-2">
                        {lang === "zh" ? "请注意" : lang === "ja" ? "ご注意ください" : "Please read"}
                      </p>
                      <p className="text-body-lg leading-relaxed whitespace-pre-line">
                        {primaryKnowledge.next_step_warning[lang]}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="border border-border rounded-2xl p-6 bg-surface">
                    <p className="text-headline mb-3">{guidance.empathy}</p>
                    <p className="text-body-lg leading-relaxed text-muted">{guidance.situation}</p>
                  </div>

                  <div className="border border-border rounded-2xl p-6 bg-surface">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
                      {guidance.nextStepsLabel}
                    </p>
                    <ol className="space-y-3">
                      {guidance.nextSteps.map((step, i) => (
                        <li key={i} className="flex gap-4">
                          <span className="text-sm font-mono text-muted shrink-0 w-5">{i + 1}.</span>
                          <span className="text-body-lg leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {guidance.whereToGo && (
                    <div className="border border-border rounded-2xl p-6 bg-surface">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted mb-3">
                        {guidance.whereToGo.heading}
                      </p>
                      {guidance.whereToGo.href ? (
                        <a
                          href={guidance.whereToGo.href}
                          target={guidance.whereToGo.href.startsWith("http") ? "_blank" : undefined}
                          rel={
                            guidance.whereToGo.href.startsWith("http")
                              ? "noopener noreferrer"
                              : undefined
                          }
                          className="inline-flex items-center gap-2 text-body-lg underline underline-offset-4 hover:opacity-70 transition-opacity"
                        >
                          {guidance.whereToGo.label}
                          <span aria-hidden>→</span>
                        </a>
                      ) : (
                        <p className="text-body-lg">{guidance.whereToGo.label}</p>
                      )}
                    </div>
                  )}

                  {guidance.warning && (
                    <div className="border-2 border-foreground/20 rounded-2xl p-6 bg-surface">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted mb-2">
                        {guidance.warning.heading}
                      </p>
                      <p className="text-body-lg leading-relaxed">{guidance.warning.body}</p>
                    </div>
                  )}
                </>
              )}

              {primaryKnowledge && relatedKnowledge.length > 0 && (
                <div className="border border-border rounded-2xl p-6 bg-surface">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted mb-3">
                    {lang === "zh" ? "相关内容" : lang === "ja" ? "関連する内容" : "Related"}
                  </p>
                  <ul className="space-y-2">
                    {relatedKnowledge.map((item) => (
                      <li key={item.id} className="text-body-lg">
                        · {item.title[lang]}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border border-border rounded-2xl p-6 bg-surface">
                {feedbackState === "submitted" ? (
                  <p className="text-sm text-muted">{fbLabels.thanks}</p>
                ) : (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted mb-3">
                      {fbLabels.prompt}
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        disabled={feedbackState === "submitting"}
                        onClick={() => submitFeedback(true, "")}
                        className="px-4 py-2 text-sm border border-border rounded-full hover:bg-foreground/5 disabled:opacity-40 transition-colors"
                      >
                        {fbLabels.yes}
                      </button>
                      <button
                        type="button"
                        disabled={feedbackState === "submitting"}
                        onClick={() => setShowCorrection(true)}
                        className="px-4 py-2 text-sm border border-border rounded-full hover:bg-foreground/5 disabled:opacity-40 transition-colors"
                      >
                        {fbLabels.no}
                      </button>
                    </div>
                    {showCorrection && (
                      <div className="mt-4 space-y-3">
                        <textarea
                          value={correction}
                          onChange={(e) => setCorrection(e.target.value)}
                          placeholder={fbLabels.placeholder}
                          rows={4}
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface resize-none"
                        />
                        <button
                          type="button"
                          disabled={feedbackState === "submitting" || !correction.trim()}
                          onClick={() => submitFeedback(false, correction.trim())}
                          className="px-4 py-2 text-sm bg-foreground text-surface rounded-full disabled:opacity-40"
                        >
                          {fbLabels.submit}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
