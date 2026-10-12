import assert from 'node:assert/strict';
import test from 'node:test';
import {galleryEditions,galleryFrames,galleryCovers} from '../src/lib/gallery-editions';
import {normalizeDesign,presetDesign} from '../src/lib/edition-design';
import {editionGroups} from '../src/lib/reader-editions';
test('all thirteen requested manuscripts have artwork and exactly one category',()=>{assert.equal(galleryEditions.length,13);assert.ok(!galleryEditions.some(e=>e.id.includes('reliquary')));for(const edition of galleryEditions){const id=edition.id.replace('gallery-','');assert.ok(galleryFrames[id]);assert.ok(galleryCovers[id]);assert.equal(editionGroups.flatMap(g=>g.ids).filter(x=>x===edition.id).length,1);}});
test('page and cover choices survive normalization without losing material or font',()=>{const design=normalizeDesign({...presetDesign('gallery-winter'),pages:true,showCover:false,background:'ancientcodex',font:'medieval'},'gallery-winter');assert.equal(design.pages,true);assert.equal(design.showCover,false);assert.equal(design.background,'ancientcodex');assert.equal(design.font,'medieval');assert.equal(normalizeDesign({pages:'true',showCover:'false'},'gallery-winter').pages,false);});
import {switchEditionDesign} from '../src/lib/edition-design';
import {prepareGalleryMarkdown} from '../src/lib/gallery-markdown';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {EditionMarkdown} from '../src/components/edition-markdown';
test('changing editions preserves page and cover choices while restoring that edition artwork',()=>{const previous={...presetDesign('gallery-codex'),pages:true,showCover:false,background:'ancientcodex'};for(const edition of galleryEditions){const next=switchEditionDesign(previous,edition.id);assert.equal(next.pages,true);assert.equal(next.showCover,false);assert.equal(next.background,edition.id);}});
test('cover metadata handles optional titles and subtitles without changing later Markdown',()=>{const text='# The record\n\n*Copied in winter*\n\n## Chapter\n\n```md\n# Example\n```';assert.deepEqual(prepareGalleryMarkdown(text,'The record',true),{body:'## Chapter\n\n```md\n# Example\n```',subtitle:'Copied in winter'});assert.equal(prepareGalleryMarkdown(text,'The record',false).body.trimStart().startsWith('*Copied in winter*'),true);assert.equal(prepareGalleryMarkdown('# Different chapter\n\nText','The record',true).body,'# Different chapter\n\nText');assert.equal(prepareGalleryMarkdown('A story with no headings.','The record',true).body,'A story with no headings.');});
test('manuscripts recognize fields and setting notes without foreign section styling',()=>{for(const edition of galleryEditions){const html=renderToStaticMarkup(createElement(EditionMarkdown,{style:edition.id,text:'Subject: A journey\n\n> [!SETTING]\n> The Year of Our Lord 1387\n\n## Chapter\n\nA preserved story.'}));assert.ok(html.includes('manuscript-field'));assert.ok(html.includes('setting-note'));assert.ok(!html.includes('[!SETTING]'));assert.ok(!html.includes('edition-section'));assert.ok(!html.includes('message-prose'));assert.ok(html.includes('A preserved story.'));}});
import {readFileSync} from 'node:fs';
import {StoryDocument} from '../src/components/story-document';
import {readerEditions} from '../src/lib/reader-editions';
import type {Exhibit} from '../src/lib/archive';
test('manuscript conversations retain normalized speakers, timestamps and every Markdown turn',()=>{const fixture=JSON.parse(readFileSync(new URL('./fixtures/edition-presets.json',import.meta.url),'utf8')).entry as Exhibit;const entry={...fixture,messages:[{...fixture.messages[0],author:'Liridon',timestamp:'2026-10-12T16:00:00Z',content:'First **turn**.',presentation:'First **turn**.'},{...fixture.messages[1],author:'Luc',timestamp:'2026-10-12T16:05:00Z',content:'Second turn.',presentation:'Second turn.'}]};for(const edition of galleryEditions){const html=renderToStaticMarkup(createElement(StoryDocument,{entry,style:edition.id,theme:readerEditions.find(e=>e.id===edition.id)!,design:{...presetDesign(edition.id),showCover:false}}));assert.equal(html.match(/class="manuscript-message-head"/g)?.length,2);assert.ok(html.includes('Liri</span>'));assert.ok(html.includes('Luc</span>'));assert.ok(html.includes('18:00'));assert.ok(html.includes('18:05'));assert.ok(html.includes('First <strong>turn</strong>.'));assert.ok(html.includes('Second turn.'));}});

test('empty and rejected Markdown image URLs never render empty image sources',()=>{
 for(const style of ['gallery-codex','ancientcodex']){
  const html=renderToStaticMarkup(createElement(EditionMarkdown,{style,text:'![Missing illustration]()\n\n![Blocked illustration](javascript:alert)\n\n![Valid illustration](/textures/library-vellum.svg)'}));
  assert.ok(!html.includes('src=""'));
  assert.equal((html.match(/<img /g)??[]).length,1);
  assert.ok(html.includes('Missing illustration'));
  assert.ok(html.includes('Blocked illustration'));
  assert.ok(html.includes('src="/textures/library-vellum.svg"'));
 }
});
