import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              StartOpenAI
            </Link>
            <p className="mt-3 text-sm text-muted leading-relaxed max-w-md">
              TBD_NEW_POSITIONING
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted mb-4">
              Navigation
            </p>
            <ul className="space-y-2.5">
              {[
                { href: "/about", label: "About" },
                { href: "/work", label: "Work" },
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
                { href: "#", label: "Privacy" },
                { href: "#", label: "Terms" },
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

        <div className="mt-12 pt-6 border-t border-border">
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} StartOpenAI.
          </p>
        </div>
      </div>
    </footer>
  );
}
