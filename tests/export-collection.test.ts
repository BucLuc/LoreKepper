import test from "node:test";
import assert from "node:assert/strict";
import {
  collectionJson,
  collectionMarkdown,
} from "../src/lib/export-collection";
import { validateEntries } from "../src/lib/validation";
import type { Entry } from "../src/lib/archive";
const entries: Entry[] = [
  {
    id: "secret-entry-reference",
    type: "discussion",
    title: "The legend",
    score: 9,
    reason: "Funny",
    source: "archive",
    messages: [
      {
        id: "secret-message-reference",
        author: "Chronicler",
        timestamp: "2026-10-10",
        content: "One tale\n\nAnother line",
        original: "<p>One tale</p>",
        source: "archive",
        sourceFormat: "html",
        userId: "secret-user-reference",
        presentation: "derived",
      } as Entry["messages"][number],
    ],
  },
];
test("collection JSON keeps import format and excludes all IDs, user references and derived metadata", () => {
  const value = collectionJson(entries);
  assert.equal(validateEntries(value).length, 1);
  const json = JSON.stringify(value);
  assert.ok(!json.includes("secret-"));
  assert.ok(!json.includes("presentation"));
  assert.equal(
    value.items[0].messages[0].original,
    entries[0].messages[0].original,
  );
  assert.equal(
    value.items[0].messages[0].content,
    entries[0].messages[0].content,
  );
});
test("Markdown export preserves all content and attribution without application references", () => {
  const md = collectionMarkdown("My hall", entries);
  assert.ok(md.startsWith("# My hall"));
  assert.ok(md.includes("## The legend"));
  assert.ok(md.includes("### Chronicler · 2026-10-10"));
  assert.ok(md.includes(entries[0].messages[0].content));
  assert.ok(!md.includes("secret-"));
});
