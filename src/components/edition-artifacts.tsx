import { OldCodexOpening, OldCodexClosing } from "./old-codex";
import type { ReactNode } from "react";

type ArtifactProps = {
  style: string;
  reference: string;
  date: string;
  authors: string;
};
function RunningHead({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="artifact-running-head">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}
function ArchiveSeal({ label = "LK" }: { label?: string }) {
  return (
    <div className="artifact-seal" aria-hidden="true">
      <svg viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="52" stroke="currentColor" strokeWidth="2" />
        <circle cx="60" cy="60" r="44" stroke="currentColor" />
        {Array.from({ length: 24 }, (_, i) => (
          <path
            key={i}
            d="M60 3 63 10 60 14 57 10Z"
            fill="currentColor"
            transform={`rotate(${i * 15} 60 60)`}
          />
        ))}
        <path
          d="M32 49c9-4 19-3 28 2 9-5 19-6 28-2v29c-10-3-20-2-28 3-8-5-18-6-28-3ZM60 51v30M40 58l12 2m-12 7 12 2m16-9 12-2m-12 11 12-2"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="m46 34 7 3 7-10 7 10 7-3-2 10H48Z" fill="currentColor" />
      </svg>
      <span>{label}</span>
    </div>
  );
}
/** Acanthus, gold bezants, berries and grotesques, kept outside the reading area. */
function Illumination() {
  return (
    <div className="codex-illumination" aria-hidden="true">
      {["left", "right"].map((side) => (
        <div key={side} className={`codex-vine vine-${side}`} />
      ))}
      <svg className="codex-bestiary" viewBox="0 0 300 90" fill="none">
        <path
          d="M20 63c40-36 67-50 95-18l-17 7c-27-17-35 9-21 19l-17 5 8-14-26 12-22-11Zm260 0c-40-36-67-50-95-18l17 7c27-17 35 9 21 19l17 5-8-14 26 12 22-11Z"
          fill="#466351"
          stroke="#72552b"
        />
        <path
          d="M93 46 78 19l30 19-15 8Zm114 0 15-27-30 19 15 8Z"
          fill="#973b35"
          stroke="#72552b"
        />
        <path
          d="M116 49c30 6 37 31 34 31-3 0 4-25 34-31M136 39l14-24 14 24-14 24Z"
          stroke="#af8730"
          strokeWidth="3"
        />
        <circle cx="60" cy="54" r="2" fill="#302616" />
        <circle cx="240" cy="54" r="2" fill="#302616" />
      </svg>
    </div>
  );
}
function Instrument({ kind }: { kind: "radar" | "star" | "mountain" }) {
  return (
    <svg
      className={`artifact-instrument instrument-${kind}`}
      viewBox="0 0 600 210"
      fill="none"
      aria-hidden="true"
    >
      {kind === "radar" ? (
        <>
          {[25, 50, 75, 94].map((r) => (
            <circle
              key={r}
              cx="108"
              cy="105"
              r={r}
              stroke="currentColor"
              strokeOpacity=".4"
            />
          ))}
          <path
            d="M14 105h188M108 11v188M41 38l134 134M41 172 175 38"
            stroke="currentColor"
            strokeOpacity=".2"
          />
          <path
            d="M108 105 177 46a94 94 0 0 1 25 59Z"
            fill="currentColor"
            fillOpacity=".14"
          />
          <circle cx="158" cy="68" r="4" fill="currentColor" />
          <circle cx="70" cy="139" r="3" fill="currentColor" />
          <path
            d="M250 145h324M250 165h324M250 185h324M250 105l20-6 15 12 15-68 15 106 15-45 30-13 30 14 20-40 20 33 40-5 20 14 30-4"
            stroke="currentColor"
          />
          {Array.from({ length: 12 }, (_, i) => (
            <rect
              key={i}
              x={254 + i * 27}
              y={22}
              width="17"
              height={12 + ((i * 17) % 48)}
              fill="currentColor"
              opacity={0.15 + (i % 4) * 0.15}
            />
          ))}
        </>
      ) : kind === "star" ? (
        <>
          <circle cx="300" cy="108" r="90" stroke="currentColor" />
          <circle
            cx="300"
            cy="108"
            r="73"
            stroke="currentColor"
            strokeOpacity=".5"
          />
          <path
            d="m300 13 25 61 70 34-70 25-25 65-25-65-70-25 70-34Z"
            stroke="currentColor"
          />
          <path d="m300 30 47 144H223Z" stroke="currentColor" />
          {Array.from({ length: 16 }, (_, i) => (
            <circle
              key={i}
              cx={20 + i * 37}
              cy={20 + ((i * 47) % 170)}
              r={i % 3 === 0 ? 2 : 1}
              fill="currentColor"
            />
          ))}
          <path
            d="M8 108h186m212 0h186"
            stroke="currentColor"
            strokeOpacity=".4"
          />
        </>
      ) : (
        <>
          <circle cx="440" cy="65" r="38" fill="currentColor" opacity=".25" />
          <path
            d="M0 170 90 57 157 138 235 22 352 158 419 91 520 150 600 84v126H0Z"
            fill="currentColor"
            opacity=".15"
          />
          <path
            d="m0 170 90-113 67 81 78-116 117 136 67-67 101 59 80-66M205 60l30-38 33 42-25-8-14 19Z"
            stroke="currentColor"
            strokeOpacity=".5"
          />
          <path
            d="M0 192c100-40 160 40 260-2s210 30 340-13"
            stroke="currentColor"
          />
        </>
      )}
    </svg>
  );
}
export function ArtifactMasthead({
  style,
  reference,
  date,
  authors,
}: ArtifactProps) {
  if (style === "ancientcodex")
    return <OldCodexOpening reference={reference} />;
  switch (style) {
    case "manuscript":
      return (
        <>
          <Illumination />
          <RunningHead
            left="EX LIBRIS · AMICORUM"
            right={`FOLIO ${reference} · RECTO`}
          />
          <div className="codex-rubric">
            <span>❧</span>
            <div>
              Incipit chronica<strong>The Book of Remarkable Deeds</strong>
            </div>
            <span>❧</span>
          </div>
        </>
      );
    case "scroll":
      return (
        <>
          <RunningHead
            left="ARCHAEOLOGICAL ARCHIVE"
            right={`FRAGMENT ${reference}`}
          />
          <div className="scroll-cartouche">
            <ArchiveSeal label="I" />
            <span>
              THE RECOVERED TABLETS
              <br />
              <small>Translated from the surviving record</small>
            </span>
          </div>
        </>
      );
    case "decree":
      return (
        <>
          <RunningHead
            left="THE ROYAL CHANCERY"
            right={`CHARTER № ${reference}`}
          />
          <div className="royal-protocol">
            LET IT BE KNOWN TO ALL WHO READ THESE WORDS
          </div>
        </>
      );
    case "glorious":
      return (
        <>
          <RunningHead
            left="THE HALL OF IMMORTAL MEMORY"
            right={`CHRONICLE ${reference}`}
          />
          <div className="epic-pediment">
            ✦ &nbsp; AD GLORIAM AETERNAM &nbsp; ✦
          </div>
        </>
      );
    case "poetry":
      return (
        <>
          <RunningHead
            left="THE COLLECTED VERSES"
            right={`CANTO ${reference}`}
          />
          <div className="poetry-frontispiece">
            <span>❦</span>
            <i>A fragment, kept for eternity.</i>
          </div>
        </>
      );
    case "prophecy":
      return (
        <>
          <RunningHead
            left="THE CELESTIAL ARCHIVE"
            right={`VISION ${reference}`}
          />
          <Instrument kind="star" />
        </>
      );
    case "captain":
      return (
        <>
          <RunningHead
            left="ADMIRALTY · PRIVATE JOURNAL"
            right={`VOYAGE ${reference}`}
          />
          <div className="logbook-binding" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </>
      );
    case "tavern":
      return (
        <>
          <div className="notice-nails" aria-hidden="true">
            <i />
            <i />
          </div>
          <div className="tavern-sign">
            THE CROOKED QUILL
            <small>Good ale. Bad decisions. News from the road.</small>
          </div>
          <RunningHead left="HEAR YE · HEAR YE" right={`NOTICE ${reference}`} />
        </>
      );
    case "wanted":
      return (
        <>
          <RunningHead
            left="OFFICE OF THE SHERIFF"
            right={`BULLETIN ${reference}`}
          />
          <div className="wanted-banner">
            WANTED<small>DEAD SERIOUS · ALIVE IN THE ARCHIVE</small>
          </div>
          <div className="wanted-stars" aria-hidden="true">
            ★ &nbsp; ★ &nbsp; ★
          </div>
        </>
      );
    case "light":
      return (
        <RunningHead
          left="LOREKEEPER / READING EDITION"
          right={`№ ${reference}`}
        />
      );
    case "dark":
      return (
        <RunningHead
          left="LOREKEEPER / NIGHT EDITION"
          right={`№ ${reference}`}
        />
      );
    case "newspaper":
      return (
        <>
          <RunningHead
            left="INDEPENDENT · IRREVERENT · IMMORTAL"
            right="ESTABLISHED FOR POSTERITY"
          />
          <div className="gazette-masthead">The Lorekeeper Gazette</div>
          <div className="gazette-strip">
            <span>VOL. I &nbsp; № {reference}</span>
            <span>{date}</span>
            <span>THE PRIVATE EDITION</span>
          </div>
        </>
      );
    case "social":
      return (
        <>
          <div className="feed-navigation">
            <strong>
              lore<span>social</span>
            </strong>
            <span>THE ARCHIVED FEED</span>
            <span className="feed-profile">LK</span>
          </div>
          <RunningHead
            left="Following · Preserved"
            right={`POST ${reference}`}
          />
        </>
      );
    case "news":
      return (
        <>
          <div className="broadcast-navigation">
            <strong>
              LK<span>24</span>
            </strong>
            <span>WORLD · CULTURE · THE ARCHIVE</span>
            <b>SPECIAL COVERAGE</b>
          </div>
          <div className="broadcast-ticker">
            <b>BREAKING</b>
            <span>Words worth remembering. A record that endures.</span>
          </div>
        </>
      );
    case "incident":
      return (
        <>
          <div className="form-letterhead">
            <div className="form-brand">
              <span>LK</span>
              <div>
                LOREKEEPER<strong>People & Culture</strong>
              </div>
            </div>
            <div className="form-control">
              FORM LK–04
              <br />
              REVISION 01
              <br />
              INTERNAL USE ONLY
            </div>
          </div>
          <div className="form-title">
            <b>INTERNAL COMPLAINT</b>
            <span>& INCIDENT STATEMENT</span>
          </div>
          <div className="form-instructions">
            Complete record · Retain with supporting correspondence ·
            Confidential
          </div>
          <RunningHead
            left={`CASE REFERENCE: LK–${reference}`}
            right="01 / COMPLAINT DETAILS"
          />
        </>
      );
    case "dossier":
      return (
        <>
          <div className="file-tab">DIRECTORATE / ARCHIVE {reference}</div>
          <div className="classification-band">
            TOP SECRET <span>{"//"}</span> EYES ONLY <span>{"//"}</span> COPY 01
          </div>
          <div className="dossier-control">
            <ArchiveSeal label="D.Q.I." />
            <div>
              DIRECTORATE OF
              <br />
              <strong>QUESTIONABLE INTELLIGENCE</strong>
              <small>RESTRICTED DISTRIBUTION · PRIMARY SOURCE FILE</small>
            </div>
            <span className="paperclip" aria-hidden="true" />
          </div>
        </>
      );
    case "letter":
      return (
        <>
          <div className="correspondence-letterhead">
            <ArchiveSeal />
            <strong>LOREKEEPER</strong>
            <span>THE PRIVATE CORRESPONDENCE OFFICE</span>
          </div>
          <RunningHead left="PERSONAL & CONFIDENTIAL" right={date} />
        </>
      );
    case "terminal":
      return (
        <>
          <div className="console-titlebar">
            <span className="window-lights" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>archive@lorekeeper: ~/chronicles</span>
            <span>bash</span>
          </div>
          <div className="console-boot">
            <span>LOREKEEPER ARCHIVE SYSTEM</span>
            <small>READ-ONLY SESSION / UTF-8 / RECORD {reference}</small>
            <div>Connected to the archive. Original text follows.</div>
          </div>
        </>
      );
    case "space":
      return (
        <>
          <div className="relay-topbar">
            <strong>LK // DEEP SPACE RELAY</strong>
            <span>INCOMING SIGNAL</span>
          </div>
          <Instrument kind="radar" />
          <div className="relay-readouts">
            <span>
              CHANNEL <b>LK-{reference}</b>
            </span>
            <span>
              PAYLOAD <b>TEXT / UTF-8</b>
            </span>
            <span>
              ARCHIVE <b>READ ONLY</b>
            </span>
          </div>
        </>
      );
    case "bug":
      return (
        <>
          <div className="issue-navigation">
            <span className="issue-logo">⌘</span>
            <strong>LoreKeeper</strong>
            <span>/ Archive / Issues</span>
          </div>
          <div className="issue-toolbar">
            <span>LORE-{reference}</span>
            <b>ARCHIVED</b>
            <span>Primary source record</span>
          </div>
        </>
      );
    case "screenplay":
      return (
        <>
          <RunningHead left="LOREKEEPER PICTURES" right="ARCHIVAL DRAFT" />
          <div className="script-cover">
            <span>A SCREENPLAY</span>
            <strong>FROM THE ORIGINAL EXCHANGE</strong>
            <small>Written by {authors}</small>
          </div>
        </>
      );
    case "museum":
      return (
        <>
          <div className="gallery-wordmark">
            <span>LK</span>
            <div>
              THE MUSEUM OF<strong>QUESTIONABLE WISDOM</strong>
            </div>
          </div>
          <RunningHead
            left="THE PERMANENT COLLECTION"
            right={`ACCESSION LK.${reference}`}
          />
        </>
      );
    case "court":
      return (
        <>
          <div className="court-letterhead">
            <ArchiveSeal label="JUSTITIA" />
            <div>
              IN THE HIGH COURT<strong>OF FRIENDSHIP</strong>
              <span>CERTIFIED TRANSCRIPT OF PROCEEDINGS</span>
            </div>
          </div>
          <RunningHead
            left={`CASE NO. LK–${reference}`}
            right="CLERK’S ARCHIVAL COPY"
          />
        </>
      );
    case "academic":
      return (
        <>
          <div className="journal-masthead">
            <span>JOURNAL OF</span>
            <strong>Applied Nonsense</strong>
            <small>PRIMARY SOURCES · PRIVATE CORRESPONDENCE</small>
          </div>
          <RunningHead
            left={`VOLUME I · ARTICLE ${reference}`}
            right="ARCHIVAL EDITION"
          />
        </>
      );
    case "card":
      return (
        <>
          <div className="collectible-topline">
            <strong>LOREKEEPER</strong>
            <span>✦ FIRST EDITION ✦</span>
            <b>№ {reference}</b>
          </div>
          <div className="collectible-art">
            <Instrument kind="mountain" />
            <span>THE FRIENDSHIP CHRONICLES</span>
          </div>
        </>
      );
    case "lyrics":
      return (
        <>
          <RunningHead
            left="LOREKEEPER RECORDS"
            right={`SIDE A · TRACK ${reference}`}
          />
          <div className="record-sleeve">
            <div className="record-disc" aria-hidden="true">
              <i>LK</i>
            </div>
            <div>
              <span>THE ORIGINAL RECORDINGS</span>
              <strong>
                Words.
                <br />
                On repeat.
              </strong>
              <small>LYRIC SHEET / ARCHIVAL PRESSING</small>
            </div>
          </div>
        </>
      );
    default:
      return null;
  }
}
export function ArtifactStatement({
  style,
  index,
  author,
}: {
  style: string;
  index: number;
  author: string;
}) {
  const number = String(index + 1).padStart(2, "0");
  if (style === "incident")
    return (
      <div className="form-section-bar">
        <b>02.{number}</b>
        <span>STATEMENT OF EVENTS</span>
        <small>Recorded by {author}</small>
      </div>
    );
  if (style === "dossier")
    return (
      <div className="file-evidence-bar">
        <span>EXHIBIT {number}</span>
        <strong>SOURCE / {author}</strong>
        <span>UNALTERED RECORD</span>
      </div>
    );
  if (style === "court")
    return (
      <div className="testimony-heading">
        <span>ON THE RECORD</span>
        <strong>{author}</strong>
        <span>STATEMENT {number}</span>
      </div>
    );
  if (style === "screenplay")
    return (
      <div className="script-scene">
        {number} &nbsp; INT. THE ARCHIVE — PRESERVED EXCHANGE &nbsp; {number}
      </div>
    );
  if (style === "social")
    return (
      <div className="feed-author">
        <span>{author.slice(0, 1)}</span>
        <div>
          <strong>{author}</strong>
          <small>From the private archive</small>
        </div>
        <b aria-hidden="true">···</b>
      </div>
    );
  return null;
}
export function ArtifactClosure({
  style,
  reference,
  authors,
  date,
}: ArtifactProps) {
  if (style === "incident")
    return (
      <div className="form-disposition">
        <div className="form-section-bar">
          <b>03</b>
          <span>REVIEW & DISPOSITION</span>
        </div>
        <div className="form-routing">
          <span>
            Reviewer <i />
          </span>
          <span>
            Review date <i />
          </span>
          <span>
            Disposition <i />
          </span>
        </div>
        <div className="form-signoff">
          <span>
            Supporting record attached
            <br />
            <b>
              LK–{reference} · {date}
            </b>
          </span>
          <strong>
            ARCHIVED
            <br />
            COPY
          </strong>
        </div>
      </div>
    );
  if (style === "decree")
    return (
      <div className="royal-signature">
        <span>
          By the hand of the chronicler<i>{authors}</i>
        </span>
        <div className="wax-seal">
          <ArchiveSeal label="LK" />
        </div>
        <span>
          Given under our seal<i>{date}</i>
        </span>
      </div>
    );
  if (style === "ancientcodex")
    return <OldCodexClosing reference={reference} authors={authors} />;
  if (style === "manuscript")
    return (
      <div className="codex-colophon">
        <span>❦</span>
        <i>Explicit chronica. Laus amicitiae.</i>
        <small>FOLIO {reference} · FINIS</small>
      </div>
    );
  if (style === "letter")
    return (
      <div className="letter-signature">
        <span>Preserved correspondence of</span>
        <strong>{authors}</strong>
        <div className="postal-cancel" aria-hidden="true">
          LOREKEEPER
          <br />
          PRIVATE ARCHIVE
        </div>
      </div>
    );
  if (style === "space")
    return (
      <div className="relay-checksum">
        <span>▮▮▮▮▮▮▮▮▮▮</span>
        <b>END OF TRANSMISSION</b>
        <small>PAYLOAD PRESERVED / LK-{reference}</small>
      </div>
    );
  if (style === "terminal")
    return (
      <div className="console-prompt">
        archive@lorekeeper <b>~</b> ${" "}
        <span className="console-cursor" aria-hidden="true">
          ▊
        </span>
      </div>
    );
  if (style === "dossier")
    return (
      <div className="dossier-bottom">
        <span>CLASSIFICATION REMAINS IN EFFECT</span>
        <span>FILE LK–{reference} / END OF RECORD</span>
      </div>
    );
  if (style === "screenplay")
    return (
      <div className="script-end">
        FADE OUT.<strong>THE END</strong>
      </div>
    );
  if (style === "wanted")
    return (
      <div className="sheriff-signature">
        <ArchiveSeal label="SHERIFF" />
        <span>
          BY ORDER OF THE SHERIFF<strong>THE PRIVATE ARCHIVE</strong>
        </span>
      </div>
    );
  if (style === "card")
    return (
      <div className="card-bottomline">
        <span>✦ LEGENDARY · FRIENDSHIP SERIES</span>
        <span>{reference} / LK</span>
      </div>
    );
  return null;
}
