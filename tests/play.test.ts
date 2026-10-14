import test from "node:test";
import assert from "node:assert/strict";
import {
  voice,
  voicePrompt,
  parseTurn,
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
      [{ user_id: "a", name: "Ada", character: null }],
      true,
    );
  assert.equal(clean, "First scene.\n\nThey stayed.");
  assert.ok(full.indexOf("First scene.") < full.indexOf("Stay."));
  assert.ok(full.indexOf("Stay.") < full.indexOf("They stayed."));
  assert.match(full, /Ada/);
  assert.equal(story.segments[0].questions[0].answer, "Stay.");
});
