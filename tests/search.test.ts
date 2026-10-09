import assert from "node:assert/strict";
import test from "node:test";
import { matchesStory } from "../src/lib/search";
test("search finds titles and content beyond the card preview", () => {
  const entry = {
    title: "A Jester's Bargain",
    messages: [
      {
        content:
          "x".repeat(250) +
          "\nHast thou not ears to hear the word *non* before **profit**?",
      },
    ],
  };
  assert.ok(matchesStory(entry, "jester's bargain"));
  assert.ok(matchesStory(entry, "NON before profit"));
  assert.ok(matchesStory(entry, "ears to\nhear"));
  assert.ok(!matchesStory(entry, "unrelated"));
});
test("search finds later messages and normalizes typographic quotes", () => {
  assert.ok(
    matchesStory(
      {
        title: "Other",
        messages: [{ content: "hello" }, { content: "The “second” message" }],
      },
      'the "second" message',
    ),
  );
});
