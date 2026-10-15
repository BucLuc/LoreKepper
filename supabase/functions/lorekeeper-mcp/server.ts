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
  voice?: { language?: string; style?: string } | null;
};

const FUNCTION_NAME = "lorekeeper-mcp";
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_CONTEXT = 400_000;
// Parts stay small enough that the players start reading early.
const SECTION_MAX = 5_000;
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

const INSTRUCTIONS = `Lorekeeper is the user's story library. These tools only load and save stories; they don't tell you how to tell them. Roleplay just as you normally would in ChatGPT: free-form, no game mechanics.

- "Start: <sessionId>": load it with get_roleplay and write the next chapter. Send it to Lorekeeper with write_section as you go (the players read it live there; the parts don't make the chapter any shorter), then call save_chapter with the question for the player(s). In the chat, just say briefly that it's in Lorekeeper.
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
    name: "write_section",
    title: "Write a section into Lorekeeper",
    description:
      "Sends the next part of the chapter you are writing to Lorekeeper, where the players read it live. Parts only change how the chapter is delivered, not how long it is: write the chapter at its natural full length and send it in as many parts as that takes, each as soon as it's written, numbered from 1 (sectionNumber 1 starts the chapter over). Call save_chapter with the question once the chapter is complete.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId,
        revision: {
          type: "integer",
          description: "The revision returned by get_roleplay (unchanged by sections).",
        },
        sectionNumber: { type: "integer", minimum: 1 },
        section: {
          type: "string",
          description: "This part in Markdown, without the closing question.",
        },
        title: {
          type: "string",
          description: "Story title, if the session has none yet.",
        },
        world: {
          type: "string",
          description: "Short description of the setting, if the session has none yet.",
        },
      },
      required: ["sessionId", "revision", "sectionNumber", "section"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "save_chapter",
    title: "Finish the chapter in Lorekeeper",
    description:
      "Finishes the chapter you wrote with write_section and adds the question the players answer in Lorekeeper (shown below the chapter). Use the revision returned by get_roleplay.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId,
        revision: {
          type: "integer",
          description: "The revision returned by get_roleplay.",
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
      required: ["sessionId", "revision"],
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

  if (name === "write_section") {
    const id = uuid(args.sessionId, "sessionId");
    if (!Number.isInteger(args.revision)) throw new ToolError("revision must be the integer from get_roleplay.");
    if (!Number.isInteger(args.sectionNumber) || (args.sectionNumber as number) < 1)
      throw new ToolError("sectionNumber must be 1, 2, 3 …");
    const saved = (await call("mcp_write_section", {
      u: user,
      a: id,
      r: args.revision,
      part: section(args.section),
      n: args.sectionNumber,
      story_title: str(args.title, "title", 120) ?? "",
      story_world: str(args.world, "world", 6000) ?? "",
    })) as { section: number; duplicate: boolean };
    return {
      content: [
        {
          type: "text",
          text: `Part ${saved.section} is in Lorekeeper. Keep writing; call save_chapter only when the chapter is complete.`,
        },
      ],
      structuredContent: { sessionId: id, ...saved },
    };
  }

  if (name === "save_chapter") {
    const id = uuid(args.sessionId, "sessionId");
    if (!Number.isInteger(args.revision)) throw new ToolError("revision must be the integer from get_roleplay.");
    // Without chapter text, the sections sent with write_section form the chapter.
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

// Plain data for the model: settings plus the complete history as readable Markdown.
export function roleplayView(story: Story, players: Player[], url?: string) {
  // Account names never reach the model: unnamed players get a neutral label
  // and stay unnamed in the story until they name themselves.
  const nameOf = (id: string) => {
    const p = players.find((x) => x.user_id === id);
    if (p?.identity_name || p?.character?.name) return (p.identity_name || p.character?.name)!;
    if (players.length === 1) return "The player";
    const i = players.findIndex((x) => x.user_id === id);
    return i < 0 ? "A player" : `Player ${i + 1}`;
  };
  const named = (p: Player) => !!(p.identity_name || p.character?.name);
  const last = story.segments.at(-1);
  const draft = story.draft?.parts || [];
  const waiting = (last?.questions || []).filter((q) => q.answer === undefined).map((q) => nameOf(q.player));
  const v = story.voice || {};
  const language = v.language || "English";
  // A writing voice replaces the older writing styles for the story as a whole. It
  // lives in the prose; a framed storyteller would talk to the reader instead.
  const narrator = v.persona
    ? `${v.narratorName ? `${v.narratorName} — ` : ""}${v.persona} (the story itself is written this way: no storyteller character, no frame, nobody talking to the reader)`
    : "";
  const guide = narrator ? "" : styleGuide(v.style);
  const style = [
    guide && `${guide}${v.scope === "dialogue" ? " (dialogue only)" : ""}`,
    v.tone && v.tone !== "Default" ? `${v.tone.toLowerCase()} tone` : "",
  ].filter(Boolean);
  const voiceNote = `in ${language}${narrator ? `, in the ${v.narratorName || "chosen"} voice` : guide ? `, ${v.style} style` : ""}`;
  const nextStep =
    story.status === "completed"
      ? "This story is finished. Nothing more to write."
      : story.generating_until && new Date(story.generating_until) > new Date()
          ? "Lorekeeper's built-in narrator is writing a chapter right now. Try again shortly."
          : waiting.length
            ? `Waiting for ${waiting.join(", ")} to answer in Lorekeeper. Don't write the next chapter yet; tell the user.`
            : draft.length
              ? `Chapter ${story.segments.length + 1} is half written (parts 1–${draft.length} above). Go on with part ${draft.length + 1}, then save_chapter. Revision ${story.revision}.`
              : `Write ${story.segments.length ? `chapter ${story.segments.length + 1}, carrying on from the players' answers` : "the opening chapter"} (${voiceNote}). Revision ${story.revision}.`;

  const playerLines = players.map((p) => {
    const c = p.character;
    const about = [p.description, c && !p.description ? [c.kind, c.personality].filter(Boolean).join(". ") : ""]
      .filter(Boolean)
      .join(" ");
    const own = [
      p.voice?.language && `speaks ${p.voice.language}`,
      styleGuide(p.voice?.style) && `speaks in ${styleGuide(p.voice?.style)}`,
    ].filter(Boolean);
    return `- ${nameOf(p.user_id)} (playerId ${p.user_id}${named(p) ? "" : "; unnamed"})${about ? `: ${about}` : ""}${own.length ? ` (${own.join("; ")})` : ""}`;
  });
  const chapterText = story.segments.map((s, i) => {
    const qa = s.questions.map(
      (q) => `\n\n> **Question to ${nameOf(q.player)}:** ${q.text}\n>\n> **${nameOf(q.player)} answered:** ${q.answer ?? "_(not answered yet)_"}`,
    );
    return `### Chapter ${i + 1}\n\n${s.narrative}${qa.join("")}`;
  });
  if (draft.length)
    chapterText.push(
      `### Chapter ${story.segments.length + 1} (in progress, ${draft.length} section${draft.length === 1 ? "" : "s"} saved)\n\n${draft.join("\n\n")}`,
    );
  const head = [
    `# ${story.title || "(untitled — choose a title for the opening)"}`,
    `Session ${story.id} · revision ${story.revision} · status ${story.status}`,
    "## Settings",
    `- Language: ${language}`,
    ...(narrator ? [`- Writing voice: ${narrator}`] : []),
    ...(style.length ? [`- Writing style: ${style.join("; ")}`] : []),
    `- World: ${story.world || "(not set — invent one in the opening)"}`,
    "## Players",
    ...playerLines,
    ...(story.summary ? ["## Continuity notes", story.summary] : []),
    "## Story so far",
  ].join("\n");
  const tail = `## Next step\n${nextStep}`;
  let omitted = 0;
  while (omitted < chapterText.length - 1 && head.length + tail.length + chapterText.slice(omitted).join("\n\n").length > MAX_CONTEXT)
    omitted++;
  const history = chapterText.length
    ? (omitted ? `_(Chapters 1–${omitted} omitted for length; see the continuity notes.)_\n\n` : "") + chapterText.slice(omitted).join("\n\n")
    : "_(No chapters yet.)_";
  return {
    content: [{ type: "text", text: `${head}\n\n${history}\n\n${tail}` }],
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
function section(v: unknown) {
  const text = str(v, "section", 60_000, true)!;
  if (text.length > SECTION_MAX)
    throw new ToolError(
      "This part is too long for the players to read along. Split it into smaller parts (a few paragraphs each).",
    );
  return text;
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
