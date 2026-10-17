// Lorekeeper MCP server for ChatGPT: the request handler behind index.ts.
//
// The tools only load and save story data; they never steer the storytelling.
// Sign-in uses Supabase Auth's OAuth 2.1 server, so each ChatGPT user only reaches
// the stories their own Lorekeeper account owns. Deploy with JWT verification OFF:
// the function checks the OAuth token itself and must answer discovery requests.
//
// Stateless Streamable HTTP transport: every JSON-RPC POST gets a JSON reply.

type DbResult = { data: unknown; error: { message: string } | null };
export type Deps = {
  rpc(fn: string, args: Record<string, unknown>): Promise<DbResult>;
  userFor(token: string): Promise<string | null>;
  supabaseUrl: string;
  appUrl?: string;
};

type Question = { player: string; text: string; answer?: string };
type Segment = { narrative: string; questions: Question[]; created?: string };
type Story = {
  id: string;
  title: string;
  world: string;
  status: string;
  summary: string;
  revision: number;
  voice: {
    language?: string;
    style?: string;
    tone?: string;
    scope?: string;
    narratorName?: string;
    persona?: string;
  };
  segments: Segment[];
  draft?: { parts?: string[] } | null;
  generating_until?: string | null;
};
type Player = {
  user_id: string;
  // The account name is deliberately not loaded; see roleplayView.
  name?: string;
  identity_name?: string;
  description?: string;
  character?: { name?: string; kind?: string; personality?: string } | null;
  voice?: { language?: string; style?: string; speech?: string } | null;
};

const FUNCTION_NAME = "lorekeeper-mcp";
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_CONTEXT = 400_000;
// Matches presetDesign("glorious") with the cover hidden, as the app uses for imports.
const IMPORT_DESIGN = {
  pages: false,
  showCover: false,
  background: "glorious",
  header: "glorious",
  body: "glorious",
  footer: "glorious",
  font: "default",
  border: true,
  artwork: true,
  columns: "preset",
  initial: "preset",
  numbering: "preset",
  cover: null,
  endPage: null,
};
// A bare style name ("Medieval") reads as a setting rather than a way of writing,
// so each gets a short hint. Kept light on purpose: long style rules make the
// writing stiff.
const STYLE_GUIDES: Record<string, string> = {
  Medieval: "old-fashioned speech (in English: thou, thee, hath, -eth)",
  Pirate: "pirate talk (in English: ye, matey, arrr)",
  Shakespearean: "Shakespearean language",
  "Dramatic anime": "over-the-top anime drama",
  Aristocratic: "posh, aristocratic speech",
};
function styleGuide(style?: string) {
  return style && STYLE_GUIDES[style] ? `${style} — ${STYLE_GUIDES[style]}` : "";
}
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};

const INSTRUCTIONS = `Lorekeeper is the user's story library. These tools only load and save stories. Roleplay just as you normally would in ChatGPT: free-form, no game mechanics.

- "Start: <sessionId>": load it with get_roleplay and write your next roleplay reply in the chat, exactly as you would in a normal ChatGPT roleplay. Then save it with save_chapter: the reply unchanged as the chapter, and the question it ends on as the question for the player(s).
- "Continue": load the same session again (list_roleplays if you don't know it). The players answered in Lorekeeper; carry on from their answers the same way.
- "Save this roleplay to Lorekeeper" after playing here: save_roleplay with your replies as chapters, unchanged, and the user's replies as answers. Reuse the returned sessionId for later saves.
- An uploaded Markdown story + "Save this to Lorekeeper": import_story with the content unchanged.`;

const sessionId = {
  type: "string",
  description: "Lorekeeper session ID (a UUID).",
};
const tools = [
  {
    name: "list_roleplays",
    title: "List Lorekeeper roleplays",
    description:
      "Lists the user's most recent Lorekeeper stories with their session IDs.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_roleplay",
    title: "Load a Lorekeeper roleplay",
    description:
      "Loads a roleplay's settings (language, world, players and their descriptions) and its complete history: every chapter with the questions asked and the answers the players gave in Lorekeeper. Call it for 'Start: <id>' and again for every 'Continue'.",
    inputSchema: {
      type: "object",
      properties: { sessionId },
      required: ["sessionId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "save_chapter",
    title: "Save the chapter to Lorekeeper",
    description:
      "Saves the roleplay reply you just wrote in the chat as the next chapter in Lorekeeper, plus the question the players answer there (shown below the chapter). Use the revision returned by get_roleplay.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId,
        revision: {
          type: "integer",
          description: "The revision returned by get_roleplay.",
        },
        chapter: {
          type: "string",
          description:
            "Your reply exactly as you wrote it in the chat (Markdown), without the closing question.",
        },
        question: {
          type: "string",
          description: "The question for the player (every player, if several).",
        },
        questions: {
          type: "array",
          description:
            "Instead of question: a separate question per player, using player IDs from get_roleplay.",
          items: {
            type: "object",
            properties: {
              playerId: { type: "string" },
              question: { type: "string" },
            },
            required: ["playerId", "question"],
            additionalProperties: false,
          },
        },
        title: {
          type: "string",
          description: "Story title, if the session has none yet.",
        },
        world: {
          type: "string",
          description: "Short description of the setting, if the session has none yet.",
        },
        summary: {
          type: "string",
          description:
            "Optional continuity notes, used if the story is later continued with Lorekeeper's built-in narrator.",
        },
        ending: {
          type: "boolean",
          description: "True only if this chapter ends the story (no question).",
        },
      },
      required: ["sessionId", "revision", "chapter"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "save_roleplay",
    title: "Save this roleplay to Lorekeeper",
    description:
      "Saves a roleplay played in this ChatGPT conversation as a Lorekeeper story that can be read and continued in Lorekeeper. Each narrator reply becomes a chapter (unchanged), the question that ended it becomes the chapter's question, and the user's reply to it becomes the answer.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        world: { type: "string", description: "Short description of the setting." },
        language: { type: "string", description: "Language of the story, e.g. English or Deutsch." },
        character: {
          type: "object",
          description: "The user's character, as established in the roleplay.",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
          },
          additionalProperties: false,
        },
        chapters: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              markdown: {
                type: "string",
                description: "The narrator reply, unchanged, without its closing question.",
              },
              question: {
                type: "string",
                description: "The question that ended this reply, if any.",
              },
              answer: {
                type: "string",
                description: "The user's reply to it, unchanged. Omit for an unanswered last chapter.",
              },
            },
            required: ["markdown"],
            additionalProperties: false,
          },
        },
        summary: {
          type: "string",
          description: "Optional continuity notes for Lorekeeper's built-in narrator.",
        },
        finished: {
          type: "boolean",
          description: "True if the story has ended.",
        },
        sessionId: {
          type: "string",
          description:
            "Only when updating a roleplay already saved from this conversation: replaces its chapters with these.",
        },
      },
      required: ["title", "chapters"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "import_story",
    title: "Import a Markdown story into Lorekeeper",
    description:
      "Saves an existing Markdown story (for example an uploaded file) to the user's Lorekeeper library, content unchanged. For a story longer than about 80,000 characters, send the first part, then each further part with appendToSessionId.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        markdown: {
          type: "string",
          description: "The story's Markdown, unchanged.",
        },
        world: { type: "string", description: "Short description of the setting." },
        summary: { type: "string", description: "Short summary of the story." },
        appendToSessionId: {
          type: "string",
          description: "Session ID returned for the first part, when sending a further part.",
        },
      },
      required: ["title", "markdown"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
];

class ToolError extends Error {}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const resource = `${deps.supabaseUrl}/functions/v1/${FUNCTION_NAME}`;
  const metadataUrl = `${resource}/.well-known/oauth-protected-resource`;
  const path = new URL(req.url).pathname;
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (path.endsWith("/.well-known/oauth-protected-resource"))
    return json({
      resource,
      resource_name: "Lorekeeper",
      authorization_servers: [`${deps.supabaseUrl}/auth/v1`],
      bearer_methods_supported: ["header"],
    });
  if (req.method !== "POST")
    return new Response(null, { status: 405, headers: { ...cors, Allow: "POST" } });

  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const user = token ? await deps.userFor(token).catch(() => null) : null;
  if (!user)
    return json(
      { error: "unauthorized", error_description: "Sign in to Lorekeeper." },
      401,
      {
        "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl}"${token ? ', error="invalid_token"' : ""}`,
      },
    );

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }
  const batch = Array.isArray(body);
  const replies = [];
  for (const message of batch ? (body as unknown[]) : [body]) {
    const reply = await respond(message, user, deps);
    if (reply) replies.push(reply);
  }
  if (!replies.length) return new Response(null, { status: 202, headers: cors });
  return json(batch ? replies : replies[0]);
}

async function respond(message: unknown, user: string, deps: Deps) {
  const m = message as { id?: string | number; method?: unknown; params?: Record<string, unknown> };
  if (!m || typeof m !== "object") return rpcError(null, -32600, "Invalid request");
  // Responses to server requests are ignored; this server never sends any.
  if (typeof m.method !== "string") return null;
  // Notifications (no id) need no reply.
  if (m.id === undefined) return null;
  switch (m.method) {
    case "initialize": {
      const requested = String(m.params?.protocolVersion || "");
      return rpcResult(m.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "lorekeeper", title: "Lorekeeper", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return rpcResult(m.id, {});
    case "tools/list":
      return rpcResult(m.id, { tools });
    case "tools/call": {
      const name = String(m.params?.name || "");
      if (!tools.some((t) => t.name === name))
        return rpcError(m.id, -32602, `Unknown tool: ${name}`);
      try {
        const args = (m.params?.arguments || {}) as Record<string, unknown>;
        return rpcResult(m.id, await runTool(name, args, user, deps));
      } catch (e) {
        const text =
          e instanceof ToolError ? e.message : "Lorekeeper could not complete this request.";
        if (!(e instanceof ToolError)) console.error(e);
        return rpcResult(m.id, { content: [{ type: "text", text }], isError: true });
      }
    }
    default:
      return rpcError(m.id, -32601, `Method not found: ${m.method}`);
  }
}

async function runTool(name: string, args: Record<string, unknown>, user: string, deps: Deps) {
  const call = async (fn: string, params: Record<string, unknown>) => {
    const r = await deps.rpc(fn, params);
    if (r.error) {
      const msg = r.error.message;
      throw new ToolError(
        /does not exist|could not find the function/i.test(msg)
          ? "Lorekeeper's database is missing the ChatGPT migration (202610150002_chatgpt_mcp.sql)."
          : msg,
      );
    }
    return r.data;
  };
  const link = (id: string) => (deps.appUrl ? `${deps.appUrl.replace(/\/$/, "")}/interactive/${id}` : undefined);

  if (name === "list_roleplays") {
    const list = (await call("mcp_list_roleplays", { u: user })) as {
      id: string;
      title: string;
      status: string;
      chapters: number;
    }[];
    const text = list.length
      ? list.map((s) => `- ${s.title || "Untitled"} (${s.status}, ${s.chapters} chapters): ${s.id}`).join("\n")
      : "No Lorekeeper stories yet.";
    return { content: [{ type: "text", text }], structuredContent: { roleplays: list } };
  }

  if (name === "get_roleplay") {
    const id = uuid(args.sessionId, "sessionId");
    const { story, players } = (await call("mcp_get_roleplay", { u: user, a: id })) as {
      story: Story;
      players: Player[];
    };
    return roleplayView(story, players, link(id));
  }

  if (name === "save_chapter") {
    const id = uuid(args.sessionId, "sessionId");
    if (!Number.isInteger(args.revision)) throw new ToolError("revision must be the integer from get_roleplay.");
    // Without chapter text, a half-written draft (from the earlier live mode) is used.
    const chapter = str(args.chapter, "chapter", 60_000) ?? null;
    const ending = args.ending === true;
    const { players } = (await call("mcp_get_roleplay", { u: user, a: id })) as { players: Player[] };
    let questions: Question[] = [];
    if (!ending) {
      if (Array.isArray(args.questions) && args.questions.length) {
        questions = args.questions.map((q: { playerId?: unknown; question?: unknown }) => {
          const player = String(q?.playerId || "");
          if (!players.some((p) => p.user_id === player))
            throw new ToolError(`Unknown playerId ${player}. Use the player IDs from get_roleplay.`);
          return { player, text: str(q.question, "question", 2000, true)! };
        });
        if (new Set(questions.map((q) => q.player)).size !== questions.length)
          throw new ToolError("Ask each player at most one question.");
      } else {
        const text = str(args.question, "question", 2000, true);
        questions = players.map((p) => ({ player: p.user_id, text: text! }));
      }
    }
    const saved = (await call("mcp_save_chapter", {
      u: user,
      a: id,
      r: args.revision,
      chapter,
      questions,
      story_title: str(args.title, "title", 120) ?? "",
      story_world: str(args.world, "world", 6000) ?? "",
      memory: str(args.summary, "summary", 12_000) ?? null,
      ending,
    })) as { revision: number; chapter: number; duplicate: boolean };
    const url = link(id);
    const text = ending
      ? `Saved the final chapter (${saved.chapter}). The story is complete in Lorekeeper${url ? `: ${url}` : "."}`
      : `Saved chapter ${saved.chapter} to Lorekeeper. The players answer there${url ? ` (${url})` : ""}; when they have, the user says "Continue".`;
    return { content: [{ type: "text", text }], structuredContent: { sessionId: id, ...saved, url } };
  }

  if (name === "save_roleplay") {
    const chapters = Array.isArray(args.chapters) ? args.chapters : [];
    if (!chapters.length) throw new ToolError("Include at least one chapter.");
    const finished = args.finished === true;
    const existing = args.sessionId === undefined ? null : uuid(args.sessionId, "sessionId");
    const created = new Date().toISOString();
    const segments: Segment[] = chapters.map(
      (c: { markdown?: unknown; question?: unknown; answer?: unknown }, i: number) => {
        const last = i === chapters.length - 1;
        const question = str(c?.question, "question", 2000);
        const answer = str(c?.answer, "answer", 6000);
        const asked = question || answer || !last || !finished;
        return {
          narrative: str(c?.markdown, `chapters[${i}].markdown`, 60_000, true)!,
          questions: asked
            ? [{ player: user, text: question || "What do you do?", ...(answer ? { answer } : {}) }]
            : [],
          created,
        };
      },
    );
    const character = (args.character || {}) as { name?: unknown; description?: unknown };
    const payload = {
      existing,
      title: str(args.title, "title", 120, true)!,
      world: str(args.world, "world", 6000) ?? "",
      summary: str(args.summary, "summary", 12_000) ?? "",
      language: str(args.language, "language", 60) || "English",
      identity: str(character.name, "character.name", 100) ?? "",
      about: str(character.description, "character.description", 2000) ?? "",
      narratives: segments.map((s) => [s.narrative, s.questions]),
      finished,
    };
    const id = (await call("mcp_save_roleplay", {
      u: user,
      a: existing,
      digest: await digest({ user, ...payload }),
      story_title: payload.title,
      story_world: payload.world,
      memory: payload.summary,
      story_voice: { language: payload.language, style: "Modern", tone: "Default", scope: "entire" },
      identity: payload.identity,
      about: payload.about,
      chapters: segments,
      finished,
      design: IMPORT_DESIGN,
    })) as string;
    const url = link(id);
    return {
      content: [
        {
          type: "text",
          text: `Saved "${payload.title}" to Lorekeeper with ${segments.length} chapters${url ? `: ${url}` : "."} Session ID: ${id}. ${finished ? "" : "It can be continued in Lorekeeper, or here with \"Continue\"."}`.trim(),
        },
      ],
      structuredContent: { sessionId: id, chapters: segments.length, url },
    };
  }

  // import_story
  const markdown = str(args.markdown, "markdown", 100_000, true)!;
  if (args.appendToSessionId !== undefined) {
    const id = uuid(args.appendToSessionId, "appendToSessionId");
    const r = (await call("mcp_append_story", { u: user, a: id, markdown })) as { parts: number };
    return {
      content: [{ type: "text", text: `Appended part ${r.parts} to the story in Lorekeeper.` }],
      structuredContent: { sessionId: id, parts: r.parts, url: link(id) },
    };
  }
  const title = str(args.title, "title", 120, true)!;
  const world = str(args.world, "world", 6000) ?? "";
  const summary = str(args.summary, "summary", 12_000) ?? "";
  const hash = await digest({ user, title, world, summary, markdown });
  const id = (await call("import_gpt_story", {
    u: user,
    request_id: hash,
    digest: hash,
    story_title: title,
    story_world: world,
    memory: summary,
    markdown,
    edition: "glorious",
    design: IMPORT_DESIGN,
  })) as string;
  const url = link(id);
  return {
    content: [
      {
        type: "text",
        text: `Imported "${title}" into the Lorekeeper library${url ? `: ${url}` : "."} Session ID: ${id}.`,
      },
    ],
    structuredContent: { sessionId: id, url },
  };
}

// Written the way a player starts a roleplay in a normal chat ("make a roleplay,
// you choose the world but I make the choices, write like …"): a short, natural
// prompt gets ChatGPT's best roleplay, while a settings dossier turns it into a
// briefing to work through. Saving details stay in one line at the very end.
// Account names never appear: unnamed players get a neutral label.
export function roleplayView(story: Story, players: Player[], url?: string) {
  const solo = players.length <= 1;
  const nameOf = (id: string) => {
    const p = players.find((x) => x.user_id === id);
    if (p?.identity_name || p?.character?.name) return (p.identity_name || p.character?.name)!;
    if (solo) return "Me";
    const i = players.findIndex((x) => x.user_id === id);
    return i < 0 ? "A player" : `Player ${i + 1}`;
  };
  const about = (p: Player) =>
    p.description || (p.character ? [p.character.kind, p.character.personality].filter(Boolean).join(". ") : "");
  const v = story.voice || {};
  const language = v.language || "English";
  const last = story.segments.at(-1);
  const waiting = (last?.questions || []).filter((q) => q.answer === undefined).map((q) => nameOf(q.player));

  const setup: string[] = [
    `Make a roleplay${story.title ? ` called "${story.title}"` : ""}. ${
      story.world ? `Set it here: ${story.world}` : "You choose the world"
    }${story.world ? "\n" : ", but "}${solo ? "I make the choices." : `${story.world ? "W" : "w"}e're ${players.length} players and we make the choices.`}`,
  ];
  if (solo) {
    const p = players[0];
    const name = p && (p.identity_name || p.character?.name);
    const desc = p ? about(p) : "";
    const end = (t: string) => (/[.!?…]$/.test(t) ? t : `${t}.`);
    if (name || desc) setup.push(name ? `I play ${name}${desc ? `: ${end(desc)}` : "."}` : `My character: ${end(desc)}`);
  } else {
    setup.push(
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
    if (own.length) setup.push(`${solo ? "My character" : nameOf(p.user_id)} ${own.join(" and ")}.`);
  }
  if (language !== "English") setup.push(`Write in ${language}.`);
  if (v.persona) setup.push(v.persona);
  else if (styleGuide(v.style)) setup.push(`Write in ${v.style} style (${STYLE_GUIDES[v.style!]}).`);

  // The story so far reads like the chat it would have been: each reply, then the choice.
  const chapters = story.segments.map((s) => {
    const qa = s.questions.map((q) => {
      const who = nameOf(q.player);
      const asked = solo || s.questions.every((x) => x.text === q.text) ? "" : `> To ${who}: ${q.text}\n\n`;
      return `${asked}**${who}:** ${q.answer ?? "_(no answer yet)_"}`;
    });
    const question = s.questions.length && (solo || s.questions.every((x) => x.text === s.questions[0].text))
      ? `> ${s.questions[0].text}\n\n`
      : "";
    return `${s.narrative}\n\n${question}${qa.join("\n\n")}`;
  });
  const nextStep =
    story.status === "completed"
      ? "This story is finished."
      : story.generating_until && new Date(story.generating_until) > new Date()
        ? "Lorekeeper's own narrator is writing right now. Try again shortly."
        : waiting.length
          ? `${solo ? "I haven't" : `${waiting.join(", ")} ${waiting.length === 1 ? "hasn't" : "haven't"}`} answered in Lorekeeper yet. Don't continue yet; just tell me.`
          : story.segments.length
            ? solo
              ? "Continue from my last choice."
              : "Continue from our choices."
            : "Start the story right away, no intro.";
  const multi = solo
    ? ""
    : ` For different questions per player, use questions with these playerIds: ${players.map((p) => `${nameOf(p.user_id)} = ${p.user_id}`).join(", ")}.`;
  const footer = `(Lorekeeper: after your reply, save it with save_chapter: sessionId ${story.id}, revision ${story.revision}, chapter = your reply without its closing question, question = that question.${multi})`;

  const head = setup.join("\n");
  let omitted = 0;
  const size = () => head.length + chapters.slice(omitted).join("\n\n---\n\n").length;
  while (omitted < chapters.length - 1 && size() > MAX_CONTEXT) omitted++;
  const history = chapters.length
    ? `\n\nThe story so far:\n\n${
        omitted ? `(The first ${omitted} chapters are left out for length.${story.summary ? ` What happened: ${story.summary}` : ""})\n\n---\n\n` : ""
      }${chapters.slice(omitted).join("\n\n---\n\n")}`
    : "";
  return {
    content: [{ type: "text", text: `${head}${history}${nextStep ? `\n\n${nextStep}` : ""}\n\n${footer}` }],
    structuredContent: {
      sessionId: story.id,
      revision: story.revision,
      status: story.status,
      chapters: story.segments.length,
      ready: story.status !== "completed" && !waiting.length,
      waitingFor: waiting,
      players: players.map((p) => ({ playerId: p.user_id, name: nameOf(p.user_id) })),
      nextStep,
      url,
    },
  };
}

function str(v: unknown, field: string, max: number, required = false): string | undefined {
  if (v === undefined || v === null || (typeof v === "string" && !v.trim() && !required)) {
    if (required) throw new ToolError(`${field} is required.`);
    return undefined;
  }
  if (typeof v !== "string" || (required && !v.trim())) throw new ToolError(`${field} must be text.`);
  if (v.length > max) throw new ToolError(`${field} is longer than ${max} characters.`);
  return v.trim();
}
function uuid(v: unknown, field: string) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))
    throw new ToolError(`${field} must be a Lorekeeper session ID (UUID).`);
  return s.toLowerCase();
}
async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", ...headers },
  });
}
