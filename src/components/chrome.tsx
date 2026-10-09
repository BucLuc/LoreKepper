import Link from "next/link";
import { Icon } from "./icon";
export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="LoreKeeper home">
        <span className="brand-icon">
          <Icon name="book" />
        </span>
        <span>
          Lore<span className="brand-gold">Keeper</span>
          <small>THE PRIVATE COLLECTION</small>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/#collection">Collection</Link>
        <span className="nav-divider" />
        <span className="nav-motto">TWO MINDS. ONE LEGEND.</span>
        <span className="nav-star" aria-hidden="true">
          ✦
        </span>
      </nav>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <span className="footer-brand">
        LoreKeeper <span>EST. IN QUESTIONABLE JUDGEMENT</span>
      </span>
      <span>Preserved for posterity. Unfortunately.</span>
      <a href="#top">Back to the heavens ↑</a>
    </footer>
  );
}
