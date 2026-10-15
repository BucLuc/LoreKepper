import {EntryRemark} from "./entry-remark";
import {PagedDocument} from "./paged-document";
import {GalleryDocument} from "./gallery-document";
import type { CSSProperties } from "react";
import type { Exhibit, Message } from "../lib/archive";
import { withoutEmojis } from "../lib/emojis";
import { resolveReaderFont, editionTitleFonts } from "../lib/reader-fonts";
import { authorName, dateLabel, displayTime } from "../lib/format";
import { EditionMarkdown } from "./edition-markdown";
import { HistoricalDecorations, RoyalCrest } from "./historical-art";
import { EpicSigil } from "./epic-sigil";
import { PirateCrest } from "./pirate-crest";
import { CompassRose } from "./compass-rose";
import { Icon } from "./icon";
import {
  EditionHeader,
  EditionMessageLabel,
  EditionEnd,
} from "./extra-editions";
import {
  ArtifactMasthead,
  ArtifactStatement,
  ArtifactClosure,
} from "./edition-artifacts";
function MessageBody({
  message,
  plain,
  showEmojis,
  style,
}: {
  message: Message;
  plain: boolean;
  showEmojis: boolean;
  style: string;
}) {
  const displayText = (text: string) =>
    showEmojis ? text : withoutEmojis(text);
  const looksLikeArt =
    /[╔╗╚╝║═┌┐└┘│─]/.test(message.content) ||
    message.content.split("\n").filter((l) => /^\s{4,}[^\w\s]{2,}/.test(l))
      .length > 2;
  if (plain || looksLikeArt)
    return (
      <pre className={`message-text ${looksLikeArt ? "ascii-art" : ""}`}>
        {displayText(message.content)}
      </pre>
    );
  return (
    <EditionMarkdown
      style={style}
      text={displayText(message.presentation ?? message.content)}
    />
  );
}
import { normalizeDesign,  editionPalettes, type EditionDesign } from "../lib/edition-design";
type DocumentProps = {entry:Exhibit;style:string;theme:{mark:string;label:string};size?:number;plain?:boolean;showEmojis?:boolean;font?:string;design?:EditionDesign;ongoing?:boolean};
function sections({entry,style,theme,plain=false,showEmojis=true}:DocumentProps) {
 const reference=String(entry.number).padStart(3,"0");
 const isTranscript=["screenplay","incident","dossier","terminal"].includes(style);
 return {header:()=> (<><ArtifactMasthead
        style={style}
        reference={reference}
        date={entry.date}
        authors={entry.authors.join(" & ")}
      />
      <div className="document-header">
        <span className="document-ornament" aria-hidden="true">
          {style === "captain" ? (
            <PirateCrest />
          ) : style === "decree" ? (
            <RoyalCrest />
          ) : ["glorious", "prophecy", "poetry"].includes(style) ? (
            <EpicSigil kind={style as "glorious" | "prophecy" | "poetry"} />
          ) : (
            theme.mark
          )}
        </span>
        <div className="document-label">{theme.label}</div>
        {style === "newspaper" && (
          <div className="newspaper-edition">
            VOL. I · NO. {reference} <span>{entry.date.toUpperCase()}</span>{" "}
            PRICE: YOUR DIGNITY
          </div>
        )}
        {style === "dossier" && (
          <div className="classified-stamp">TOP SECRET // LORE EYES ONLY</div>
        )}
        {style === "terminal" && (
          <div className="terminal-command">
            $ lorekeeper read --exhibit {reference}
            <br />
            <span>[OK] Archive retrieved. Integrity intact.</span>
          </div>
        )}
        <h2>{showEmojis ? entry.title : withoutEmojis(entry.title)}</h2>
        {entry.messages.length===1 ? <EntryRemark entry={entry} showEmojis={showEmojis}/> : <div className="document-meta">
          {style === "decree"
            ? "ISSUED IN THE NAME OF"
            : style === "screenplay"
              ? "WRITTEN BY"
              : style === "incident"
                ? "PARTIES ON RECORD"
                : "PRESERVED WORDS OF"}{" "}
          {entry.authors.join(" & ").toUpperCase()}
        </div>}
        {["incident", "dossier", "letter"].includes(style) && (
          <dl className="document-fields">
            <div>
              <dt>{style === "letter" ? "Date" : "Reference"}</dt>
              <dd>{style === "letter" ? entry.date : `LK-${reference}`}</dd>
            </div>
            <div>
              <dt>{style === "letter" ? "From" : "Recorded"}</dt>
              <dd>
                {style === "letter" ? entry.authors.join(" & ") : entry.date}
              </dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                {{ whatsapp: "WhatsApp", teams: "Microsoft Teams" }[
                  entry.source
                ] ?? entry.source}
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
      {style === "captain" && (
        <>
          <div className="captain-register">
            <span>SHIP’S JOURNAL · No. {reference}</span>
            <span>{entry.date}</span>
            <span>VESSEL: THE LOREKEEPER</span>
          </div>
          <div className="captain-chart" aria-hidden="true">
            <CompassRose />
          </div>
        </>
      )}
</>),body:()=> (<><div className="document-body">
        {entry.messages.map((message, index) => (
          <section
            key={message.id}
            className={`story-message ${(message.userId ? message.author : authorName(message.author)) === "Liri" ? "by-liri" : "by-luc"}`}
          >
            <ArtifactStatement
              style={style}
              index={index}
              author={
                message.userId ? message.author : authorName(message.author)
              }
            />
            <EditionMessageLabel style={style} index={index} />
            {style === "captain" && (
              <div className="captain-entry-label">
                <Icon name="anchor" /> LOG ENTRY{" "}
                {String(index + 1).padStart(2, "0")}
              </div>
            )}
            {entry.messages.length > 1 && (
              <div className="message-attribution">
                {style === "card" && (
                  <span className="collectible-portrait" aria-hidden="true">
                    {
                      (message.userId
                        ? message.author
                        : authorName(message.author))[0]
                    }
                  </span>
                )}
                {style === "social" && (
                  <span className="social-avatar" aria-hidden="true">
                    {
                      (message.userId
                        ? message.author
                        : authorName(message.author))[0]
                    }
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
                  {message.userId ? message.author : authorName(message.author)}
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
            )}
            <MessageBody
              message={message}
              style={style}
              plain={plain}
              showEmojis={showEmojis}
            />
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
</>),footer:()=> (<><ArtifactClosure
        style={style}
        reference={reference}
        authors={entry.authors.join(" & ")}
        date={entry.date}
      />
      <div className="document-footer">
        <EditionEnd style={style} />
        <span aria-hidden="true">
          {style === "captain" ? (
            <Icon name="anchor" />
          ) : style === "decree" ? (
            "♛"
          ) : style === "terminal" ? (
            "EOF"
          ) : (
            "✦"
          )}
        </span>
        <small>
          {style === "captain"
            ? "LOG CLOSED. MAY THE TALE OUTLIVE THE TIDE."
            : style === "screenplay"
              ? "FADE OUT. THE NONSENSE ENDURES."
              : style === "incident"
                ? "END OF RECORD · RETAIN IN ARCHIVE"
                : style === "dossier"
                  ? "DOCUMENT ENDS · RETURN TO ARCHIVE"
                  : style === "decree"
                    ? "SO RECORDED. SO IMMORTALISED."
                    : "HERE ENDS THE RECORD. THE LEGEND CONTINUES."}
        </small>
      </div>
</>)};
}
export function StoryDocument(props:DocumentProps) {
 if(props.style.startsWith("gallery-")) return <GalleryDocument {...props}/>;
 const {entry,style,size=18,plain=false,design}=props;
 const font=props.font ?? design?.font ?? "default";
 const chosen=normalizeDesign(design ? {...design,font} : undefined,style);
 const face=resolveReaderFont(style,font);
 const backgroundChanged=chosen.background!==style;
 const surface=chosen.background;
 const palette=editionPalettes[surface];
 const original=sections(props);
 const article=<article className={`story-document ${"theme-"+style} ${backgroundChanged?"edition-resurfaced":""} ${plain?"plain-mode":""}`}
 data-conversation={entry.messages.length>1?"on":"off"} data-cover={chosen.showCover?"on":"off"} data-border={chosen.border?"on":"off"} data-artwork={chosen.artwork?"on":"off"} data-font={face.id} data-background={surface} data-header={chosen.header} data-body={chosen.body} data-footer={chosen.footer} data-columns={chosen.columns} data-initial={chosen.initial} data-numbering={chosen.numbering}
 style={{"--reading-size":`${size}px`,"--reader-font":face.family,"--edition-title-font":font==="default"?editionTitleFonts[style]:face.family,"--edition-ink":palette.ink,"--edition-accent":palette.accent,"--edition-surface":palette.surface,"--edition-panel":palette.panel,"--edition-rule":`color-mix(in srgb, ${palette.ink} 24%, transparent)`} as CSSProperties}>
 {["manuscript","decree"].includes(style)&&<HistoricalDecorations kind={style} number={entry.number}/>}
 {chosen.showCover ? original.header() : <div className="document-header"><h2>{entry.title}</h2><EntryRemark entry={entry} showEmojis={props.showEmojis}/></div>}
 {original.body()}
 {!props.ongoing && original.footer()}
 </article>;
 if(!chosen.pages) return article;
 const layoutKey=[entry.id,entry.title,...entry.messages.map(m=>m.presentation??m.content),style,size,plain,props.showEmojis,props.ongoing,face.id,JSON.stringify(chosen)].join("\u0000");
 return <PagedDocument layoutKey={layoutKey}>{article}</PagedDocument>;
}


