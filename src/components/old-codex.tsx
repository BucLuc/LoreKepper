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
    <div className="old-codex-margins" aria-hidden="true"><div className="old-codex-pricking"/><span className="old-codex-marginal-note">memoria manet</span><MarginalDragon/><span className="scribal-marginalia note-bene">nota bene</span><span className="scribal-marginalia note-finis">ad memoriam</span><span className="old-codex-library-mark">Liber · {reference}</span></div>
    <div className="old-codex-folio"><span>Ex bibliotheca vetere</span><span>fol. {reference} <i>r</i></span></div>
    <div className="old-codex-headpiece"><PenFlourish/><div className="old-codex-incipit">Incipit memoria</div></div>
  </>;
}
export function OldCodexClosing({reference,authors}:{reference:string;authors:string}) {
 return <div className="old-codex-explicit"><PenFlourish closing/><i>Explicit. Memoria servata est.</i><span>By the hand of {authors}</span><small>fol. {reference} · finis</small></div>;
}
