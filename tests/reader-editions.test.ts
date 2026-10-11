import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readerFonts, editionFontChoices } from "../src/lib/reader-fonts";
import { EditionMarkdown } from "../src/components/edition-markdown";
import { existsSync, readFileSync } from "node:fs";

test("all 27 editions have at least five distinct locally hosted fonts including default", () => {
  assert.equal(Object.keys(editionFontChoices).length, 27);
  const css = readFileSync("src/app/edition-fonts.css", "utf8") + readFileSync("src/app/reader-controls.css", "utf8") + readFileSync("src/app/historical.css", "utf8");
  for (const style of Object.keys(editionFontChoices)) {
    const fonts = readerFonts(style);
    assert.ok(fonts.length >= 5, style);
    assert.equal(new Set(fonts.map(f => f.family)).size, fonts.length, style);
    assert.equal(new Set(fonts.map(f => f.id)).size, fonts.length, style);
    assert.equal(fonts[0].id, "default");
    for (const font of fonts) assert.ok(css.includes(font.family.split('"')[1]), font.family);
  }
  for (const path of css.matchAll(/url\("(\/fonts\/[^"]+)"\)/g)) assert.ok(existsSync("public" + path[1]), path[1]);
});

test("sections retain GFM structure, nested lists, fences, and original text", () => {
  const text = '# First\n\nOpening.\n\n## Second\n\n- parent\n  - child\n\n> testimony\n\n| Name | Value |\n| --- | --- |\n| Item | 2 |\n\n```md\n# Not a section\n```\n\n- [x] done';
  for (const style of Object.keys(editionFontChoices)) {
    const html = renderToStaticMarkup(createElement(EditionMarkdown, {text, style}));
    assert.equal((html.match(/<section /g) ?? []).length, 2, style);
    for (const fragment of ['<h1>First</h1>', '<h2>Second</h2>', '<table', '<blockquote>', '<pre>', 'child', 'type="checkbox"', '# Not a section']) assert.ok(html.includes(fragment), fragment);
  }
});

test("incomplete Markdown and unsafe input render safely", () => {
  for (const text of ['#\n**unfinished\n[broken](', '```\n# incomplete fence', '<script>alert(1)</script>\n\n[safe](javascript:alert(1))', '', '| incomplete |\n---', '中文 café Ω 🧭']) {
    const html = renderToStaticMarkup(createElement(EditionMarkdown, { text, style: "manuscript" }));
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('href="javascript:'));
  }
});
