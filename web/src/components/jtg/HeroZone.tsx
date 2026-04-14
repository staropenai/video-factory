"use client";

import type { HeroData } from "@/lib/jtg/types";
import { trackHeroEntryClick } from "@/lib/jtg/track";

const ICONS: Record<string, string> = {
  plane: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  home: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  building: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-16 0H3m4-12h2m4 0h2m-6 4h2m4 0h2",
};

export function HeroZone({ data }: { data: HeroData }) {
  return (
    <section className="bg-gradient-to-b from-accent-light to-background px-4 pb-12 pt-16">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
          <span className="block">{data.title.line1}</span>
          <span className="block text-accent">{data.title.line2}</span>
        </h1>
        {data.subtitle && (
          <p className="mx-auto mt-4 max-w-xl text-base text-muted">
            {data.subtitle}
          </p>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {data.cards.map((card) => (
            <a
              key={card.key}
              href={card.href}
              onClick={() => trackHeroEntryClick(card.key, "hero")}
              className="group rounded-xl border border-border bg-surface p-6 text-left shadow-sm transition-all hover:border-accent hover:shadow-md"
            >
              <svg
                className="mb-3 h-8 w-8 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={ICONS[card.icon] || ICONS.home}
                />
              </svg>
              <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                {card.title}
              </h3>
              <p className="mt-1 text-sm text-muted">{card.description}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
