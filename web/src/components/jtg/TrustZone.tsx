import type { TrustZoneData } from "@/lib/jtg/types";

export function TrustZone({ data }: { data: TrustZoneData }) {
  return (
    <section className="border-y border-border bg-surface px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-lg font-semibold text-foreground">{data.title}</h2>
        <ul className="mt-4 space-y-2">
          {data.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {b}
            </li>
          ))}
        </ul>
        {data.officialSourceLink && (
          <a
            href={data.officialSourceLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm text-accent underline underline-offset-2"
          >
            {data.officialSourceLink.label}
          </a>
        )}
        <p className="mt-4 text-xs text-muted">{data.languageCompletenessNote}</p>
        <p className="mt-2 rounded-md bg-warning/5 px-3 py-2 text-xs text-warning">
          {data.disclaimer}
        </p>
      </div>
    </section>
  );
}
