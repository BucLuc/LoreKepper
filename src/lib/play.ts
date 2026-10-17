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
export const themeIds = [
  "classic",
  "medieval",
  "pirate",
  "ancient",
  "crime",
  "eccentric",
] as const;
// A ready-made quest from the worlds table, or one the AI suggested for this story.
export type Quest = {
  id: string;
  theme?: string;
  title: string;
  pitch: string;
  story: string;
};
export type StorySetup = {
  step: number;
  done?: boolean;
  theme?: string | null;
  // "preset:<id>", "idea:<n>", "custom", "none" (the narrator decides), or unset.
  quest?: string | null;
  ideas?: Quest[];
  // The last Surprise me, replayed by everyone watching: n changes per spin.
  spin?: { kind: "theme" | "quest" | "voice"; value: string; n: number } | null;
};
const clip = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
export function storySetup(value: unknown): StorySetup | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const spin = v.spin as Record<string, unknown> | null | undefined;
  return {
    step: Math.min(4, Math.max(1, Math.round(Number(v.step) || 1))),
    ...(v.done === true ? { done: true } : {}),
    theme: themeIds.includes(v.theme as (typeof themeIds)[number])
      ? (v.theme as string)
      : null,
    quest:
      typeof v.quest === "string" &&
      /^(preset:[a-z0-9-]{2,40}|idea:\d|custom|none)$/.test(v.quest)
        ? v.quest
        : null,
    ideas: (Array.isArray(v.ideas) ? v.ideas : [])
      .slice(0, 6)
      .map((q: Record<string, unknown>, i: number) => ({
        id: `idea:${i}`,
        title: clip(q?.title, 80),
        pitch: clip(q?.pitch, 200),
        story: clip(q?.story, 1500),
      }))
      .filter((q) => q.title && q.story),
    spin:
      spin &&
      ["theme", "quest", "voice"].includes(spin.kind as string) &&
      typeof spin.value === "string"
        ? {
            kind: spin.kind as "theme" | "quest" | "voice",
            value: spin.value.slice(0, 60),
            n: Math.round(Number(spin.n) || 0),
          }
        : null,
  };
}
export type NarratorPreset = {
  id: string;
  name: string;
  mood: "classic" | "medieval" | "pirate" | "ancient" | "crime" | "eccentric";
  blurb: string;
  sample: string;
};
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
  // "shared" or one of the creator's providers; null: their key, else shared.
  ai_provider?: string | null;
  // The setup wizard's progress; null for stories that open straight in the lobby.
  setup?: StorySetup | null;
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
export type PlayerVoice = {
  language?: string;
  style?: string;
  // A writing-voice preset id and the line it stands for ("talks like a pirate captain").
  narrator?: string;
  speech?: string;
};
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
  // A writing-voice preset for how this character talks; the server adds its text.
  const narrator =
    typeof v.narrator === "string" && /^[a-z0-9-]{2,40}$/.test(v.narrator)
      ? v.narrator
      : "";
  return language || style || narrator
    ? {
        ...(language ? { language } : {}),
        ...(narrator ? { narrator } : style ? { style } : {}),
      }
    : null;
}
// "Write like a pirate captain." → "talks like a pirate captain".
export function speechLine(persona: string) {
  return persona
    .trim()
    .replace(/\.$/, "")
    .replace(/^Write (?=like|in )/, "talks ");
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
