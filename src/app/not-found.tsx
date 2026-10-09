import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="not-found">
      <span className="eyebrow">ARCHIVE ERROR · 404</span>
      <h1>
        A legend <em>lost to time.</em>
      </h1>
      <p>This story isn’t in the collection.</p>
      <Link className="gold-button" href="/">
        Return to the hall <span>→</span>
      </Link>
    </main>
  );
}
