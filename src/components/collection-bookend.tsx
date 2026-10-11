import type { CSSProperties } from "react";
import { readerFonts, editionTitleFonts } from "../lib/reader-fonts";
import { pdfEditions } from "../lib/pdf-editions";
import { readerEditions } from "../lib/reader-editions";
import { ArtifactMasthead } from "./edition-artifacts";
import { HistoricalDecorations, RoyalCrest } from "./historical-art";
import { PirateCrest } from "./pirate-crest";
import { EpicSigil } from "./epic-sigil";
export function CollectionBookend({ name, count, style, font, end = false }: {
  name: string;
  count: number;
  style: string;
  font: string;
  end?: boolean;
}) {
  const theme = readerEditions.find(e => e.id === style)!;
  const edition = pdfEditions[style];
  const face = readerFonts(style).find(f => f.id === font) ?? readerFonts(style)[0];
  return <article className={`story-document theme-${style} pdf-print-document pdf-bookend`} data-font={face.id} style={{ "--reader-font": face.family, "--edition-title-font": editionTitleFonts[style], "--reading-size": "16px" } as CSSProperties}>
  {["manuscript", "decree"].includes(style) && <HistoricalDecorations kind={style} number={1}/>}
  <ArtifactMasthead style={style} reference={end ? "FINIS" : "VOL. I"} date="Collected archive" authors="The chroniclers"/>
  <div className="document-header"><span className="document-ornament" aria-hidden="true">{style === "captain" ? <PirateCrest /> : style === "decree" ? <RoyalCrest /> : style === "glorious" ? <EpicSigil kind="glorious"/> : theme.mark}</span><div className="pdf-volume-eyebrow">{end ? edition.end : edition.cover}</div><h2>{name}</h2></div>
  <div className="pdf-bookend-copy"><div className="pdf-volume-divider" aria-hidden="true">✦</div><p>{end ? edition.closing : edition.subtitle}</p><strong>{count} {count === 1 ? "story" : "stories"}</strong><small>{theme.name} · {face.name.replace(" · Original edition", "")}</small></div>
  <div className="pdf-volume-signature"><span>{end ? "The complete collection, preserved." : "LoreKeeper · Collection edition"}</span><small>{end ? "FINIS" : "VOLUME I"}</small></div>
 </article>;
}
