import {galleryEditions,galleryPapers} from "./gallery-editions";
import { readerEditions } from "./reader-editions";
import { resolveReaderFont } from "./reader-fonts";

export type EditionDesign = {
  pages?: boolean;
  showCover?: boolean;
  background: string;
  header: string;
  body: string;
  footer: string;
  font: string;
  border: boolean;
  artwork: boolean;
  columns: "preset" | "one" | "two";
  initial: "preset" | "on" | "off" | "gilded" | "illuminated" | "penwork";
  numbering: "preset" | "on" | "off";
  cover: string | null;
  endPage: string | null;
};
type OptionNames = { background:string; header:string; body:string; footer:string };
const names: Record<string, [string,string,string,string]> = {
  ancientcodex:["Library vellum","Scribe’s incipit","Penwork folios","Explicit liber"],
  manuscript:["Illuminated vellum","Chronicler’s frontispiece","Illuminated passages","Chronicler’s colophon"],
  scroll:["Recovered parchment","Scroll of beginnings","Carved fragments","The final fragment"],
  decree:["Royal parchment","Sovereign’s banner","Royal clauses","The royal seal"],
  glorious:["Obsidian & gold","Hall of glory","Immortal verses","An enduring legend"],
  prophecy:["Midnight oracle","Celestial vision","Oracle’s revelations","The fulfilled omen"],
  poetry:["Poet’s parchment","Lyric invocation","Quiet stanzas","A final silence"],
  captain:["Salt & old charts","Captain’s bearings","Ship’s journal","Voyage concluded"],
  tavern:["Hearthside paper","The Crooked Quill","Hearthside tales","Until the next tale"],
  wanted:["Outlaw broadside","Bounty proclamation","Charges & warrants","Justice remembered"],
  light:["Porcelain paper","Quiet opening","Unadorned prose","Quiet closing"],
  dark:["Charcoal paper","After-dark opening","After-dark prose","After-dark closing"],
  newspaper:["Gazette newsprint","Gazette masthead","Gazette columns","The final edition"],
  social:["Cloud canvas","The archived feed","Conversation cards","All caught up"],
  news:["Broadcast white","Breaking bulletin","Special coverage","Coverage concluded"],
  incident:["Office stationery","Internal complaint","Statement of events","Reviewed & retained"],
  card:["Collector’s foil","Legendary card face","Archive abilities","Album complete"],
  terminal:["Phosphor night","Archive command","Console records","End of file"],
  space:["Deep-space glass","Incoming transmission","Relay packets","Signal terminated"],
  bug:["Issue-tracker slate","Issue summary","Reproduction notes","Report resolved"],
  screenplay:["Script paper","Opening credits","Scenes & dialogue","Fade out"],
  dossier:["Directorate stock","Classified cover sheet","Evidence files","Return to archive"],
  museum:["Gallery ivory","Curator’s label","Exhibit notes","Accession complete"],
  court:["Clerk’s paper","High court heading","Numbered testimony","Admitted into the record"],
  academic:["Journal stock","Journal masthead","Scholarly sections","References closed"],
  letter:["Correspondence linen","Personal letterhead","Written correspondence","Yours, for posterity"],
  lyrics:["Songbook paper","Record-sleeve opening","Verses & choruses","The final note"],
};
export const editionModules = readerEditions.map(edition => {
  const [background,header,body,footer]=names[edition.id] ?? [edition.name,"Illustrated cover","Manuscript text","Final folio"];
  return {...edition, background,header,body,footer};
});
export function moduleName(id:string,part:keyof OptionNames) {
  return id === "none" ? (part === "header" ? "Title only" : "No closing ornament") : editionModules.find(e=>e.id===id)?.[part] ?? id;
}
export function presetDesign(preset:string, font="default"):EditionDesign {
  const id=readerEditions.some(e=>e.id===preset) ? preset : "glorious";
  return {pages:false,showCover:true,background:id,header:id,body:id,footer:id,font,border:true,artwork:true,columns:"preset",initial:"preset",numbering:"preset",cover:null,endPage:null};
}
/** Validate persisted/browser-supplied designs before using them as CSS classes. */
export function normalizeDesign(value:unknown,preset:string):EditionDesign {
  const defaults=presetDesign(preset);
  if (!value || typeof value!=="object" || Array.isArray(value)) return defaults;
  const input=value as Record<string,unknown>;
  const valid=(id:unknown):id is string=>typeof id==="string" && readerEditions.some(e=>e.id===id);
  return {
    pages:input.pages===true,
    showCover:input.showCover!==false,
    background:backgroundChoices(preset).some(o=>o.id===input.background)?input.background as string:defaults.background,
    header:defaults.header,
    body:defaults.body,
    footer:defaults.footer,
    font:typeof input.font==="string" && resolveReaderFont(preset,input.font)?.id===input.font?input.font:"default",
    border:typeof input.border==="boolean"?input.border:true,
    artwork:typeof input.artwork==="boolean"?input.artwork:true,
    columns:formatOptions(preset).columns && ["one","two"].includes(input.columns as string)?input.columns as "one"|"two":"preset",
    initial:formatOptions(preset).initial && ["on","off","gilded","illuminated","penwork"].includes(input.initial as string)?input.initial as EditionDesign["initial"]:"preset",
    numbering:formatOptions(preset).numbering && ["on","off"].includes(input.numbering as string)?input.numbering as "on"|"off":"preset",
    cover:valid(input.cover)?input.cover:null,
    endPage:valid(input.endPage)?input.endPage:null,
  };
}
export function isPresetComposition(design:EditionDesign,preset:string) {
  return [design.background,design.header,design.body,design.footer].every(id=>id===preset) && design.columns==="preset" && design.initial==="preset" && design.numbering==="preset" && design.border && design.artwork;
}
/** Whether Reset has anything to undo. Pages and cover are reading layout and survive a reset. */
export function isCustomDesign(design:EditionDesign,preset:string) {
  return !isPresetComposition(design,preset) || design.font!=="default" || design.cover!==null || design.endPage!==null;
}
// The surface owns the palette. Modules borrow it without importing foreign paper.
export const editionPalettes:Record<string,{ink:string;accent:string;surface:string;panel:string}> = {
  "paper-cotton":{ink:"#3b342a",accent:"#78563d",surface:"#f2ebda",panel:"#e7dec8"},
  "paper-laid":{ink:"#403329",accent:"#85512e",surface:"#e9d9b9",panel:"#dac6a0"},
  "paper-ivory":{ink:"#363124",accent:"#78613b",surface:"#f7efd9",panel:"#e8ddbd"},
  "paper-rose":{ink:"#4a302b",accent:"#874d44",surface:"#edd9ce",panel:"#ddc0b2"},
  "paper-blue":{ink:"#2c3e48",accent:"#425e70",surface:"#dde5e5",panel:"#c8d6d9"},
  "paper-antique":{ink:"#422d1d",accent:"#813c2b",surface:"#d9bd88",panel:"#c9a974"},
  ancientcodex:{ink:"#392919",accent:"#813c2b",surface:"#ddc69a",panel:"#cfb486"},
  manuscript:{ink:"#4d392a",accent:"#84352e",surface:"#eadbb4",panel:"#ddc89c"},
  scroll:{ink:"#4b3925",accent:"#76502c",surface:"#d9c89f",panel:"#ccb789"},
  decree:{ink:"#4b3424",accent:"#71323c",surface:"#e6d5af",panel:"#d7c396"},
  glorious:{ink:"#eee0b9",accent:"#d4b56b",surface:"#19231d",panel:"#26332a"},
  poetry:{ink:"#354a3d",accent:"#4c6851",surface:"#e8dcc2",panel:"#dacdb1"},
  prophecy:{ink:"#ece5f6",accent:"#d0b2e6",surface:"#242438",panel:"#34334c"},
  captain:{ink:"#3f3b2b",accent:"#74502e",surface:"#d9c59b",panel:"#cbb58a"},
  tavern:{ink:"#493521",accent:"#7d472b",surface:"#d9c49a",panel:"#cdb58a"},
  wanted:{ink:"#482f1e",accent:"#80502e",surface:"#dfcba4",panel:"#cdb58d"},
  light:{ink:"#242b35",accent:"#4c596a",surface:"#ffffff",panel:"#edf0f3"},
  dark:{ink:"#e2e5e9",accent:"#b3bdce",surface:"#171c23",panel:"#29323d"},
  newspaper:{ink:"#30322a",accent:"#555b48",surface:"#e8e5d4",panel:"#d9d6c3"},
  social:{ink:"#28394d",accent:"#365b92",surface:"#f1f4f8",panel:"#e1e8f2"},
  news:{ink:"#28323b",accent:"#a52b3b",surface:"#f5f5f2",panel:"#e6e7e5"},
  incident:{ink:"#2b3d49",accent:"#34596a",surface:"#fafbf9",panel:"#e7eef0"},
  card:{ink:"#f2e4bd",accent:"#e7c77f",surface:"#24272d",panel:"#383c44"},
  terminal:{ink:"#c3e0b5",accent:"#9ed384",surface:"#0c1712",panel:"#1b3024"},
  space:{ink:"#d6eff3",accent:"#86cbd7",surface:"#0b2029",panel:"#193641"},
  bug:{ink:"#e7e9f4",accent:"#c0b3ed",surface:"#202535",panel:"#343b51"},
  screenplay:{ink:"#282c2a",accent:"#526056",surface:"#fcfcf8",panel:"#eceee7"},
  dossier:{ink:"#3d3b2c",accent:"#843b3a",surface:"#ddd8bb",panel:"#cec8a7"},
  museum:{ink:"#394232",accent:"#58634a",surface:"#dbdccf",panel:"#caced0"},
  court:{ink:"#283a4b",accent:"#3c5c70",surface:"#fafaf6",panel:"#e5ebee"},
  academic:{ink:"#2c343b",accent:"#405c6b",surface:"#fffefb",panel:"#e8edef"},
  letter:{ink:"#3b433d",accent:"#65704f",surface:"#faf8ef",panel:"#e8e4d6"},
  lyrics:{ink:"#513927",accent:"#963f30",surface:"#e8ddc3",panel:"#d8caad"},
};

/** Backgrounds are paint-only alternatives, never another format's layout. */
export function backgroundChoices(preset:string) {
 return [{id:preset,name:"Original surface"},...(preset.startsWith("gallery-")?galleryPapers.map(p=>({id:"gallery-paper-"+p.id,name:p.name})):[]),...[
 {id:"paper-cotton",name:"Cotton rag"},{id:"paper-laid",name:"Scribe’s laid paper"},{id:"paper-ivory",name:"Ivory vellum"},{id:"paper-rose",name:"Rose-tinted parchment"},{id:"paper-blue",name:"Blue-grey archive stock"},{id:"paper-antique",name:"Antique golden parchment"},{id:"light",name:"Clean ivory"},{id:"manuscript",name:"Warm parchment"},{id:"ancientcodex",name:"Library vellum"},{id:"dark",name:"Charcoal"},{id:"glorious",name:"Obsidian & gold"}
 ].filter(o=>o.id!==preset && !(preset.startsWith("gallery-") && ["dark","glorious","light","manuscript"].includes(o.id)))];
}
export function formatOptions(preset:string) {
 return {
 border:preset.startsWith("gallery-") || ["manuscript","ancientcodex"].includes(preset),
 initial:preset.startsWith("gallery-") || ["manuscript","ancientcodex","scroll","decree","glorious"].includes(preset),
 columns:["newspaper","academic"].includes(preset),
 numbering:preset==="court",
 artwork:preset.startsWith("gallery-") || ["space","captain","decree","glorious","prophecy","scroll","poetry","wanted","tavern"].includes(preset),
 };
}

for(const edition of galleryEditions) editionPalettes[edition.id]={ink:"#382f24",accent:"#80372e",surface:"#f1e6c9",panel:"#dbc69c"};

for(const paper of galleryPapers)editionPalettes["gallery-paper-"+paper.id]={ink:"#382f24",accent:"#80372e",surface:paper.surface,panel:paper.edge};

/** Reading layout is a reader preference, independent of manuscript decoration. */
export function switchEditionDesign(value:EditionDesign,preset:string):EditionDesign {return {...presetDesign(preset),pages:value.pages===true,showCover:value.showCover!==false};}
