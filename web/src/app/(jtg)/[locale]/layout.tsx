import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JTG - 在日外国人生活助手",
  description: "在日本租房生活，有问题先问这里。中日英三语知识库 + AI 问答 + 人工帮助。",
  robots: { index: true, follow: true },
};

export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout renders without the global Navigation/Footer
  // because HomePage has its own NavBar and FooterZone
  return <>{children}</>;
}
