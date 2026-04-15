import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Japan Trust Gateway",
  description:
    "Trusted guidance for foreigners renting and living in Japan. Housing help in English, Chinese, and Japanese.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Japan Trust Gateway",
    description:
      "Trusted guidance for foreigners renting and living in Japan.",
    type: "website",
  },
};

// Root layout — minimal shell. Route groups add their own chrome:
// (main) = old app with Navigation/Footer
// (jtg)  = JTG homepage with its own NavBar/FooterZone
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
