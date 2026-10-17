import test from "node:test";
import assert from "node:assert/strict";
import { storyRequest, decodeNarratorOutput } from "../src/lib/story-narrator";
import { roleplayView } from "../supabase/functions/lorekeeper-mcp/server";
import { defaultVoice, type Adventure, type Player } from "../src/lib/play";
const story = {
  id: "s",
  title: "",
  world: "A serious court",
  status: "active",
  revision: 1,
  voice: { ...defaultVoice, persona: "Write like a pirate captain." },
  summary: "The quest leads north",
  segments: [
    {
      narrative: "A guard asks for your name.",
      questions: [{ player: "a", text: "Your name?", answer: "I shit my pants" }],
      created: "",
    },
  ],
} as unknown as Adventure;
const ada: Player = { user_id: "a", name: "ada_account", identity_name: "Ada", character: null };

test("Lorekeeper's narrator gets the same short prompt as ChatGPT", () => {
  const r = storyRequest(story, [ada]);
  const gpt = roleplayView(story as never, [ada]).content[0].text;
  // Same request, same history, same next step; only the saving line differs.
  assert.equal(r.prompt, gpt.slice(0, gpt.lastIndexOf("\n\n(Lorekeeper:")));
  assert.match(r.prompt, /^Make a roleplay\. Set it here: A serious court\nI make the choices\.\nI play Ada\.\nWrite like a pirate captain\./);
  assert.match(r.prompt, /\*\*Ada:\*\* I shit my pants\n\nContinue from my last choice\.$/);
  assert.doesNotMatch(r.prompt + r.system, /ada_account/);
  // The instructions stay a single short paragraph.
  assert.ok(r.system.length < 450, r.system);
  assert.match(r.system, /without its closing question/);
});

test("a theme guides the world only when the narrator chooses it", () => {
  const open = { ...story, world: "", segments: [], setup: { step: 4, theme: "pirate" } } as Adventure;
  assert.match(storyRequest(open, [ada]).prompt, /You choose the world \(pirates and the high seas\), but I make the choices\./);
  assert.match(storyRequest(open, [ada]).system, /"title" and "world"/);
  assert.doesNotMatch(storyRequest({ ...open, world: "Port Royal" }, [ada]).prompt, /pirates and the high seas/);
  assert.match(storyRequest(story, [ada], true).prompt, /end the story/);
  assert.doesNotMatch(storyRequest(story, [ada], true).system, /"question"/);
});

test("the reply is separated from its question and bookkeeping", () => {
  const prose = "The clerk drops his quill. The audience must wait.";
  const out = (state: unknown) => `${prose}\n\n<lore-state>${JSON.stringify(state)}</lore-state>`;
  const turn = decodeNarratorOutput(out({ question: "What do you do?", summary: "Interrupted." }), ["a", "b"], false);
  assert.equal(turn.narrative, prose);
  assert.equal(turn.summary, "Interrupted.");
  assert.deepEqual(turn.questions, [
    { player: "a", text: "What do you do?" },
    { player: "b", text: "What do you do?" },
  ]);
  const split = decodeNarratorOutput(out({ questions: [{ player: "b", question: "Run?" }] }), ["a", "b"], false);
  assert.deepEqual(split.questions, [{ player: "b", text: "Run?" }]);
  assert.throws(() => decodeNarratorOutput(out({ questions: [{ player: "x", question: "?" }] }), ["a"], false), /invalid player/);
  assert.throws(() => decodeNarratorOutput(out({ summary: "" }), ["a"], false), /next question/);
  assert.deepEqual(decodeNarratorOutput(out({ summary: "" }), ["a"], true).questions, []);
  assert.throws(() => decodeNarratorOutput(prose, ["a"], false), /did not finish/);
  assert.throws(() => decodeNarratorOutput(`${prose}<lore-state>{broken}</lore-state>`, ["a"], false), /did not finish/);
});
