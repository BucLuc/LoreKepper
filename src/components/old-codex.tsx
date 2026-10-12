function CodexBorder() {
 return <div className="codex-epic-border old-codex-frame" aria-hidden="true"><div className="codex-border-vine vine-left"/><div className="codex-border-vine vine-right"/>{["nw","ne","sw","se"].map(corner=><svg key={corner} className={"codex-border-corner corner-"+corner} viewBox="0 0 110 110" fill="none"><path d="M8 104V8h96M15 95V15h80" stroke="#90733d" strokeWidth="2"/><path d="M24 24h54v54H24Z" stroke="#753c29" strokeWidth="5"/><path d="m51 14 37 37-37 37-37-37Z" stroke="#b19350" strokeWidth="5"/><path d="M24 42v18m18 18h18m18-18V42M60 24H42" stroke="#dbc493" strokeWidth="2"/><path d="m51 34 17 17-17 17-17-17Z" stroke="#753c29" strokeWidth="2"/><path d="M51 42v18m-9-9h18" stroke="#957134" strokeWidth="2"/><path d="M25 90h60m5-65v60" stroke="#8e623d"/><path d="m94 92 5 5-5 5-5-5Z" fill="#753c29"/></svg>)}</div>;
}
function CodexEmblem() {
 return <svg className="codex-grand-headpiece" viewBox="0 0 600 145" fill="none" aria-hidden="true">
 <g stroke="currentColor" strokeWidth="1.5"><path d="M20 83c42-51 86 46 125-7s58-26 83-6M580 83c-42-51-86 46-125-7s-58-26-83-6M27 100c61-42 83 21 124-7s55-15 74-7M573 100c-61-42-83 21-124-7s-55-15-74-7"/>
 <path d="M41 71c-4-38 43-36 34-7-6 20-35 9-21-6M559 71c4-38-43-36-34-7 6 20 35 9 21-6M118 73c-24-53 33-53 23-26-7 18-22 8-15 0M482 73c24-53-33-53-23-26 7 18 22 8 15 0"/>
 <circle cx="300" cy="70" r="55"/><circle cx="300" cy="70" r="49"/><path d="M300 14c22 12 43 34 56 56-13 22-34 44-56 56-22-12-43-34-56-56 13-22 34-44 56-56Z"/>
 <path d="M279 47c-19-11-35 13-21 26-14 18 9 35 23 19 14 18 39 18 38 0 15 16 37-2 23-19 14-15-3-37-21-26-7-20-35-20-42 0Z"/>
 <path d="M280 59v28c8-5 14-5 20 0 6-5 12-5 20 0V59c-9-5-14-5-20 0-6-5-12-5-20 0Zm20 0v28M285 65l10 1m-10 5 10 1m10-6 10-1m-10 7 10-1"/>
 <path d="M94 113h124m164 0h124M64 117h145m182 0h145" opacity=".5"/></g>
 <g fill="currentColor"><path d="m300 0 4 8-4 8-4-8Zm0 126 4 8-4 8-4-8ZM236 65l6 5-6 5-6-5Zm128 0 6 5-6 5-6-5Z"/><circle cx="192" cy="52" r="3"/><circle cx="408" cy="52" r="3"/></g>
 </svg>;
}
function PenFlourish({ closing = false }: { closing?: boolean }) {
  return <svg className={`scribal-flourish ${closing ? "flourish-closing" : ""}`} viewBox="0 0 360 74" fill="none" aria-hidden="true">
    <path d="M15 44c45-35 80 37 111-3 17-22-29-47-34-24-4 19 39 18 60 7m193 20c-45-35-80 37-111-3-17-22 29-47 34-24 4 19-39 18-60 7" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M26 50c35-15 45 20 80 3m228-3c-35-15-45 20-80 3M59 41c10-21 24-21 37-13M301 41c-10-21-24-21-37-13M138 42l22-10m62 10-22-10M180 12v48m-18-24h36" stroke="currentColor"/>
    <path d="m180 10 5 10-5 7-5-7Zm0 49 4-8-4-6-4 6Z" fill="currentColor"/>
    <path d="m160 36 8 4-8 4m40-8-8 4 8 4" stroke="currentColor"/>
  </svg>;
}
function MarginalDragon() {
  return <svg className="scribal-dragon" viewBox="0 0 90 170" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M34 147c37-5 43-36 20-59-16-16-36-40-22-53 10-9 31 0 29 12-1 10-19 9-17-1M40 143c-24 6-37-9-25-20 11-10 29 4 16 8M49 87c22-12 34-3 32 13-9-3-16 1-23 10M36 65 14 38l4 29 23 10M18 55l15 8M23 44l11 19M40 31l1-14 9 14m8 5 11-5-5 13-12 5M60 64l14 4-15 4M58 103l-6 17 12 4m-15-5-9 3M31 145l7 12 12-3"/><circle cx="53" cy="38" r="1.5" fill="currentColor"/><path d="m27 83 5 4m0 4 5 4m0 4 5 4"/></g></svg>;
}
export function OldCodexOpening({ reference }: { reference: string }) {
  return <>
    <CodexBorder/>
    <div className="old-codex-margins" aria-hidden="true"><div className="old-codex-pricking"/><span className="old-codex-marginal-note">memoria manet</span><MarginalDragon/><span className="scribal-marginalia note-bene">nota bene</span><span className="scribal-marginalia note-finis">ad memoriam</span><span className="old-codex-library-mark">Liber · {reference}</span></div>
    <div className="old-codex-folio"><span>Ex bibliotheca vetere</span><span>fol. {reference} <i>r</i></span></div>
    <div className="old-codex-headpiece"><CodexEmblem/><div className="old-codex-incipit">Incipit memoria</div></div>
  </>;
}
export function OldCodexClosing({reference,authors}:{reference:string;authors:string}) {
 return <div className="old-codex-explicit"><PenFlourish closing/><i>Explicit. Memoria servata est.</i><span>By the hand of {authors}</span><small>fol. {reference} · finis</small></div>;
}
