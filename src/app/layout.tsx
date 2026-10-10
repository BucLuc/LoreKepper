import type { Metadata } from "next";
import { Suspense } from "react";
import { Header, Footer } from "@/components/chrome";
import { ArchiveSkeleton } from "@/components/vault-ui";
import "./globals.css";
import "./vault.css";
import "./historical.css";
import "./editions.css";
import "./refined-editions.css";
import "./reader-controls.css";
import "./captains-log.css";
export const metadata: Metadata = {
  title: {
    default: "LoreKeeper — The Hall of Fame",
    template: "%s · LoreKeeper",
  },
  description:
    "A monument to questionable wisdom. Your shared chronicles, preserved in unnecessary glory.",
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
        <Suspense fallback={<ArchiveSkeleton />}>{children}</Suspense>
        <Footer />
      </body>
    </html>
  );
}
