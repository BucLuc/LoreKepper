"use client";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Exhibit, Message } from "@/lib/archive";
import { authorName, dateLabel, displayTime, storyText } from "@/lib/format";
import { Icon } from "./icon";
import { HistoricalDecorations, RoyalCrest } from "./historical-art";
import { EpicSigil } from "./epic-sigil";

import {
  extraEditions,
  EditionHeader,
  EditionMessageLabel,
  EditionEnd,
} from "./extra-editions";
const styles = [
  ...extraEditions,
  {
    id: "glorious",
    name: "Glorious",
    mark: "✦",
    description: "Gold, grandeur, and absolutely no restraint.",
    label: "THE IMMORTAL CHRONICLES",
  },
  {
    id: "newspaper",
    name: "Newspaper",
    mark: "▤",
    description: "Yesterday’s nonsense. Today’s front page.",
    label: "THE LOREKEEPER GAZETTE",
  },
  {
    id: "manuscript",
    name: "Medieval Manuscript",
    mark: "❧",
    description: "Illuminated pages from a deeply unserious age.",
    label: "FROM THE BOOK OF QUESTIONABLE DEEDS",
  },
  {
    id: "scroll",
    name: "Ancient Scroll",
    mark: "☷",
    description: "Unearthed wisdom. Suspiciously well preserved.",
    label: "FRAGMENT FROM THE SACRED ARCHIVES",
  },
  {
    id: "decree",
    name: "Royal Decree",
    mark: "♛",
    description: "By order of their extremely questionable majesties.",
    label: "BY ROYAL APPOINTMENT",
  },
  {
    id: "screenplay",
    name: "Movie Screenplay",
    mark: "▶",
    description: "A cinematic record. Oscar nomination pending.",
    label: "LOREKEEPER PICTURES PRESENTS",
  },
  {
    id: "social",
    name: "Social Media Post",
    mark: "@",
    description: "Posted for posterity. Immortalised by the archive.",
    label: "LOREKEEPER SOCIAL · THE ARCHIVED FEED",
  },
  {
    id: "incident",
    name: "Corporate Incident Report",
    mark: "▧",
    description: "Filed with HR. Immediately escalated.",
    label: "INTERNAL INCIDENT REGISTER",
  },
  {
    id: "dossier",
    name: "Classified Dossier",
    mark: "⊕",
    description: "Eyes only. Clearance: questionable.",
    label: "DIRECTORATE OF QUESTIONABLE INTELLIGENCE",
  },
  {
    id: "letter",
    name: "Formal Letter",
    mark: "✉",
    description: "Sincerely yours, with absolutely no remorse.",
    label: "PRIVATE CORRESPONDENCE",
  },
  {
    id: "terminal",
    name: "Terminal Archive",
    mark: ">_",
    description: "The logs don’t lie. They do occasionally roast.",
    label: "LOREKEEPER ARCHIVE TERMINAL",
  },
];
const editionGroups = [
  {
    name: "Legend & History",
    ids: ["glorious", "manuscript", "scroll", "decree", "poetry", "prophecy"],
  },
  { name: "Artifacts & Places", ids: ["museum", "tavern", "wanted", "card"] },
  {
    name: "Media & Entertainment",
    ids: ["newspaper", "screenplay", "social", "news", "lyrics"],
  },
  {
    name: "Official Records",
    ids: ["incident", "dossier", "letter", "court", "academic"],
  },
  { name: "Technology & Sci-Fi", ids: ["terminal", "space", "bug"] },
];
function readPreferences() {
  try {
    return localStorage.getItem("lorekeeper-reader") ?? "";
  } catch {
    return "";
  }
}
function subscribeToPreferences(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("lorekeeper-preferences", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("lorekeeper-preferences", callback);
  };
}
function MessageBody({ message, plain }: { message: Message; plain: boolean }) {
  const looksLikeArt =
    /[╔╗╚╝║═┌┐└┘│─]/.test(message.content) ||
    message.content.split("\n").filter((l) => /^\s{4,}[^\w\s]{2,}/.test(l))
      .length > 2;
  if (plain || looksLikeArt)
    return (
      <pre className={`message-text ${looksLikeArt ? "ascii-art" : ""}`}>
        {message.content}
      </pre>
    );
  return (
    <div className="message-prose">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {message.presentation ?? message.content}
      </Markdown>
    </div>
  );
}
export function Reader({
  entry,
  previous,
  next,
}: {
  entry: Exhibit;
  previous: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
}) {
  const saved = useSyncExternalStore(
    subscribeToPreferences,
    readPreferences,
    () => "",
  );
  const stored = useMemo(() => {
    try {
      const value = JSON.parse(saved || "{}");
      return {
        style:
          value.style === "transcript"
            ? "manuscript"
            : styles.some((s) => s.id === value.style)
              ? (value.style as string)
              : "glorious",
        size: [16, 18, 20, 22].includes(value.size)
          ? (value.size as number)
          : 18,
        plain: value.plain === true,
      };
    } catch {
      return { style: "glorious", size: 18, plain: false };
    }
  }, [saved]);
  const [override, setOverride] = useState<typeof stored | null>(null);
  const { style, size, plain } = override ?? stored;
  const [expandedGroup, setExpandedGroup] = useState<string | null | undefined>(
    undefined,
  );
  const activeGroup = editionGroups.find((group) =>
    group.ids.includes(style),
  )!.name;
  const openGroup = expandedGroup === undefined ? activeGroup : expandedGroup;
  const [copyStatus, setCopyStatus] = useState("");
  const [fallback, setFallback] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pdfDownload, setPdfDownload] = useState<{
    url: string;
    filename: string;
  } | null>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const maximizeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!maximized) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMaximized(false);
        maximizeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", escape);
    };
  }, [maximized]);
  async function exportPdf() {
    if (!documentRef.current || exporting) return;
    setExporting(true);
    setCopyStatus("Preparing your PDF…");
    try {
      const { exportStoryPdf } = await import("@/lib/export-pdf");
      const download = await exportStoryPdf(
        documentRef.current,
        entry.title,
        theme.name,
      );
      setPdfDownload(download);
      setCopyStatus("Your PDF is ready.");
    } catch {
      setCopyStatus("PDF export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }
  function preferences(newStyle: string, newSize = size, newPlain = plain) {
    setPdfDownload(null);
    const value = { style: newStyle, size: newSize, plain: newPlain };
    setOverride(value);
    try {
      localStorage.setItem("lorekeeper-reader", JSON.stringify(value));
      window.dispatchEvent(new Event("lorekeeper-preferences"));
    } catch {
      /* Preferences still work when storage is disabled. */
    }
  }
  useEffect(() => {
    if (!copyStatus) return;
    const timeout = setTimeout(() => setCopyStatus(""), 4000);
    return () => clearTimeout(timeout);
  }, [copyStatus]);
  async function copy(attributed = false) {
    const text = storyText(entry, attributed);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(
        attributed
          ? "Conversation copied with author and date."
          : "Original message text copied.",
      );
    } catch {
      setFallback(text);
      setCopyStatus("Select the text below and copy it manually.");
    }
  }
  const theme = styles.find((s) => s.id === style)!;
  const recommended =
    styles.find((s) => s.id === entry.recommended) ??
    styles.find((s) => s.id === "glorious")!;
  const reference = String(entry.number).padStart(3, "0");
  const isTranscript = [
    "screenplay",
    "incident",
    "dossier",
    "terminal",
  ].includes(style);
  return (
    <main
      id="main"
      className={`reader-page ${maximized ? "reader-maximized" : ""}`}
    >
      <header className="reader-heading">
        <nav className="eyebrow entry-breadcrumb" aria-label="Breadcrumb">
          <Link href="/#collection">THE COLLECTION</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">EXHIBIT {reference}</span>
        </nav>
        <h1>{entry.title}</h1>
        <div className="reader-meta">
          <span className="avatar-pair">
            {entry.authors.map((a) => (
              <span key={a} className={`avatar ${a === "Liri" ? "liri" : ""}`}>
                {a[0]}
              </span>
            ))}
          </span>
          <span>{entry.authors.join(" & ")}</span>
          <span>·</span>
          <span>{entry.date}</span>
          <span>·</span>
          <span>{entry.minutes} min read</span>
          <span>·</span>
          <span>
            {entry.source === "whatsapp" ? "WhatsApp" : "Microsoft Teams"}
          </span>
          <span className="reader-rating">✦ {entry.score.toFixed(1)} / 10</span>
        </div>
      </header>
      <div className="reader-layout">
        <aside className="reader-sidebar">
          <div className="eyebrow">DRESS THE LEGEND</div>
          <h2>
            A change of <em>atmosphere.</em>
          </h2>
          <p>Same words. Different worlds.</p>
          <div
            className="style-picker"
            role="group"
            aria-label="Story presentation"
          >
            <div className="selected-edition">
              {theme.mark} {theme.name}
            </div>
            {editionGroups.map((group, groupIndex) => (
              <div className="edition-group" key={group.name}>
                <button
                  className="edition-group-toggle"
                  aria-expanded={openGroup === group.name}
                  aria-controls={`edition-group-${groupIndex}`}
                  onClick={() =>
                    setExpandedGroup(
                      openGroup === group.name ? null : group.name,
                    )
                  }
                >
                  <span>{group.name}</span>
                  <span aria-hidden="true">
                    {openGroup === group.name ? "−" : "+"}
                  </span>
                </button>
                <div
                  id={`edition-group-${groupIndex}`}
                  hidden={openGroup !== group.name}
                >
                  {styles
                    .filter((s) => group.ids.includes(s.id))
                    .sort(
                      (a, b) =>
                        group.ids.indexOf(a.id) - group.ids.indexOf(b.id),
                    )
                    .map((s) => (
                      <button
                        key={s.id}
                        aria-pressed={style === s.id}
                        className={style === s.id ? "active" : ""}
                        onClick={() => preferences(s.id)}
                      >
                        <span className="style-mark" aria-hidden="true">
                          {s.mark}
                        </span>
                        <span>{s.name}</span>
                        {style === s.id && (
                          <span className="style-active-dot" />
                        )}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
          <div className="recommended">
            <span className="eyebrow">CURATOR’S SUGGESTION</span>
            <button onClick={() => preferences(recommended.id)}>
              {recommended.mark} {recommended.name} <span>↗</span>
            </button>
          </div>
          <div className="reader-options">
            <span className="eyebrow">READING COMFORT</span>
            <div className="size-controls">
              <button
                aria-label="Decrease text size"
                disabled={size === 16}
                onClick={() => preferences(style, size - 2)}
              >
                A−
              </button>
              <span>{size}px</span>
              <button
                aria-label="Increase text size"
                disabled={size === 22}
                onClick={() => preferences(style, size + 2)}
              >
                A+
              </button>
            </div>
            <label className="plain-toggle">
              <input
                type="checkbox"
                checked={plain}
                onChange={(e) => preferences(style, size, e.target.checked)}
              />
              <span>Show unformatted text</span>
            </label>
          </div>
        </aside>
        <div className="reader-main">
          <div className="reader-toolbar">
            <div>
              <span aria-hidden="true">{theme.mark}</span> {theme.name}
            </div>
            <div className="copy-actions">
              {maximized && <Link href="/#collection" className="maximized-hall-link">← Back to the Hall</Link>}
              <button
                ref={maximizeRef}
                onClick={() => setMaximized((value) => !value)}
                aria-pressed={maximized}
              >
                {maximized ? "↙ Restore" : "↗ Maximize"}
              </button>
              <button onClick={() => copy()}>
                <Icon
                  name={copyStatus.startsWith("Original") ? "check" : "copy"}
                />{" "}
                Copy Text
              </button>
              {entry.messages.length > 1 && (
                <button onClick={() => copy(true)}>Copy transcript</button>
              )}
              <button
                onClick={exportPdf}
                disabled={exporting}
                aria-busy={exporting}
              >
                {exporting ? "Exporting…" : "Export as PDF"}
              </button>
            </div>
          </div>
          <div className="copy-status" role="status">
            {copyStatus || theme.description}
            {pdfDownload && (
              <a
                className="pdf-download"
                href={pdfDownload.url}
                download={pdfDownload.filename}
              >
                Download PDF again ↓
              </a>
            )}
          </div>
          {fallback !== null && (
            <div className="copy-fallback">
              <label htmlFor="manual-copy">Copy manually (Ctrl+C)</label>
              <textarea
                id="manual-copy"
                value={fallback}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <button onClick={() => setFallback(null)}>Close</button>
            </div>
          )}
          <div ref={documentRef} className={`edition-stage stage-${style}`}>
            {style === "scroll" && (
              <>
                <span
                  className="scroll-spindle spindle-top"
                  aria-hidden="true"
                />
                <span
                  className="scroll-spindle spindle-bottom"
                  aria-hidden="true"
                />
              </>
            )}
            <article
              className={`story-document theme-${style} ${plain ? "plain-mode" : ""}`}
              style={{ "--reading-size": `${size}px` } as React.CSSProperties}
            >
              {["manuscript", "decree"].includes(style) && (
                <HistoricalDecorations kind={style} number={entry.number} />
              )}
              <div className="document-header">
                <span className="document-ornament" aria-hidden="true">
                  {style === "decree" ? (
                    <RoyalCrest />
                  ) : ["glorious", "prophecy", "poetry"].includes(style) ? (
                    <EpicSigil
                      kind={style as "glorious" | "prophecy" | "poetry"}
                    />
                  ) : (
                    theme.mark
                  )}
                </span>
                <div className="document-label">{theme.label}</div>
                {style === "newspaper" && (
                  <div className="newspaper-edition">
                    VOL. I · NO. {reference}{" "}
                    <span>{entry.date.toUpperCase()}</span> PRICE: YOUR DIGNITY
                  </div>
                )}
                {style === "dossier" && (
                  <div className="classified-stamp">
                    TOP SECRET // LORE EYES ONLY
                  </div>
                )}
                {style === "terminal" && (
                  <div className="terminal-command">
                    $ lorekeeper read --exhibit {reference}
                    <br />
                    <span>[OK] Archive retrieved. Integrity intact.</span>
                  </div>
                )}
                <h2>{entry.title}</h2>
                <div className="document-meta">
                  {style === "decree"
                    ? "ISSUED IN THE NAME OF"
                    : style === "screenplay"
                      ? "WRITTEN BY"
                      : style === "incident"
                        ? "PARTIES ON RECORD"
                        : "PRESERVED WORDS OF"}{" "}
                  {entry.authors.join(" & ").toUpperCase()}
                </div>
                {["incident", "dossier", "letter"].includes(style) && (
                  <dl className="document-fields">
                    <div>
                      <dt>{style === "letter" ? "Date" : "Reference"}</dt>
                      <dd>
                        {style === "letter" ? entry.date : `LK-${reference}`}
                      </dd>
                    </div>
                    <div>
                      <dt>{style === "letter" ? "From" : "Recorded"}</dt>
                      <dd>
                        {style === "letter"
                          ? entry.authors.join(" & ")
                          : entry.date}
                      </dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>
                        {entry.source === "whatsapp"
                          ? "WhatsApp"
                          : "Microsoft Teams"}
                      </dd>
                    </div>
                    <div>
                      <dt>{style === "incident" ? "Status" : "Record"}</dt>
                      <dd>
                        {style === "incident"
                          ? "Preserved for review"
                          : `${entry.messages.length} message${entry.messages.length === 1 ? "" : "s"}`}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
              <EditionHeader
                style={style}
                reference={reference}
                authors={entry.authors.join(" & ")}
                date={entry.date}
                score={entry.score}
              />
              <div className="document-body">
                {entry.messages.map((message, index) => (
                  <section
                    key={message.id}
                    className={`story-message ${authorName(message.author) === "Liri" ? "by-liri" : "by-luc"}`}
                  >
                    <EditionMessageLabel style={style} index={index} />
                    <div className="message-attribution">
                      {style === "card" && (
                        <span
                          className="collectible-portrait"
                          aria-hidden="true"
                        >
                          {authorName(message.author)[0]}
                        </span>
                      )}
                      {style === "social" && (
                        <span className="social-avatar" aria-hidden="true">
                          {authorName(message.author)[0]}
                        </span>
                      )}
                      {style === "screenplay" && (
                        <span className="scene-number">
                          SCENE {index + 1} · ARCHIVED EXCHANGE
                        </span>
                      )}
                      <span className="message-speaker">
                        {style === "incident"
                          ? "Statement / "
                          : style === "terminal"
                            ? "> "
                            : ""}
                        {authorName(message.author)}
                      </span>
                      <span className="message-timestamp">
                        {dateLabel(message.timestamp)} ·{" "}
                        {displayTime(message.timestamp)}
                      </span>
                      {style === "dossier" && (
                        <span className="evidence-label">
                          EXHIBIT {reference}.{index + 1}
                        </span>
                      )}
                    </div>
                    <MessageBody message={message} plain={plain} />
                    {style === "social" && (
                      <div className="social-post-footer">
                        <span>♡ Preserved</span>
                        <span>↗ From the archives</span>
                        <span>◇ Exhibit {reference}</span>
                      </div>
                    )}
                    {isTranscript && (
                      <div className="message-end" aria-hidden="true">
                        {style === "terminal"
                          ? "[END OF RECORD]"
                          : style === "dossier"
                            ? "— END OF EVIDENCE —"
                            : ""}
                      </div>
                    )}
                  </section>
                ))}
              </div>
              <div className="document-footer">
                <EditionEnd style={style} />
                <span aria-hidden="true">
                  {style === "decree"
                    ? "♛"
                    : style === "terminal"
                      ? "EOF"
                      : "✦"}
                </span>
                <small>
                  {style === "screenplay"
                    ? "FADE OUT. THE NONSENSE ENDURES."
                    : style === "incident"
                      ? "END OF REPORT · NO FURTHER ACTION TAKEN"
                      : style === "dossier"
                        ? "DOCUMENT ENDS · RETURN TO ARCHIVE"
                        : style === "decree"
                          ? "SO RECORDED. SO IMMORTALISED."
                          : "HERE ENDS THE RECORD. THE LEGEND CONTINUES."}
                </small>
              </div>
            </article>
          </div>
          <details className="curator-note">
            <summary>
              Why this made the hall <span>+</span>
            </summary>
            <p>{entry.reason}</p>
            <span>Archive rating: {entry.score.toFixed(1)} / 10</span>
          </details>
          <nav className="reader-pagination" aria-label="Adjacent stories">
            {previous ? (
              <Link href={`/stories/${previous.id}`} prefetch={false}>
                <small>← PREVIOUS LEGEND</small>
                <span>{previous.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/stories/${next.id}`} prefetch={false}>
                <small>NEXT LEGEND →</small>
                <span>{next.title}</span>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </div>
      </div>
    </main>
  );
}
