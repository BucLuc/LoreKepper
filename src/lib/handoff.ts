import { storyRequest } from "./story-narrator";
import { parseTurn, type Adventure, type Player } from "./play";
import { validateResolutions } from "./story-narrator";
export function handoffContext(story: Adventure, players: Player[]) {
  const current = story.segments.at(-1),
    waiting = (current?.questions || [])
      .filter((q) => !q.answer)
      .map((q) => ({
        id: q.player,
        name: players.find((p) => p.user_id === q.player)?.name || "Player",
      }));
  const request = storyRequest(story, players);
  const promptState = JSON.parse(request.prompt);
  delete promptState.currentPlayerActions;
  delete promptState.cast;
  delete promptState.world;
  delete promptState.title;
  let history = request.history;
  const result = {
    sessionId: story.id,
    revision: story.revision,
    status: story.status,
    title: story.title,
    world: story.world,
    voice: story.voice,
    aiMode: story.ai_mode || "api",
    ready: story.status === "active" && !waiting.length,
    waiting,
    players: players.map((p) => ({
      id: p.user_id,
      name: p.name,
      identityName: p.identity_name || "",
      description: p.description || "",
    })),
    currentActions: request.actions,
    system: request.system,
    prompt: JSON.stringify(promptState),
    history,
  };
  while (JSON.stringify(result).length > 95000 && history.length) {
    history = history.slice(1);
    result.history = history;
  }
  if (JSON.stringify(result).length > 95000)
    throw new Error(
      "This turn is too large for a ChatGPT Action. Shorten player descriptions or world settings in the lobby.",
    );
  return result;
}
export function validateHandoffTurn(
  story: Adventure,
  players: Player[],
  value: Record<string, unknown>,
) {
  if (
    !Number.isInteger(value.revision) ||
    typeof value.requestId !== "string" ||
    value.requestId.length < 1 ||
    value.requestId.length > 100
  )
    throw new Error("A revision and unique requestId are required.");
  const turn = parseTurn(
    JSON.stringify(value),
    players.map((p) => p.user_id),
    value.ending === true,
  );
  const actions = storyRequest(story, players).actions;
  const receipts = validateResolutions(
    value.resolvedActions,
    turn.narrative,
    actions,
  );
  const title =
    typeof value.title === "string"
      ? value.title.trim().slice(0, 120)
      : story.title;
  const world =
    typeof value.world === "string"
      ? value.world.trim().slice(0, 6000)
      : story.world;
  if ((!story.title && !title) || (!story.world && !world))
    throw new Error("The opening needs a title and world setting.");
  return {
    segment: {
      narrative: turn.narrative,
      questions: turn.questions,
      resolvedActions: receipts,
    },
    summary: turn.summary,
    title,
    world,
  };
}

export function canonicalPayload(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, item]) => [k, sort(item)]),
          )
        : v;
  return JSON.stringify(sort(value));
}
