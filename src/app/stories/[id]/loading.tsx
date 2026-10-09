import Link from "next/link";

export default function LoadingStory() {
  return (
    <main id="main" className="reader-page loading-story" aria-busy="true">
      <Link href="/#collection" className="eyebrow">
        ← Back to the hall
      </Link>
      <div className="loading-heading" />
      <div className="loading-panel">
        <span aria-hidden="true">✦</span>
        <p role="status">Unrolling the legend…</p>
      </div>
    </main>
  );
}
