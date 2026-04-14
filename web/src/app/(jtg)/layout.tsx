// JTG route group — uses its own NavBar/FooterZone
// No Navigation/Footer from the root layout here
export default function JtgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
