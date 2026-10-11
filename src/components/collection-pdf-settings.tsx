"use client";
import { editionGroups, readerEditions } from "../lib/reader-editions";
import { readerFonts } from "../lib/reader-fonts";
export function CollectionPdfSettings({ edition, font, onEdition, onFont, busy }: {
  edition: string;
  font: string;
  onEdition: (edition: string) => void;
  onFont: (font: string) => void;
  busy: boolean;
}) {
  const fonts = readerFonts(edition);
  const selectedFont = fonts.find(face => face.id === font) ?? fonts[0];
  return (
    <div className="pdf-export-settings">
      <label>
        <span>Display edition</span>
        <select value={edition} onChange={e => onEdition(e.target.value)} disabled={busy}>
          {editionGroups.map(group => (
            <optgroup key={group.name} label={group.name}>
              {group.ids.map(id => {
                const theme = readerEditions.find(t => t.id === id)!;
                return <option value={id} key={id}>{theme.name}</option>;
              })}
            </optgroup>
          ))}
        </select>
      </label>
      <label>
        <span>Reading font</span>
        <select value={font} onChange={e => onFont(e.target.value)} disabled={busy}>
          {fonts.map(face => <option key={face.id} value={face.id}>{face.name}</option>)}
        </select>
      </label>
      <p className="pdf-font-preview" style={{fontFamily:selectedFont.family}}>
        The archive remembers every word.
      </p>
      <p className="v-muted">A4 pages with a matching cover, contents and end page. Every story starts on a new page.</p>
    </div>
  );
}
