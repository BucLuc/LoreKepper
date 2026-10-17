// Lorekeeper's own narrator prompt. It follows the MCP server's roleplayView
// (supabase/functions/lorekeeper-mcp/server.ts) so the API providers write like ChatGPT
// does there; keep the two in step. It is written the way a player starts a roleplay in a normal
// chat ("make a roleplay, you choose the world but I make the choices, write like …"):
// a short, natural prompt gets the best roleplay, while a settings dossier turns it
// into a briefing to work through. Keep it that way: every extra rule makes the
// writing stiffer. Account names never appear: unnamed players get a neutral label.

export type RoleplayQuestion = { player: string; text: string; answer?: string };
export type RoleplayStory = {
  id: string;
  title: string;
  world: string;
  status: string;
  summary: string;
  revision: number;
  voice: {
    language?: string;
    style?: string;
    narratorName?: string;
    persona?: string;
  };
  segments: { narrative: string; questions: RoleplayQuestion[] }[];
  setup?: { theme?: string | null } | null;
  generating_until?: string | null;
};
export type RoleplayPlayer = {
  user_id: string;
  identity_name?: string;
  description?: string;
  character?: { name?: string; kind?: string; personality?: string } | null;
  voice?: { language?: string; style?: string; speech?: string } | null;
};

// What a theme (the narrators' mood) adds when the narrator picks the world.
export const THEME_HINTS: Record<string, string> = {
  classic: "a classic adventure",
  medieval: "something medieval",
  pirate: "pirates and the high seas",
  ancient: "ancient myths or the Far East",
  crime: "crime, mafia or the Wild West",
  eccentric: "something gloriously weird",
};
// A bare style name ("Medieval") reads as a setting rather than a way of writing,
// so each gets a short hint. Only stories from before writing voices use these.
export const STYLE_GUIDES: Record<string, string> = {
  Medieval: "old-fashioned speech (in English: thou, thee, hath, -eth)",
  Pirate: "pirate talk (in English: ye, matey, arrr)",
  Shakespearean: "Shakespearean language",
  "Dramatic anime": "over-the-top anime drama",
  Aristocratic: "posh, aristocratic speech",
};

export function roleplayNames(players: RoleplayPlayer[]) {
  const solo = players.length <= 1;
  return (id: string) => {
    const p = players.find((x) => x.user_id === id);
    if (p?.identity_name || p?.character?.name) return (p.identity_name || p.character?.name)!;
    if (solo) return "Me";
    const i = players.findIndex((x) => x.user_id === id);
    return i < 0 ? "A player" : `Player ${i + 1}`;
  };
}

export function waitingFor(story: RoleplayStory, players: RoleplayPlayer[]) {
  const nameOf = roleplayNames(players);
  return (story.segments.at(-1)?.questions || [])
    .filter((q) => q.answer === undefined)
    .map((q) => nameOf(q.player));
}

// The opening request: world, players, language and voice, a few lines at most.
export function roleplaySetup(story: RoleplayStory, players: RoleplayPlayer[]) {
  const solo = players.length <= 1;
  const nameOf = roleplayNames(players);
  const about = (p: RoleplayPlayer) =>
    p.description || (p.character ? [p.character.kind, p.character.personality].filter(Boolean).join(". ") : "");
  const end = (t: string) => (/[.!?…]$/.test(t) ? t : `${t}.`);
  const v = story.voice || {};
  const theme = story.setup?.theme ? THEME_HINTS[story.setup.theme] : "";
  const we = solo ? "I make the choices." : `we're ${players.length} players and we make the choices.`;
  const lines: string[] = [
    `Make a roleplay${story.title ? ` called "${story.title}"` : ""}. ${
      story.world
        ? `Set it here: ${story.world}\n${we.charAt(0).toUpperCase()}${we.slice(1)}`
        : `You choose the world${theme ? ` (${theme})` : ""}, but ${we}`
    }`,
  ];
  if (solo) {
    const p = players[0];
    const name = p && (p.identity_name || p.character?.name);
    const desc = p ? about(p) : "";
    if (name || desc) lines.push(name ? `I play ${name}${desc ? `: ${end(desc)}` : "."}` : `My character: ${end(desc)}`);
  } else {
    lines.push(
      `We play: ${players
        .map((p) => {
          const desc = about(p);
          return `${nameOf(p.user_id)}${desc ? ` (${desc})` : ""}`;
        })
        .join("; ")}.`,
    );
  }
  for (const p of players) {
    const own = [
      p.voice?.language && `speaks ${p.voice.language}`,
      p.voice?.speech || (p.voice?.style && `talks in ${p.voice.style} style`),
    ].filter(Boolean);
    if (own.length) lines.push(`${solo ? "My character" : nameOf(p.user_id)} ${own.join(" and ")}.`);
  }
  const language = v.language || "English";
  if (language !== "English") lines.push(`Write in ${language}.`);
  if (v.persona) lines.push(v.persona);
  else if (v.style && STYLE_GUIDES[v.style]) lines.push(`Write in ${v.style} style (${STYLE_GUIDES[v.style]}).`);
  return lines.join("\n");
}

// The story so far reads like the chat it would have been: each reply, then the choice.
// Early chapters give way to the summary once the text passes maxChars.
export function roleplayHistory(story: RoleplayStory, players: RoleplayPlayer[], maxChars: number) {
  const solo = players.length <= 1;
  const nameOf = roleplayNames(players);
  const chapters = story.segments.map((s) => {
    const same = solo || s.questions.every((x) => x.text === s.questions[0]?.text);
    const qa = s.questions.map((q) => {
      const who = nameOf(q.player);
      const asked = same ? "" : `> To ${who}: ${q.text}\n\n`;
      return `${asked}**${who}:** ${q.answer ?? "_(no answer yet)_"}`;
    });
    const question = s.questions.length && same ? `> ${s.questions[0].text}\n\n` : "";
    return `${s.narrative}\n\n${question}${qa.join("\n\n")}`.trim();
  });
  let omitted = 0;
  const size = () => chapters.slice(omitted).join("\n\n---\n\n").length;
  while (omitted < chapters.length - 1 && size() > maxChars) omitted++;
  return chapters.length
    ? `The story so far:\n\n${
        omitted ? `(The first ${omitted} chapters are left out for length.${story.summary ? ` What happened: ${story.summary}` : ""})\n\n---\n\n` : ""
      }${chapters.slice(omitted).join("\n\n---\n\n")}`
    : "";
}

// What to do now, in the player's words.
export function roleplayNextStep(story: RoleplayStory, players: RoleplayPlayer[], ending = false) {
  const solo = players.length <= 1;
  const waiting = waitingFor(story, players);
  if (story.status === "completed") return "This story is finished.";
  if (ending) return "Now end the story: write the final chapter, with no question at the end.";
  if (waiting.length)
    return `${solo ? "I haven't" : `${waiting.join(", ")} ${waiting.length === 1 ? "hasn't" : "haven't"}`} answered in Lorekeeper yet. Don't continue yet; just tell me.`;
  if (!story.segments.length) return "Start the story right away, no intro.";
  return solo ? "Continue from my last choice." : "Continue from our choices.";
}
