import test from "node:test";
import assert from "node:assert/strict";
import {
  storyRequest,
  validateResolutions,
  decodeNarratorOutput,
} from "../src/lib/story-narrator";
import {
  characterSnapshot,
  defaultVoice,
  type Character,
  type Adventure,
} from "../src/lib/play";
test("current actions are authoritative inputs, independent from questions and continuity memory", () => {
  const story = {
    world: "A serious court",
    voice: { ...defaultVoice, style: "Medieval" },
    summary: "The quest leads north",
    segments: [
      {
        narrative: "A guard asks for your name.",
        questions: [
          { player: "a", text: "Your name?", answer: "I shit my pants" },
        ],
      },
    ],
  } as Adventure;
  const r = storyRequest(story, [
    { user_id: "a", name: "Ada", character: null },
  ]);
  assert.deepEqual(JSON.parse(r.prompt).currentPlayerActions, [
    { player: "a", action: "I shit my pants" },
  ]);
  assert.match(r.system, /Never ignore, sanitize/);
  assert.equal(r.history.at(-1)?.role, "assistant");
  assert.equal(r.history.at(-1)?.content, "A guard asks for your name.");
  assert.match(r.system, /Never invent a player's next action/);
  assert.match(r.system, /450–800/);
  const effect = "The guard notices your soiled breeches and steps back.";
  assert.deepEqual(
    validateResolutions(
      [{ player: "a", action: "I shit my pants", consequence: effect }],
      effect,
      r.actions,
    ),
    [{ player: "a", action: "I shit my pants", consequence: effect }],
  );
  assert.throws(
    () => validateResolutions([], "You travel north.", r.actions),
    /every submitted action/,
  );
  assert.throws(
    () =>
      validateResolutions(
        [{ player: "a", action: "I go to the toilet", consequence: effect }],
        effect,
        r.actions,
      ),
    /consequence/,
  );
  assert.throws(
    () =>
      validateResolutions(
        [{ player: "a", action: "I shit my pants", consequence: effect }],
        "You travel north.",
        r.actions,
      ),
    /consequence/,
  );
});
test("novel prose is separated from bookkeeping before rendering or export", () => {
  const prose = "The clerk drops his quill. The audience must wait.";
  const state = {
    summary: "The audience is interrupted.",
    questions: [{ player: "a", text: "What do you do?" }],
    resolvedActions: [],
  };
  const decoded = decodeNarratorOutput(
    `${prose}\n\n<lore-state>${JSON.stringify(state)}</lore-state>`,
  );
  assert.equal(decoded.narrative, prose);
  assert.equal(decoded.summary, state.summary);
  assert.deepEqual(decoded.questions, state.questions);
  assert.deepEqual(
    decodeNarratorOutput(JSON.stringify({ ...state, narrative: prose })),
    { ...state, narrative: prose },
  );
  assert.throws(() => decodeNarratorOutput(prose), /did not finish/);
  assert.throws(() =>
    decodeNarratorOutput(`${prose}<lore-state>{broken}</lore-state>`),
  );
});
test("legacy snapshots stay private while the narrator uses the story voice and optional player identity", () => {
  const c = {
    id: "a",
    name: "A cat",
    kind: "Cat",
    personality: "Mischievous",
    avatar: "🐈",
    owner_id: "private-owner",
    collection_id: "private-collection",
    voice: { ...defaultVoice, language: "French" },
  } as Character;
  const inherited = characterSnapshot(c, true);
  const own = characterSnapshot(c, false, {
    ...defaultVoice,
    language: "German",
    style: "Pirate",
  });
  assert.equal(inherited.inherit, true);
  assert.equal(own.voice.language, "German");
  assert.equal(own.voice.style, "Pirate");
  assert.equal(c.voice.language, "French");
  assert.equal(own.owner_id, undefined);
  assert.equal(own.collection_id, undefined);
  const story = {
    world: "Sea",
    voice: { ...defaultVoice, language: "English" },
    segments: [],
    summary: "",
  } as unknown as Adventure;
  const r = storyRequest(story, [
    { user_id: "a", name: "Ada", character: own },
  ]);
  assert.equal(JSON.parse(r.prompt).cast[0].voice, "Use story settings");
  assert.equal(JSON.parse(r.prompt).cast[0].character, undefined);
  assert.match(r.system, /English/);
});
