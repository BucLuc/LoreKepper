import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditionMarkdown } from "../src/components/edition-markdown";
import { StoryInteractions } from "../src/components/story-interactions";
test("word reveal preserves Markdown and animates only the latest scene, keeping normal readers unchanged", () => {
  const text =
    "Old scene remains readable.\n\n[Scene](#lore-decision-scene-1)\n\n## Chapter II\n\n*Thornwick, dusk*\n\nNew prose **with emphasis** arrives.\n\n[Decision](#lore-decision-1-0)";
  const render = () => createElement("div", null, "Interactive slot");
  const html = renderToStaticMarkup(
    createElement(
      StoryInteractions.Provider,
      { value: render },
      createElement(EditionMarkdown, { text, style: "glorious" }),
    ),
  );
  assert.match(html, /<p>Old scene remains readable\.<\/p>/);
  assert.match(html, /lk-reveal-word/);
  assert.match(html, /--word:0/);
  assert.match(html, /<strong>/);
  assert.match(html, /Interactive slot/);
  const plain = renderToStaticMarkup(
    createElement(EditionMarkdown, {
      text: "Normal prose **stays bold**.",
      style: "glorious",
    }),
  );
  assert.ok(!plain.includes("lk-reveal-word"));
  assert.match(plain, /<strong>stays bold<\/strong>/);
});
