import type { Metadata } from "next";
import { Header, Footer } from "@/components/chrome";
import "./globals.css";
import "./historical.css";
import "./editions.css";
import "./refined-editions.css";
export const metadata: Metadata = {
  title: {
    default: "LoreKeeper — The Hall of Fame",
    template: "%s · LoreKeeper",
  },
  description:
    "A monument to questionable wisdom. The legendary messages of Luc and Liri, preserved in unnecessary glory.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body id="top">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
