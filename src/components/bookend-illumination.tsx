import { PirateCrest } from "./pirate-crest";
import { RoyalCrest } from "./historical-art";
import { EpicSigil } from "./epic-sigil";
const historical = new Set(["manuscript", "ancientcodex", "scroll", "prophecy", "poetry"]);

/** Vector frontispiece: remains sharp in both thumbnails and full A4 exports. */
export function BookendIllumination({style, end, mark}: {style:string; end:boolean; mark:string}) {
  if (["captain", "decree", "glorious"].includes(style)) return <div className="pdf-crest-frontispiece">{style === "captain" ? <PirateCrest/> : style === "decree" ? <RoyalCrest/> : <EpicSigil kind="glorious"/>}<i>{end ? "The record endures" : "A treasury of stories"}</i></div>;
  if (!historical.has(style)) return <div className={`pdf-edition-emblem pdf-emblem-${style}`}><span>{mark}</span><i>{end ? "ARCHIVE COMPLETE" : "COLLECTION EDITION"}</i></div>;
  return <svg className="pdf-illuminated-plate" viewBox="0 0 400 360" fill="none" aria-hidden="true">
    <path d="M35 320V150Q35 32 200 20Q365 32 365 150V320" stroke="var(--plate-gold)" strokeWidth="3"/>
    <path d="M47 310V150Q47 47 200 33Q353 47 353 150V310" stroke="var(--plate-red)"/>
    {Array.from({length:24},(_,i)=><g key={i} transform={`translate(200 190) rotate(${i*15})`}>
      <path d="M0 -140C-19 -122 -15 -107 0 -96C15 -107 19 -122 0 -140Z" fill={i%2 ? "var(--plate-blue)" : "var(--plate-red)"} stroke="var(--plate-gold)" strokeWidth="1.6"/>
      <circle cy="-149" r="3" fill="var(--plate-gold)"/>
      <path d="M0 -158V-163" stroke="var(--plate-gold)"/>
    </g>)}
    <circle cx="200" cy="190" r="91" fill="var(--plate-blue)" stroke="var(--plate-gold)" strokeWidth="4"/>
    <circle cx="200" cy="190" r="82" stroke="var(--plate-gold)"/>
    {Array.from({length:12},(_,i)=><path key={i} d="M0 -74l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="var(--plate-gold)" transform={`translate(200 190) rotate(${i*30})`}/>)}
    {end ? <g stroke="var(--plate-gold)" strokeWidth="3">
      <path d="M172 151Q200 124 228 151V227Q200 242 172 227Z" fill="var(--plate-red)"/>
      <path d="M183 159H217M183 169H217M183 179H210M183 215H217"/>
      <path d="M193 191l7 7 14-15" strokeWidth="4"/>
    </g> : <g stroke="var(--plate-gold)" strokeWidth="3" strokeLinejoin="round">
      <path d="M144 156Q172 143 200 160Q228 143 256 156V228Q228 214 200 231Q172 214 144 228Z" fill="var(--plate-red)"/>
      <path d="M200 161V231M155 169Q174 164 188 174M155 183Q174 178 188 188M155 197Q174 192 188 202M212 174Q226 164 245 169M212 188Q226 178 245 183M212 202Q226 192 245 197" strokeWidth="2"/>
      <path d="M140 233Q170 219 200 237Q230 219 260 233"/>
    </g>}
    <g stroke="var(--plate-red)" strokeWidth="1.5">
      <path d="M25 325Q85 265 115 320T200 328T285 320T375 325M60 336Q93 294 117 330M340 336Q307 294 283 330"/>
      <path d="M55 80Q90 65 76 43Q58 32 52 50Q58 66 78 53M345 80Q310 65 324 43Q342 32 348 50Q342 66 322 53"/>
    </g>
    <g fill="var(--plate-gold)"><path d="M200 4l4 9 9 4-9 4-4 9-4-9-9-4 9-4Z"/><circle cx="200" cy="338" r="4"/><circle cx="113" cy="327" r="3"/><circle cx="287" cy="327" r="3"/></g>
  </svg>;
}
