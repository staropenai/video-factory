"use client";

import type { HumanHelpData } from "@/lib/jtg/types";
import { trackHumanHelpClick } from "@/lib/jtg/track";

export function HumanHelpZone({ data }: { data: HumanHelpData }) {
  return (
    <section id="human-help" className="mx-auto max-w-4xl px-4 py-12">
      <h2 className="text-2xl font-bold text-foreground">{data.title}</h2>
      <p className="mt-1 text-sm text-muted">{data.description}</p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {/* Scenes */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold text-foreground">适用场景</h3>
          <ul className="mt-3 space-y-2">
            {data.scenes.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted">
                <span className="mt-0.5 text-accent">-</span>
                {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Channels */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold text-foreground">联系方式</h3>
          <div className="mt-3 space-y-3">
            {data.channels.map((ch) => (
              <div key={ch.type} className="flex items-center gap-3">
                <ChannelIcon type={ch.type} />
                <div>
                  <span className="text-sm text-foreground">{ch.label}</span>
                  {ch.href ? (
                    <a
                      href={ch.href}
                      className="ml-2 text-sm text-accent underline underline-offset-2"
                      target={ch.type === "line" ? "_blank" : undefined}
                      rel={ch.type === "line" ? "noopener noreferrer" : undefined}
                    >
                      {ch.value || "打开"}
                    </a>
                  ) : (
                    <span className="ml-2 text-sm text-muted">{ch.value}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Response time — explicit non-immediate promise */}
          <p className="mt-4 rounded-md bg-accent-light px-3 py-2 text-xs text-muted">
            {data.responseWindowText}
          </p>

          <a
            href={data.ctaHref}
            onClick={() => trackHumanHelpClick("home_human_help")}
            className="mt-4 block rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent/90 transition-colors"
          >
            {data.ctaLabel}
          </a>
        </div>
      </div>
    </section>
  );
}

function ChannelIcon({ type }: { type: string }) {
  const cls = "h-5 w-5 text-accent";
  switch (type) {
    case "email":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      );
    case "line":
      return <span className={cls + " text-center font-bold text-sm leading-5"}>L</span>;
    case "form":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25" />
        </svg>
      );
    default:
      return <span className="h-5 w-5" />;
  }
}
