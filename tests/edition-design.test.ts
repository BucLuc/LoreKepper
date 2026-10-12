import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync} from "node:fs";
import {StoryDocument} from "../src/components/story-document";
import {CollectionBookend} from "../src/components/collection-bookend";
import {readerEditions} from "../src/lib/reader-editions";
import {allReaderFonts,designFonts} from "../src/lib/reader-fonts";
import {editionModules,editionPalettes,presetDesign,normalizeDesign,isPresetComposition,formatOptions,backgroundChoices} from "../src/lib/edition-design";
import type {Exhibit} from "../src/lib/archive";
const baseline=JSON.parse(readFileSync(new URL("./fixtures/edition-presets.json",import.meta.url),"utf8")) as {entry:Exhibit;hashes:Record<string,string>};

test("every preset preserves its pre-composition header, content and closing markup",()=>{
  for(const theme of readerEditions.filter(theme=>theme.id in baseline.hashes)) {
    const design=presetDesign(theme.id);
    assert.equal(isPresetComposition(design,theme.id),true);
    assert.equal(design.cover,null);
    assert.equal(design.endPage,null);
    const html=renderToStaticMarkup(createElement(StoryDocument,{entry:baseline.entry,style:theme.id,theme,design}));
    const inner=html.replace(/^<article[^>]*>/,"").replace(/<\/article>$/,"");
    if(theme.id==="ancientcodex") {assert.ok(inner.includes("codex-grand-headpiece"));assert.ok(inner.includes("END_DESIGN."));} else assert.equal(createHash("sha256").update(inner).digest("hex"),baseline.hashes[theme.id],theme.id);
  }
});
test("background changes retain the complete format layout and retire saved mixed parts",()=>{
 const original=presetDesign("manuscript");
 const chosen=normalizeDesign({...original,background:"light",header:"terminal",body:"court",footer:"decree",font:"spacemono",initial:"on"},"manuscript");
 assert.equal(chosen.header,"manuscript");assert.equal(chosen.body,"manuscript");assert.equal(chosen.footer,"manuscript");
 const theme=readerEditions.find(e=>e.id==="manuscript")!;
 const html=renderToStaticMarkup(createElement(StoryDocument,{entry:baseline.entry,style:"manuscript",theme,design:chosen}));
 const before=renderToStaticMarkup(createElement(StoryDocument,{entry:baseline.entry,style:"manuscript",theme,design:original}));
 const inner=(h:string)=>h.replace(/^<article[^>]*>/,"").replace(/<\/article>$/,"");
 assert.equal(inner(html),inner(before));assert.ok(html.includes("theme-manuscript edition-resurfaced"));assert.ok(!html.includes("module-"));
 for(const fragment of ["<table","<ul>","<blockquote>","END_DESIGN.","END_SECOND.","LK Space Mono"])assert.ok(html.includes(fragment),fragment);
});
test("invalid preferences fall back safely and format-specific controls are scoped",()=>{
 const invalid=normalizeDesign({background:'x" onclick="bad',header:"none",body:null,footer:[],font:"missing",cover:true,endPage:"missing"},"court");assert.deepEqual(invalid,presetDesign("court"));
 const scoped=normalizeDesign({...presetDesign("court"),columns:"two",initial:"on",numbering:"off"},"court");
 assert.equal(scoped.columns,"preset");assert.equal(scoped.initial,"preset");assert.equal(scoped.numbering,"off");
});
test("the atelier offers complete, named modules and no duplicate font faces",()=>{
  assert.equal(editionModules.length,readerEditions.length);
  for(const theme of editionModules) {
    for(const part of ["background","header","body","footer"] as const) assert.ok(theme[part]);
    assert.ok(editionPalettes[theme.id]);
    const fonts=designFonts(theme.id);
    assert.equal(fonts.length,allReaderFonts.length);
    assert.equal(new Set(fonts.map(f=>f.family)).size,fonts.length);
  }
});
test("alternate bookend artwork uses the selected page material and lettering",()=>{
  const html=renderToStaticMarkup(createElement(CollectionBookend,{name:"Collected memories",count:228,style:"manuscript",background:"terminal",fontPreset:"court",font:"spacemono"}));
  assert.ok(html.includes("theme-manuscript edition-resurfaced"));
  assert.ok(!html.includes("module-"));
  assert.ok(html.includes(editionPalettes.terminal.surface));
  assert.ok(html.includes("LK Space Mono"));
  assert.ok(html.includes("228"));
});

test("initial styles are available in manuscripts and retain unsupported defaults",()=>{const supported=["manuscript","ancientcodex","scroll","decree","glorious"];for(const theme of readerEditions){assert.equal(formatOptions(theme.id).initial,(theme.id.startsWith("gallery-")||supported.includes(theme.id)),theme.id);assert.equal(normalizeDesign({...presetDesign(theme.id),initial:"off"},theme.id).initial,(theme.id.startsWith("gallery-")||supported.includes(theme.id))?"off":"preset");}});

test("new paper backgrounds validate without changing format structure",()=>{for(const id of ["paper-cotton","paper-laid","paper-ivory","paper-rose","paper-blue","paper-antique"]){assert.ok(backgroundChoices("ancientcodex").some(o=>o.id===id));assert.ok(editionPalettes[id]);const d=normalizeDesign({...presetDesign("ancientcodex"),background:id},"ancientcodex");assert.equal(d.background,id);assert.equal(d.header,"ancientcodex");assert.equal(d.body,"ancientcodex");}});

test("ornate initials persist and formats without initials retain their original default",()=>{
 for(const initial of ["off","on","gilded","illuminated","penwork"] as const){for(const preset of ["gallery-codex","ancientcodex"]){assert.equal(normalizeDesign({...presetDesign(preset),initial},preset).initial,initial);}}
 assert.equal(presetDesign("light").initial,"preset");
 assert.equal(normalizeDesign({...presetDesign("light"),initial:"illuminated"},"light").initial,"preset");
});
