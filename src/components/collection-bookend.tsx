import {GalleryBookend} from "./gallery-bookend";
import type { CSSProperties } from "react";
import { resolveReaderFont, editionTitleFonts } from "../lib/reader-fonts";
import { pdfEditions, pdfPaperColors } from "../lib/pdf-editions";
import { readerEditions } from "../lib/reader-editions";
import { ArtifactMasthead } from "./edition-artifacts";
import { HistoricalDecorations, RoyalCrest } from "./historical-art";
import { PirateCrest } from "./pirate-crest";
import { BookendIllumination } from "./bookend-illumination";
import { editionPalettes } from "../lib/edition-design";
import { EpicSigil } from "./epic-sigil";
export function CollectionBookend({ name, count, style, font, end = false, background=style, fontPreset=style }: {
  name: string;
  count: number;
  style: string;
  font: string;
  end?: boolean;
  background?: string;
  fontPreset?: string;
}) {
  if(style.startsWith("gallery-"))return <GalleryBookend name={name} count={count} style={style} font={font} end={end} background={background} fontPreset={fontPreset}/>;
  const theme = readerEditions.find(e => e.id === style)!;
  const edition = pdfEditions[style];
  const face = resolveReaderFont(fontPreset,font);
  const mixed=background!==style;
  const palette=editionPalettes[background];
  const contents=<><ArtifactMasthead style={style} reference={end ? "FINIS" : "VOL. I"} date="Collected archive" authors="The chroniclers"/>
  <div className="pdf-bookend-art" aria-hidden="true"><BookendIllumination style={style} end={end} mark={theme.mark}/></div>
  <div className="document-header"><span className="document-ornament" aria-hidden="true">{style === "captain" ? <PirateCrest /> : style === "decree" ? <RoyalCrest /> : style === "glorious" ? <EpicSigil kind="glorious"/> : theme.mark}</span><div className="pdf-volume-eyebrow">{end ? edition.end : edition.cover}</div><h2>{name}</h2></div>
  <div className="pdf-bookend-copy"><div className="pdf-volume-divider" aria-hidden="true">✦</div><p>{end ? edition.closing : edition.subtitle}</p><strong>{count} {count === 1 ? "story" : "stories"}</strong><small>{theme.name} · {face.name.replace(" · Original edition", "")}</small></div>
  <div className="pdf-volume-signature"><span>{end ? "The complete collection, preserved." : "LoreKeeper · Collection edition"}</span><small>{end ? "FINIS" : "VOLUME I"}</small></div></>;
  return <article className={`story-document ${"theme-"+style} ${mixed?"edition-resurfaced":""} pdf-print-document pdf-bookend ${end ? "pdf-bookend-end" : "pdf-bookend-cover"}`} data-background={background} data-font={face.id} style={{ "--reader-font": face.family, "--edition-title-font": font==="default"?editionTitleFonts[style]:face.family, "--reading-size": "16px", "--pdf-page-bg": pdfPaperColors[background], backgroundColor: pdfPaperColors[background], "--edition-ink":palette.ink,"--edition-accent":palette.accent,"--edition-surface":palette.surface,"--edition-panel":palette.panel,"--edition-rule":`color-mix(in srgb, ${palette.ink} 24%, transparent)`, ...(mixed?{"--plate-gold":palette.ink,"--plate-red":palette.accent,"--plate-blue":palette.panel}:{}) } as CSSProperties}>
  {["manuscript", "decree"].includes(style) && <HistoricalDecorations kind={style} number={1}/>}
  {contents}
 </article>;
}
