import Link from "next/link";
import { COMPANY } from "@/lib/company";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              {COMPANY.brand}
            </Link>
            <p className="mt-3 text-sm text-muted leading-relaxed max-w-md">
              {COMPANY.tagline.en}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
              Navigation
            </p>
            <ul className="space-y-2.5">
              {[
                { href: "/zh-Hans", label: "Guide" },
                { href: "/try", label: "Ask AI" },
                { href: "/contact", label: "Contact" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
              Legal
            </p>
            <ul className="space-y-2.5">
              {[
                { href: COMPANY.links.privacy, label: "Privacy" },
                { href: COMPANY.links.terms, label: "Terms" },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Company info */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium">{COMPANY.legalNameJa}</p>
              <p className="text-sm text-muted">{COMPANY.legalNameEn}</p>
              <p className="mt-2 text-xs text-muted">
                {COMPANY.address.postal} {COMPANY.address.full}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">
                TEL: {COMPANY.tel}
              </p>
              <p className="text-xs text-muted">
                Email: {COMPANY.email}
              </p>
              <ul className="mt-2 space-y-1">
                {COMPANY.credentials.map((cred) => (
                  <li key={cred.ja} className="text-xs text-muted">
                    {cred.ja}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} {COMPANY.brand}.
          </p>
        </div>
      </div>
    </footer>
  );
}
