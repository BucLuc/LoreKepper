import { prepareEntries, type Exhibit } from "./archive";
import type { EditionDesign } from "./edition-design";
export const styles = [
  "Modern",
  "Medieval",
  "Pirate",
  "Shakespearean",
  "Dramatic anime",
  "Aristocratic",
] as const;
export const tones = [
  "Default",
  "Angry",
  "Romantic",
  "Serious",
  "Absurd",
] as const;
export const avatars = [
  "🧙",
  "🛡️",
  "🏴‍☠️",
  "🐈",
  "🐉",
  "🦊",
  "🤖",
  "👑",
  "🧝",
  "👻",
  "🦉",
  "🌟",
];
export type Voice = {
  language: string;
  style: string;
  tone: string;
  scope: "dialogue" | "entire";
  // Who tells the story: a preset id from the narrators table, or "custom".
  // The persona is copied in when chosen, so the story keeps its narrator.
  narrator?: string;
  narratorName?: string;
  persona?: string;
};
export type NarratorPreset = {
  id: string;
  name: string;
  mood: "pirate" | "medieval" | "comedic" | "atmospheric" | "wildcard";
  blurb: string;
  sample: string;
};
// One shared phrasing for both narrators (Lorekeeper's own and ChatGPT). A preset
// is a writing voice: it lives in the prose, never in a storyteller who frames it.
export function narratorLine(v: Partial<Voice>) {
  return v.persona
    ? `Write the story itself in this voice${v.narratorName ? ` (${v.narratorName})` : ""}: ${v.persona} The voice lives in the prose: no storyteller character, no frame, nobody talking to a listener or the reader.`
    : "";
}
export const defaultVoice: Voice = {
  language: "English",
  style: "Modern",
  tone: "Default",
  scope: "dialogue",
};
export type Character = {
  id: string;
  owner_id?: string;
  collection_id?: string | null;
  name: string;
  kind: string;
  personality: string;
  avatar: string;
  voice: Voice;
  inherit?: boolean;
};
export type Question = { player: string; text: string; answer?: string };
export type Segment = {
  narrative: string;
  questions: Question[];
  created: string;
};
export type Adventure = {
  id: string;
  owner_id: string;
  title: string;
  status: "lobby" | "active" | "paused" | "completed";
  mode: string;
  ai_mode?: "api" | "chatgpt";
  world: string;
  voice: Voice;
  edition: string;
  design: EditionDesign;
  segments: Segment[];
  // Sections of the chapter ChatGPT is writing right now.
  draft?: { parts: string[] } | null;
  summary: string;
  revision: number;
  generating_until?: string | null;
  last_error?: string | null;
  created_at?: string;
};
// A player's own language/style for their character; empty fields follow the story.
export type PlayerVoice = { language?: string; style?: string };
export type Player = {
  user_id: string;
  name: string;
  character: Character | null;
  description?: string;
  identity_name?: string;
  voice?: PlayerVoice | null;
};
export function playerVoice(value: unknown): PlayerVoice | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const language =
    typeof v.language === "string" ? v.language.trim().slice(0, 60) : "";
  const style = styles.includes(v.style as (typeof styles)[number])
    ? (v.style as string)
    : "";
  return language || style
    ? { ...(language ? { language } : {}), ...(style ? { style } : {}) }
    : null;
}
export function voice(value: Partial<Voice> = {}): Voice {
  return {
    language:
      typeof value.language === "string" && value.language.trim()
        ? value.language.trim().slice(0, 60)
        : "English",
    style: styles.includes(value.style as (typeof styles)[number])
      ? value.style!
      : "Modern",
    tone: tones.includes(value.tone as (typeof tones)[number])
      ? value.tone!
      : "Default",
    scope: value.scope === "entire" ? "entire" : "dialogue",
  };
}
export function voicePrompt(v: Voice, character = false) {
  return `Write in ${v.language}. Writing style: ${v.style}. ${character ? "Apply this voice to this character’s dialogue and portrayal only." : v.scope === "dialogue" ? "Keep narration in natural contemporary language; apply the writing style to dialogue only." : "Apply the writing style to narration and dialogue."} ${v.tone === "Default" ? "Choose emotion, drama and occasional humor naturally from the style and scene. Default does not mean emotionally neutral. Keep creative freedom." : `Emphasize a ${v.tone.toLowerCase()} tone.`} Vary vocabulary and rhythm; avoid catchphrases, forced jokes and repetition.`;
}
export function characterSnapshot(
  c: Character,
  inherit = true,
  custom?: Partial<Voice>,
): Character {
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    personality: c.personality,
    avatar: c.avatar,
    inherit,
    voice: voice(custom),
  };
}
function characterLabel(players: Player[], id: string) {
  const name = players.find((p) => p.user_id === id)?.identity_name;
  return name ? `**${name}:** ` : "";
}
export function storyMarkdown(
  s: Adventure,
  players: Player[],
  interactions: boolean,
  hidden: string[] = [],
) {
  return s.segments
    .map(
      (part, scene) =>
        part.narrative +
        (interactions
          ? part.questions
              .map((q, question) =>
                hidden.includes(`${scene}-${question}`)
                  ? "\n\n---\n\nQuestion\n\n---"
                  : // The story only names characters, never accounts.
                    `\n\n> ${characterLabel(players, q.player)}${q.text}${q.answer ? `\n\n**Decision:** ${q.answer}` : ""}`,
              )
              .join("")
          : ""),
    )
    .join("\n\n");
}
export function storyEntry(
  s: Adventure,
  players: Player[],
  interactions: boolean,
  hidden: string[] = [],
): Exhibit {
  return prepareEntries([
    {
      id: s.id,
      title: s.title,
      type: "story",
      score: 0,
      reason: "Interactive adventure",
      source: "LoreKeeper",
      messages: [
        {
          id: s.id,
          author: players.map((p) => p.name).join(" & ") || "Narrator",
          // Account names are already display names; skip chat-import author normalization.
          userId: s.owner_id,
          timestamp: s.segments[0]?.created || "",
          content:
            storyMarkdown(s, players, interactions, hidden) ||
            "*Your story is about to begin…*",
          source: "LoreKeeper",
          sourceFormat: "markdown",
        },
      ],
    },
  ])[0];
}
export function parseTurn(text: string, players: string[], ending: boolean) {
  const data = JSON.parse(
    text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
  );
  if (
    typeof data.narrative !== "string" ||
    !data.narrative.trim() ||
    data.narrative.length > 16000 ||
    typeof data.summary !== "string" ||
    data.summary.length > 12000 ||
    !Array.isArray(data.questions)
  )
    throw new Error("AI returned an invalid story segment. Retry safely.");
  const seen = new Set<string>();
  const questions: Question[] = ending
    ? []
    : data.questions.map((q: Question) => {
        if (
          !players.includes(q.player) ||
          seen.has(q.player) ||
          typeof q.text !== "string" ||
          !q.text.trim() ||
          q.text.length > 2000
        )
          throw new Error(
            "AI returned invalid player questions. Retry safely.",
          );
        seen.add(q.player);
        return { player: q.player, text: q.text };
      });
  if (!ending && !questions.length)
    throw new Error("AI did not provide a next question. Retry safely.");
  return { narrative: data.narrative, summary: data.summary, questions };
}
