import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { editionFontChoices, readerFonts } from "../src/lib/reader-fonts";
import { EditionMarkdown } from "../src/components/edition-markdown";

const fontCss = ["edition-fonts", "reader-controls", "historical"]
  .map((name) => readFileSync(`src/app/${name}.css`, "utf8"))
  .join("\n");
function fontFile(family: string) {
  for (const block of fontCss.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
    if (
      block[1].includes(`font-family: "${family}"`) &&
      !block[1].includes("font-style: italic")
    ) {
      return readFileSync(
        "public" + block[1].match(/url\(["']([^"']+)["']\)/)![1],
      );
    }
  }
  throw new Error(`No normal face for ${family}`);
}
function tables(buffer: Buffer) {
  const result: Record<string, number> = {};
  for (let i = 0; i < buffer.readUInt16BE(4); i++) {
    const at = 12 + i * 16;
    result[buffer.toString("ascii", at, at + 4)] = buffer.readUInt32BE(at + 8);
  }
  return result;
}
test("all 27 editions have genuinely different defaults and distinct font binaries within each menu", () => {
  const defaults = Object.keys(editionFontChoices).map(
    (style) => readerFonts(style)[0],
  );
  assert.equal(new Set(defaults.map((f) => f.family)).size, 27);
  assert.match(readerFonts("manuscript")[0].family, /Medieval Sharp/);
  assert.match(readerFonts("ancientcodex")[0].family, /Fondamento/);
  for (const style of Object.keys(editionFontChoices)) {
    const signatures = readerFonts(style).map((f) =>
      createHash("sha256")
        .update(fontFile(f.family.split('"')[1]))
        .digest("hex"),
    );
    assert.equal(new Set(signatures).size, signatures.length, style);
  }
});
test("every normal face is a real regular font or a variable font with a valid regular weight", () => {
  const families = new Set(
    Object.keys(editionFontChoices).flatMap((style) =>
      readerFonts(style).map((f) => f.family.split('"')[1]),
    ),
  );
  for (const family of families) {
    const font = fontFile(family),
      offsets = tables(font);
    assert.ok(offsets.cmap && offsets.name && offsets["OS/2"], family);
    if (offsets.fvar) {
      const at = offsets.fvar,
        start = font.readUInt16BE(at + 4),
        count = font.readUInt16BE(at + 8),
        size = font.readUInt16BE(at + 10);
      let regular = false;
      for (let i = 0; i < count; i++) {
        const axis = at + start + size * i;
        if (font.toString("ascii", axis, axis + 4) === "wght")
          regular =
            font.readInt32BE(axis + 4) / 65536 <= 400 &&
            font.readInt32BE(axis + 12) / 65536 >= 400;
      }
      assert.ok(regular, family);
    } else {
      const weight = font.readUInt16BE(offsets["OS/2"] + 4);
      assert.ok(weight >= 400 && weight <= 500, family);
    }
  }
});
test("screenplay, proceedings, complaint and issue conventions are recognized without rewriting content", () => {
  const cases = [
    ["screenplay", "INT. THE ARCHIVE — DAY", "script-slug"],
    ["screenplay", "THE CHRONICLER", "script-character"],
    ["screenplay", "(under his breath)", "script-direction"],
    ["court", "Q: What happened to the compass?", "court-question"],
    ["incident", "Subject: The missing compass", "correspondence-field"],
    ["bug", "Expected: The compass should point north.", "issue-detail"],
  ];
  for (const [style, text, kind] of cases) {
    const html = renderToStaticMarkup(
      createElement(EditionMarkdown, { style, text }),
    );
    assert.ok(html.includes(`class="${kind}"`), style);
    assert.ok(html.includes(text), text);
    const code = renderToStaticMarkup(
      createElement(EditionMarkdown, {
        style,
        text: "```text\n" + text + "\n```",
      }),
    );
    assert.ok(!code.includes(`class="${kind}"`));
  }
});
