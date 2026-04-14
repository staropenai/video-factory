import { Navigation } from "@/components/layout/navigation";
import { Footer } from "@/components/layout/footer";
import { SessionProvider } from "@/lib/session-context";

// Original app layout — Navigation + Footer wrapping all existing pages
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <Navigation />
      <main className="flex-1">{children}</main>
      <Footer />
    </SessionProvider>
  );
}
