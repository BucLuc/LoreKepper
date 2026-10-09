"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Exhibit, archiveStats } from "@/lib/archive";
import { Icon } from "./icon";
import { matchesStory } from "@/lib/search";
const symbols = ["✦", "❧", "⚜", "✧", "☷", "※"];
function EntryCard({ entry, index }: { entry: Exhibit; index: number }) {
  return (
    <Link
      href={`/stories/${entry.id}`}
      prefetch={false}
      className="exhibit-card"
      style={
        { "--delay": `${Math.min(index, 11) * 30}ms` } as React.CSSProperties
      }
    >
      <div className="card-top">
        <span className="card-index">
          NO. {String(entry.number).padStart(3, "0")}
        </span>
        <span className="score">
          <span aria-hidden="true">✦</span> {entry.score.toFixed(1)}
        </span>
      </div>
      <div className="card-emblem" aria-hidden="true">
        {symbols[entry.number % symbols.length]}
      </div>
      <span className="card-category">{entry.category}</span>
      <h3>{entry.title}</h3>
      <p className="card-preview">
        {entry.preview}
        {entry.preview.length === 190 ? "…" : ""}
      </p>
      <div className="card-bottom">
        <span className="avatar-pair">
          {entry.authors.map((a) => (
            <span
              key={a}
              className={`avatar ${a === "Liri" ? "liri" : ""}`}
              title={a}
            >
              {a.slice(0, 1)}
            </span>
          ))}
        </span>
        <span className="card-author">
          {entry.authors.join(" & ")}
          <small>
            {entry.date} · {entry.minutes} min
          </small>
        </span>
        <Icon name="arrow" />
      </div>
    </Link>
  );
}
export function Hall({
  exhibits,
  stats,
}: {
  exhibits: Exhibit[];
  stats: typeof archiveStats;
}) {
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("");
  const [source, setSource] = useState("");
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState("score");
  const [view, setView] = useState("grid");
  const [page, setPage] = useState(1);
  const search = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pageSize = 18;
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  const matching = useMemo(() => {
    return exhibits
      .filter(
        (e) =>
          (!author || e.authors.includes(author)) &&
          (!source || e.source === source) &&
          (kind === "all" || e.type === kind) &&
          matchesStory(e, query),
      )
      .sort((a, b) =>
        sort === "score"
          ? b.score - a.score || b.time - a.time
          : sort === "oldest"
            ? a.time - b.time
            : sort === "title"
              ? a.title.localeCompare(b.title)
              : sort === "longest"
                ? b.minutes - a.minutes
                : b.time - a.time,
      );
  }, [exhibits, query, author, source, kind, sort]);
  const featured =
    exhibits.find((e) => e.title === "The Legend of Liridon, Beast of BKW") ??
    exhibits.find((e) => e.score === 10) ??
    exhibits[0];
  const pages = Math.ceil(matching.length / pageSize);
  const current = Math.min(page, Math.max(1, pages));
  const visible = matching.slice((current - 1) * pageSize, current * pageSize);
  function clear() {
    setQuery("");
    setAuthor("");
    setSource("");
    setKind("all");
    setPage(1);
  }
  function surprise() {
    const pool = matching.length ? matching : exhibits;
    if (pool.length)
      router.push(
        `/stories/${pool[Math.floor(Math.random() * pool.length)].id}`,
      );
  }
  function changePage(next: number) {
    setPage(next);
    document
      .getElementById("collection")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <main id="main">
      <section className="hero">
        <div className="hall-architecture" aria-hidden="true">
          <div className="arch arch-1" />
          <div className="arch arch-2" />
          <div className="arch arch-3" />
          <div className="column column-left" />
          <div className="column column-right" />
          <div className="hero-rays" />
        </div>
        <div className="eyebrow hero-eyebrow">
          <span /> THE CHRONICLES OF LUC & LIRI <span />
        </div>
        <div className="hero-crest" aria-hidden="true">
          <span>❧</span>
          <Icon name="crown" width="46" height="46" />
          <span>❧</span>
        </div>
        <p className="hero-kicker">WELCOME TO THE</p>
        <h1>
          Hall of <em>Fame.</em>
        </h1>
        <div className="hero-ornament" aria-hidden="true">
          <span />✦<span />
        </div>
        <p className="hero-description">
          Some words deserve to live forever.
          <br />
          Others simply refuse to be forgotten.
        </p>
        <div className="hero-actions">
          <a href="#collection" className="gold-button">
            Explore the collection <span>↓</span>
          </a>
          <button className="quiet-button" onClick={surprise}>
            <Icon name="shuffle" /> Surprise me
          </button>
        </div>
        <div className="hero-stats">
          <div>
            <strong>{stats.stories}</strong>
            <span>IMMORTAL STORIES</span>
          </div>
          <span className="stat-star" aria-hidden="true">
            ✧
          </span>
          <div>
            <strong>{stats.authors.length}</strong>
            <span>LEGENDARY MINDS</span>
          </div>
          <span className="stat-star" aria-hidden="true">
            ✧
          </span>
          <div>
            <strong>∞</strong>
            <span>UNNECESSARY GRANDEUR</span>
          </div>
        </div>
        <span className="hero-side-note">
          A PRIVATE ARCHIVE · {stats.years[0]}—{stats.years.at(-1)}
        </span>
      </section>
      <div className="content-wrap">
        {featured && (
          <Link
            href={`/stories/${featured.id}`}
            prefetch={false}
            className="featured"
          >
            <div className="featured-seal">
              <Icon name="crown" width="36" height="36" />
              <span>THE CROWN JEWEL</span>
              <small>A legend worth your time</small>
            </div>
            <div className="featured-copy">
              <div className="eyebrow">
                CURATOR’S SPOTLIGHT{" "}
                <span className="feature-rating">
                  ✦ {featured.score.toFixed(1)} / 10
                </span>
              </div>
              <h2>{featured.title}</h2>
              <p>{featured.preview}…</p>
              <div className="meta">
                {featured.authors.join(" & ")} <span>·</span> {featured.date}{" "}
                <span>·</span> {featured.minutes} min read
              </div>
            </div>
            <span className="featured-arrow">
              <Icon name="arrow" />
            </span>
          </Link>
        )}
        <section id="collection" className="collection">
          <div className="collection-heading">
            <div>
              <div className="eyebrow">THE PERMANENT COLLECTION</div>
              <h2>
                Immortalised. <em>For better or worse.</em>
              </h2>
            </div>
            <p>
              An archive of accidental brilliance,
              <br />
              elaborate nonsense, and impeccable timing.
            </p>
          </div>
          <div className="collection-toolbar">
            <label className="search">
              <Icon name="search" />
              <input
                ref={search}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search titles and message content…"
                aria-label="Search stories and messages"
              />
              <kbd>/</kbd>
            </label>
            <label className="filter-select">
              <span className="sr-only">Filter by author</span>
              <select
                value={author}
                onChange={(e) => {
                  setAuthor(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All minds</option>
                {stats.authors.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span className="sr-only">Filter by source</span>
              <select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All sources</option>
                <option value="teams">Teams</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </label>
            <label className="filter-select">
              <span className="sr-only">Sort stories</span>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
              >
                <option value="score">Highest rated</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title">Title A–Z</option>
                <option value="longest">Longest legends</option>
              </select>
            </label>
          </div>
          <div className="collection-subbar">
            <div className="type-tabs" role="group" aria-label="Story type">
              {[
                ["all", "All legends"],
                ["single", "Solo masterpieces"],
                ["discussion", "Conversations"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={kind === value}
                  className={kind === value ? "active" : ""}
                  onClick={() => {
                    setKind(value);
                    setPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="view-controls">
              <span aria-live="polite">{matching.length} stories</span>
              <button
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                <Icon name="grid" />
              </button>
              <button
                aria-label="List view"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <Icon name="list" />
              </button>
            </div>
          </div>
          {(query || author || source || kind !== "all") && (
            <div className="active-filter-bar">
              <span>Showing your selected archive</span>
              <button onClick={clear}>Clear filters ×</button>
            </div>
          )}
          <div
            className={`exhibit-grid ${view === "list" ? "exhibit-list" : ""}`}
          >
            {visible.map((entry, index) => (
              <EntryCard key={entry.id} entry={entry} index={index} />
            ))}
            {!visible.length && (
              <div className="empty-state">
                <Icon name="search" width="36" height="36" />
                <h3>Even legends have their limits.</h3>
                <p>
                  No stories match these filters. Try another word or return to
                  the full collection.
                </p>
                <button onClick={clear} className="gold-button">
                  Show all legends <Icon name="arrow" />
                </button>
              </div>
            )}
          </div>
          {pages > 1 && (
            <nav className="pagination" aria-label="Collection pages">
              <button
                disabled={current === 1}
                onClick={() => changePage(current - 1)}
              >
                ← Previous
              </button>
              <span>
                Page <strong>{current}</strong> of {pages}
              </span>
              <button
                disabled={current === pages}
                onClick={() => changePage(current + 1)}
              >
                Next <span>→</span>
              </button>
            </nav>
          )}
        </section>
        <section className="closing">
          <span aria-hidden="true">❧ ✦ ❧</span>
          <p>
            Two friends. Countless questionable words.
            <br />
            <em>One unnecessarily glorious archive.</em>
          </p>
          <small>LET THE RECORD SHOW: IT WAS FUNNY AT THE TIME.</small>
        </section>
      </div>
    </main>
  );
}
