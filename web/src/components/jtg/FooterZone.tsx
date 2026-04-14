import type { FooterData } from "@/lib/jtg/types";

export function FooterZone({ data }: { data: FooterData }) {
  return (
    <footer className="border-t border-border bg-surface px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs text-muted">{data.localeNote}</p>
        <p className="mt-1 text-xs text-muted">{data.translationQualityNote}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <a href={data.privacyLink.href} className="text-muted hover:text-accent transition-colors">
            {data.privacyLink.label}
          </a>
          {data.termsLink && (
            <a href={data.termsLink.href} className="text-muted hover:text-accent transition-colors">
              {data.termsLink.label}
            </a>
          )}
          {data.supportLink && (
            <a href={data.supportLink.href} className="text-muted hover:text-accent transition-colors">
              {data.supportLink.label}
            </a>
          )}
        </div>
        <p className="mt-4 text-xs text-muted/50">&copy; {new Date().getFullYear()} JTG</p>
      </div>
    </footer>
  );
}
