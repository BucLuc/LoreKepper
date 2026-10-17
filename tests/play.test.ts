import test from "node:test";
import assert from "node:assert/strict";
import {
  voice,
  playerVoice,
  speechLine,
  storyMarkdown,
  type Adventure,
} from "../src/lib/play";
test("voice language, style and scope stay independent and valid", () => {
  const v = voice({
    language: "German",
    style: "Pirate",
    tone: "Default",
    scope: "dialogue",
  });
  assert.equal(v.language, "German");
  assert.equal(v.style, "Pirate");
  assert.equal(v.scope, "dialogue");
  assert.equal(voice({ style: "invalid", tone: "invalid" }).style, "Modern");
});
test("clean export preserves story while interaction export preserves chronological decisions", () => {
  const story = {
    segments: [
      {
        narrative: "First scene.",
        questions: [{ player: "a", text: "Run?", answer: "Stay." }],
        created: "",
      },
      { narrative: "They stayed.", questions: [], created: "" },
    ],
  } as Adventure;
  const clean = storyMarkdown(story, [], false),
    full = storyMarkdown(
      story,
      [{ user_id: "a", name: "ada_account", identity_name: "Ada", character: null }],
      true,
    );
  assert.equal(clean, "First scene.\n\nThey stayed.");
  assert.ok(full.indexOf("First scene.") < full.indexOf("Stay."));
  assert.ok(full.indexOf("Stay.") < full.indexOf("They stayed."));
  assert.match(full, /\*\*Ada:\*\*/);
  assert.doesNotMatch(full, /ada_account/);
  // Without a character name, the story names nobody, not even the account.
  const unnamed = storyMarkdown(
    story,
    [{ user_id: "a", name: "ada_account", character: null }],
    true,
  );
  assert.match(unnamed, /> Run\?/);
  assert.doesNotMatch(unnamed, /ada_account/);
  assert.equal(story.segments[0].questions[0].answer, "Stay.");
  // A single hidden question leaves only a marked gap in the export.
  const hidden = storyMarkdown(story, [], true, ["0-0"]);
  assert.equal(hidden, "First scene.\n\n---\n\nQuestion\n\n---\n\nThey stayed.");
});
test("players can keep their own language and style; empty choices follow the story", () => {
  assert.deepEqual(playerVoice({ language: " German ", style: "Pirate" }), {
    language: "German",
    style: "Pirate",
  });
  assert.deepEqual(playerVoice({ language: "", style: "Shouting" }), null);
  assert.equal(playerVoice(null), null);
});

test("a player's voice preset becomes a short speech line", () => {
  assert.deepEqual(playerVoice({ narrator: "pirate-captain", style: "Medieval" }), { narrator: "pirate-captain" });
  assert.equal(speechLine("Write like a pirate captain."), "talks like a pirate captain");
  assert.equal(speechLine("Write in a dark, gritty way."), "talks in a dark, gritty way");
});
