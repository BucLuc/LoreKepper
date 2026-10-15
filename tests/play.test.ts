import test from "node:test";
import assert from "node:assert/strict";
import {
  voice,
  voicePrompt,
  parseTurn,
  playerVoice,
  narratorLine,
  storyMarkdown,
  type Adventure,
} from "../src/lib/play";
test("voice language, scope and natural default tone stay independent", () => {
  const v = voice({
    language: "German",
    style: "Pirate",
    tone: "Default",
    scope: "dialogue",
  });
  const prompt = voicePrompt(v);
  assert.match(prompt, /German/);
  assert.match(prompt, /Pirate/);
  assert.match(prompt, /Default does not mean emotionally neutral/);
  assert.match(prompt, /dialogue only/);
  assert.equal(voice({ style: "invalid", tone: "invalid" }).style, "Modern");
  assert.match(voicePrompt({ ...v, tone: "Romantic" }, true), /romantic/);
});
test("structured turns reject invented players, duplicate questions and empty continuations", () => {
  const output = {
    narrative: "A bridge collapses.",
    summary: "Bridge broken.",
    questions: [{ player: "a", text: "What do you do?" }],
  };
  assert.equal(
    parseTurn(JSON.stringify(output), ["a"], false).questions.length,
    1,
  );
  assert.throws(
    () => parseTurn(JSON.stringify(output), ["b"], false),
    /invalid player/,
  );
  assert.throws(
    () =>
      parseTurn(
        JSON.stringify({
          ...output,
          questions: [...output.questions, ...output.questions],
        }),
        ["a"],
        false,
      ),
    /invalid player/,
  );
  assert.throws(
    () => parseTurn(JSON.stringify({ ...output, questions: [] }), ["a"], false),
    /next question/,
  );
  assert.deepEqual(
    parseTurn(JSON.stringify(output), ["a"], true).questions,
    [],
  );
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

test("a writing voice is phrased once for both narrators, without a framing storyteller", () => {
  assert.equal(narratorLine({}), "");
  assert.match(
    narratorLine({ narratorName: "The Cat", persona: "The party's cat." }),
    /^Write the story itself in this voice \(The Cat\): The party's cat\. The voice lives in the prose: no storyteller character, no frame/,
  );
});
