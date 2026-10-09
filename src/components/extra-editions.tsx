export const extraEditions = [
  [
    "museum",
    "Museum Exhibit",
    "◇",
    "An artifact of immeasurable cultural importance.",
    "THE MUSEUM OF QUESTIONABLE WISDOM",
  ],
  [
    "court",
    "Court Transcript",
    "⚖",
    "The court will now hear the evidence.",
    "IN THE HIGH COURT OF FRIENDSHIP",
  ],
  [
    "poetry",
    "Poetry",
    "❦",
    "An ancient fragment, preserved across the ages.",
    "FRAGMENTS FROM THE ANCIENT SONGS",
  ],
  [
    "tavern",
    "Tavern Noticeboard",
    "♧",
    "Pinned beside the hearth at The Crooked Quill.",
    "THE CROOKED QUILL · PUBLIC NOTICES",
  ],
  [
    "wanted",
    "Wanted Poster",
    "★",
    "Wanted for crimes against reasonable conversation.",
    "WANTED",
  ],
  [
    "card",
    "Trading Card",
    "✵",
    "A legendary collectible from the friendship archives.",
    "LOREKEEPER · LEGENDARY COLLECTION",
  ],
  [
    "space",
    "Space Transmission",
    "⌁",
    "Recovered from the far reaches of the friendship sector.",
    "DEEP SPACE RELAY / INCOMING TRANSMISSION",
  ],
  [
    "prophecy",
    "Prophecy",
    "☽",
    "The stars foretold this. Regrettably.",
    "THE ORACLE OF QUESTIONABLE OMENS",
  ],
  [
    "academic",
    "Academic Paper",
    "§",
    "Published in the Journal of Applied Nonsense.",
    "JOURNAL OF APPLIED NONSENSE",
  ],
  [
    "news",
    "Breaking News",
    "◉",
    "A special report from the private archive.",
    "LK24 / BREAKING NEWS",
  ],
  [
    "bug",
    "Bug Report",
    "⌘",
    "Unexpected behaviour. Perfectly preserved.",
    "LOREKEEPER / ISSUE TRACKER",
  ],
  [
    "lyrics",
    "Album Lyrics",
    "♫",
    "The original words. An entirely different rhythm.",
    "LOREKEEPER RECORDS / THE LYRIC INSERT",
  ],
].map(([id, name, mark, description, label]) => ({
  id,
  name,
  mark,
  description,
  label,
}));
export function EditionHeader({
  style,
  reference,
  authors,
  date,
  score,
}: {
  style: string;
  reference: string;
  authors: string;
  date: string;
  score: number;
}) {
  switch (style) {
    case "museum":
      return (
        <div className="museum-label">
          <span>PERMANENT COLLECTION</span>
          <strong>Accession LK.{reference}</strong>
          <p>
            Private correspondence · {date}
            <br />
            Collection of {authors}
          </p>
          <small>
            A surviving record of friendship, elaborate humour, and the human
            urge to commit nonsense to writing.
          </small>
        </div>
      );
    case "court":
      return (
        <div className="court-case">
          <span>CASE LK–{reference}</span>
          <span>OFFICIAL RECORD · {date}</span>
          <strong>In the matter of {authors} versus common sense</strong>
        </div>
      );
    case "poetry":
      return (
        <div className="poetry-invocation">
          ❧<br />
          <span>Of friendship, folly, and words that endure</span>
        </div>
      );
    case "tavern":
      return (
        <div className="tavern-pin" aria-hidden="true">
          ✦
        </div>
      );
    case "wanted":
      return (
        <div className="wanted-reward">
          <span>FOR CRIMES AGAINST REASONABLE CONVERSATION</span>
          <strong>REWARD: ETERNAL NOTORIETY</strong>
          <small>Last known associates: {authors}</small>
        </div>
      );
    case "card":
      return (
        <div className="card-rarity">
          <span>✵ LEGENDARY</span>
          <span>#{reference} / PRIVATE COLLECTION</span>
          <strong>
            {score.toFixed(1)} <small>LORE POWER</small>
          </strong>
        </div>
      );
    case "space":
      return (
        <div className="space-telemetry">
          <span>RELAY LK-{reference}</span>
          <span>SIGNAL INTEGRITY: INTACT</span>
          <span>ORIGIN: {authors.toUpperCase()}</span>
          <span>RECEIVED: {date.toUpperCase()}</span>
        </div>
      );
    case "prophecy":
      return (
        <div className="prophecy-orbit" aria-hidden="true">
          <span>✧</span>
          <strong>☽ ✦ ☾</strong>
          <span>✧</span>
        </div>
      );
    case "academic":
      return (
        <div className="academic-abstract">
          <span>ARCHIVAL EDITION · VOL. I · ARTICLE {reference}</span>
          <strong>Editorial abstract</strong>
          <p>
            This primary source documents an exchange preserved in the private
            collection. The following text is reproduced without editorial
            alteration.
          </p>
        </div>
      );
    case "news":
      return (
        <div className="news-live">
          <strong>SPECIAL REPORT</strong>
          <span>ARCHIVE RECORD / {date.toUpperCase()}</span>
        </div>
      );
    case "bug":
      return (
        <dl className="bug-fields">
          <div>
            <dt>Issue</dt>
            <dd>LORE-{reference}</dd>
          </div>
          <div>
            <dt>Severity</dt>
            <dd>Legendary</dd>
          </div>
          <div>
            <dt>Expected behaviour</dt>
            <dd>Reasonable conversation</dd>
          </div>
          <div>
            <dt>Actual behaviour</dt>
            <dd>See preserved record below</dd>
          </div>
        </dl>
      );
    case "lyrics":
      return (
        <div className="album-art" aria-hidden="true">
          <div className="vinyl-record" />
          <span>
            SIDE A<br />
            TRACK {reference}
          </span>
        </div>
      );
    default:
      return null;
  }
}
export function EditionMessageLabel({
  style,
  index,
}: {
  style: string;
  index: number;
}) {
  const labels: Record<string, string> = {
    court: "TESTIMONY",
    academic: "PRIMARY SOURCE",
    bug: "REPRODUCTION RECORD",
    lyrics: "TRACK PASSAGE",
    poetry: "CANTO",
    space: "TRANSMISSION BLOCK",
    card: "ARCHIVED ABILITY",
  };
  return labels[style] ? (
    <div className="edition-message-label">
      {labels[style]} {String(index + 1).padStart(2, "0")}
    </div>
  ) : null;
}
export function EditionEnd({ style }: { style: string }) {
  const captions: Record<string, string> = {
    news: "LOREKEEPER NEWS / PRIMARY SOURCE RECORD / ORIGINAL WORDS PRESERVED",
    court: "ADMITTED INTO THE RECORD",
    museum: "PLEASE DO NOT TOUCH THE LEGEND",
    wanted: "APPROACH WITH QUESTIONABLE JUDGEMENT",
    space: "END TRANSMISSION / ARCHIVE SECURED",
    prophecy: "THUS SPOKE THE ARCHIVE",
    academic:
      "Source: LoreKeeper private correspondence archive. All words remain attributable to their original authors.",
    bug: "REPRODUCIBLE: YES · RESOLUTION: PRESERVE FOREVER",
    lyrics: "ALL WORDS PRESERVED / NO REMIX",
    card: "FIRST EDITION · FRIENDSHIP SERIES",
    tavern: "BY ORDER OF THE INNKEEPER",
  };
  return captions[style] ? (
    <div className={`edition-end end-${style}`}>{captions[style]}</div>
  ) : null;
}
