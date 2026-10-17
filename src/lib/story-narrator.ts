import {
  roleplayHistory,
  roleplayNames,
  roleplayNextStep,
  roleplaySetup,
} from "./roleplay-prompt";
import type { Adventure, Player } from "./play";
// Lorekeeper's own narrator uses the same prompt strategy as the MCP server's
// roleplayView (see roleplay-prompt.ts), so both write alike. The only addition is how to hand back the
// question, mirroring save_chapter: reply without its closing question, then the question.
// The window is smaller than ChatGPT's: free provider tiers allow few tokens a minute.
const HISTORY_CHARS = 12_000;
export function storyRequest(story: Adventure, players: Player[], ending = false) {
  const solo = players.length <= 1;
  const nameOf = roleplayNames(players);
  const head = roleplaySetup(story, players);
  const history = roleplayHistory(story, players, HISTORY_CHARS);
  const prompt = [head, history, roleplayNextStep({ ...story, status: "active" }, players, ending)]
    .filter(Boolean)
    .join("\n\n");
  const ids = players.map((p) => `${nameOf(p.user_id)} = ${p.user_id}`).join(", ");
  const system = `Reply exactly as you would in a normal roleplay chat. Write your reply without its closing question, then add <lore-state>{…}</lore-state> with one JSON object: ${ending ? "" : `"question" (that question${solo ? "" : `, for everyone; or "questions": [{"player": id, "question": …}] to ask players separately, with ids ${ids}`}), `}"summary" (short notes on everything that has happened so far)${story.segments.length ? "" : `, "title" and "world" (one line on the setting)`}.`;
  return { system, prompt };
}
// Splits the reply from its <lore-state> and returns the turn in the stored shape.
export function decodeNarratorOutput(output: string, players: string[], ending: boolean) {
  const trimmed = output.trim();
  const match = trimmed.match(/\s*<lore-state>\s*([\s\S]*?)\s*<\/lore-state>\s*$/);
  if (!match || match.index === undefined)
    throw new Error("The narrator did not finish the scene correctly. Your decisions are saved; retry the scene.");
  let state: Record<string, unknown>;
  try {
    state = JSON.parse(match[1]);
  } catch {
    throw new Error("The narrator did not finish the scene correctly. Your decisions are saved; retry the scene.");
  }
  const narrative = trimmed.slice(0, match.index).trim();
  if (!narrative || narrative.length > 30000) throw new Error("AI returned an invalid story segment. Retry safely.");
  const line = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  let questions: { player: string; text: string }[] = [];
  if (!ending) {
    const each = Array.isArray(state.questions) ? state.questions : [];
    if (each.length) {
      const seen = new Set<string>();
      questions = each.map((q: { player?: unknown; question?: unknown; text?: unknown }) => {
        const player = String(q?.player || ""),
          text = line(q?.question ?? q?.text, 2000);
        if (!players.includes(player) || seen.has(player) || !text)
          throw new Error("AI returned invalid player questions. Retry safely.");
        seen.add(player);
        return { player, text };
      });
    } else {
      const text = line(state.question, 2000);
      if (!text) throw new Error("AI did not provide a next question. Retry safely.");
      questions = players.map((player) => ({ player, text }));
    }
  }
  return {
    narrative,
    questions,
    summary: line(state.summary, 12000),
    title: line(state.title, 120),
    world: line(state.world, 6000),
  };
}
