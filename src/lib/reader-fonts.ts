const families = {
  medieval: '"LK Medieval Sharp", Georgia, serif',
  ancient: '"Fell English", Georgia, serif',
  gothic: '"Unifraktur", Georgia, serif',
  georgia: 'Georgia, serif',
  sans: '"Segoe UI", Arial, sans-serif',
  mono: 'Consolas, "Courier New", monospace',
  courier: '"Courier New", monospace',
  handwritten: '"Segoe Print", "Comic Sans MS", cursive',
  impact: 'Impact, "Arial Black", sans-serif',
};
type Face = keyof typeof families;
type Choice = readonly [Face, string];
const historical: readonly Choice[] = [["georgia", "Clear Chronicle"], ["ancient", "Scribe’s Hand"], ["gothic", "Gothic Relic"]];
const choices: Record<string, readonly Choice[]> = {
  captain: [["medieval", "Captain’s Hand"], ["georgia", "Admiralty Record"], ["handwritten", "Deckhand’s Notes"], ["courier", "Harbour Typescript"]],
  manuscript: historical,
  scroll: [["georgia", "Restored Fragment"], ["ancient", "Ancient Ink"], ["gothic", "Forbidden Script"]],
  decree: [["georgia", "Courtly Prose"], ["ancient", "Royal Scribe"], ["gothic", "Imperial Blackletter"]],
  glorious: [["georgia", "Classic Legend"], ["ancient", "Heroic Chronicle"], ["gothic", "Immortal Inscription"]],
  poetry: [["georgia", "Quiet Verse"], ["ancient", "The Bard’s Quill"], ["gothic", "Lost Canticle"]],
  prophecy: [["georgia", "Clear Vision"], ["ancient", "Oracle’s Ink"], ["gothic", "Elder Runes"]],
  tavern: [["georgia", "Town Crier"], ["handwritten", "Innkeeper’s Scrawl"], ["gothic", "Old Tavern Ledger"]],
  wanted: [["georgia", "Sheriff’s Record"], ["impact", "Outlaw Headline"], ["courier", "Telegraph Notice"]],
  light: [["sans", "Everyday"], ["georgia", "Bookish"], ["mono", "Plain Typewriter"]],
  dark: [["sans", "After Hours"], ["georgia", "Midnight Reading"], ["mono", "Night Shift"]],
  newspaper: [["georgia", "Sunday Edition"], ["sans", "City Desk"], ["courier", "Press Wire"]],
  social: [["sans", "The Feed"], ["handwritten", "Personal Note"], ["mono", "Retro Internet"]],
  news: [["sans", "Newsroom"], ["georgia", "Editorial"], ["mono", "Wire Service"]],
  incident: [["sans", "Office Standard"], ["georgia", "Executive Brief"], ["mono", "Audit Trail"]],
  card: [["sans", "Modern Collection"], ["impact", "Legendary Edition"], ["georgia", "Vintage Collection"]],
  terminal: [["mono", "System Console"], ["courier", "Legacy Terminal"], ["sans", "Mission Dashboard"]],
  space: [["mono", "Shipboard Console"], ["sans", "Flight Deck"], ["courier", "Deep Space Teletype"]],
  bug: [["mono", "Debug Log"], ["sans", "Issue Tracker"], ["courier", "Legacy Ticket"]],
  screenplay: [["courier", "Studio Draft"], ["sans", "Director’s Notes"], ["georgia", "Literary Adaptation"]],
  dossier: [["courier", "Declassified File"], ["sans", "Agency Brief"], ["georgia", "Historical Evidence"]],
  museum: [["georgia", "Permanent Collection"], ["sans", "Gallery Label"], ["ancient", "Antiquarian Record"]],
  court: [["courier", "Court Reporter"], ["georgia", "Judicial Record"], ["sans", "Modern Proceedings"]],
  academic: [["georgia", "Scholarly Journal"], ["sans", "Research Review"], ["mono", "Working Paper"]],
  letter: [["georgia", "Proper Correspondence"], ["handwritten", "A Personal Hand"], ["courier", "Typed Dispatch"]],
  lyrics: [["sans", "Studio Session"], ["handwritten", "Songwriter’s Notebook"], ["courier", "Demo Tape"]],
};
export function readerFonts(style: string) {
  const options = [...(choices[style] ?? historical)];
  if (["glorious", "manuscript", "scroll", "decree", "poetry", "prophecy"].includes(style)) {
    options.splice(2, 0, ["medieval", "Worn Quill"]);
  }
  return [{ id: "default", name: "Original edition", family: "" },
    ...options
      .map(([id, name]) => ({ id, name, family: families[id] }))];
}
