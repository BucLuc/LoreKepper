import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { handle } from "../supabase/functions/lorekeeper-mcp/server";
const owner = "11111111-1111-4111-8111-111111111111",
  player = "22222222-2222-4222-8222-222222222222",
  a = "44444444-4444-4444-8444-444444444444",
  base = "https://ref.supabase.co";
type Reply = {
  result?: {
    content: { text: string }[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
    tools?: { name: string }[];
    instructions?: string;
  };
  error?: { message: string };
};
async function setup() {
  const db = new PGlite();
  await db.exec(
    "create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;",
  );
  for (const f of [
    "202610100001_lore.sql",
    "202610100002_collection_creation_rls.sql",
    "202610100003_entry_management.sql",
    "202610100004_author_links.sql",
    "202610130001_play.sql",
    "202610130002_lobbies_and_chats.sql",
    "202610140001_chatgpt_bridge.sql",
    "202610150002_chatgpt_mcp.sql",
    "202610160001_player_voice_and_completed_lobby.sql",
    "202610160002_no_account_names_for_chatgpt.sql",
    "202610160003_chapter_drafts.sql",
    "202610170001_narrators.sql",
    "202610170002_writing_voices.sql",
    "202610170003_fun_voices.sql",
    "202610170004_unhinged_pirate_voice_only.sql",
    "202610170005_one_line_voices.sql",
    "202610170006_final_voices.sql",
    "202610170007_voice_collection.sql",
    "202610170008_story_setup.sql",
  ])
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${f}`, import.meta.url),
        "utf8",
      ),
    );
  await db.query(
    `insert into auth.users(id,raw_user_meta_data) values($1,'{"name":"Luc"}'),($2,'{"name":"Mira"}')`,
    [owner, player],
  );
  await db.query(
    "insert into adventures(id,owner_id,title,world,mode,voice,edition,design) values($1,$2,'','A drowned city','multiplayer','{\"language\":\"Deutsch\",\"style\":\"Modern\",\"tone\":\"Default\",\"scope\":\"entire\"}','glorious','{}')",
    [a, owner],
  );
  await db.query(
    "insert into adventure_players(adventure_id,user_id,name,identity_name,description,voice) values($1,$2,'Luc','Kael','A smuggler with a debt',null),($1,$3,'Mira','','','{\"style\":\"Pirate\"}')",
    [a, owner, player],
  );
  await db.exec("set role service_role");
  // The Edge Function's supabase-js rpc() calls, executed by the real migrations.
  const deps = {
    supabaseUrl: base,
    appUrl: "https://lore.example",
    userFor: async (token: string) =>
      ({ "owner-token": owner, "player-token": player })[token] ?? null,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      const names = Object.keys(args);
      try {
        const r = await db.query<{ r: unknown }>(
          `select public.${fn}(${names.map((n, i) => `${n}=>$${i + 1}`).join(",")}) as r`,
          names.map((n) =>
            args[n] !== null && typeof args[n] === "object"
              ? JSON.stringify(args[n])
              : args[n],
          ),
        );
        return { data: r.rows[0].r, error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
  };
  let id = 0;
  const send = async (method: string, params?: unknown, token = "owner-token") => {
    const r = await handle(
      new Request(`${base}/functions/v1/lorekeeper-mcp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
      }),
      deps,
    );
    return (await r.json()) as Reply;
  };
  const tool = (name: string, args: Record<string, unknown>, token?: string) =>
    send("tools/call", { name, arguments: args }, token).then((r) => r.result!);
  return { db, deps, send, tool };
}

test("MCP endpoint advertises OAuth discovery and requires a Lorekeeper token", async () => {
  const { db, deps, send } = await setup();
  try {
    const meta = await handle(
      new Request(`${base}/functions/v1/lorekeeper-mcp/.well-known/oauth-protected-resource`),
      deps,
    );
    assert.deepEqual((await meta.json()).authorization_servers, [`${base}/auth/v1`]);
    const anon = await handle(
      new Request(`${base}/functions/v1/lorekeeper-mcp`, { method: "POST", body: "{}" }),
      deps,
    );
    assert.equal(anon.status, 401);
    assert.match(
      anon.headers.get("WWW-Authenticate")!,
      /resource_metadata="https:\/\/ref\.supabase\.co\/functions\/v1\/lorekeeper-mcp\/\.well-known\/oauth-protected-resource"/,
    );
    const init = await send("initialize", { protocolVersion: "2025-06-18" });
    assert.match(init.result!.instructions!, /no game mechanics/);
    assert.deepEqual(
      (await send("tools/list")).result!.tools!.map((t) => t.name),
      ["list_roleplays", "get_roleplay", "save_chapter", "save_roleplay", "import_story"],
    );
    const note = await handle(
      new Request(`${base}/functions/v1/lorekeeper-mcp`, {
        method: "POST",
        headers: { Authorization: "Bearer owner-token" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      }),
      deps,
    );
    assert.equal(note.status, 202);
  } finally {
    await db.close();
  }
});

test("Start/Continue: ChatGPT reads full history with answers and saves chapters from the lobby onward", async () => {
  const { db, tool } = await setup();
  try {
    const opening = await tool("get_roleplay", { sessionId: a });
    assert.match(opening.content[0].text, /Write in Deutsch\./);
    assert.match(opening.content[0].text, /We play: Kael \(A smuggler with a debt\); Player 2\./);
    assert.match(opening.content[0].text, /Player 2 talks in Pirate style\./);
    assert.match(opening.content[0].text, /Start the story right away, no intro\./);
    // Account names ("Luc", "Mira") never reach ChatGPT.
    assert.doesNotMatch(JSON.stringify(opening), /Mira|Luc/);
    assert.match(opening.content[0].text, /^Make a roleplay\. Set it here: A drowned city\nWe're 2 players and we make the choices\./);
    assert.match(opening.content[0].text, /save it with save_chapter: sessionId 44444444-4444-4444-8444-444444444444, revision 0, chapter = your reply.*playerIds: Kael = 11111111/);
    assert.doesNotMatch(opening.content[0].text, /resolvedActions|lore-state|Chapter format/i);
    assert.equal(opening.structuredContent!.revision, 0);

    // A non-owner cannot read or write the session.
    assert.ok((await tool("get_roleplay", { sessionId: a }, "player-token")).isError);

    const first = await tool("save_chapter", {
      sessionId: a,
      revision: 0,
      chapter: "Rain over the drowned city.",
      question: "Was tust du?",
      title: "Die versunkene Stadt",
    });
    assert.ok(!first.isError, first.content[0].text);
    let s = (await db.query<{ status: string; ai_mode: string; title: string; segments: { questions: unknown[] }[] }>("select * from adventures where id=$1", [a])).rows[0];
    assert.equal(s.status, "active");
    assert.equal(s.ai_mode, "chatgpt");
    assert.equal(s.title, "Die versunkene Stadt");
    assert.equal(s.segments[0].questions.length, 2);

    // Exact retry is harmless; a new chapter waits for every answer.
    assert.equal((await tool("save_chapter", { sessionId: a, revision: 0, chapter: "Rain over the drowned city.", question: "Was tust du?" })).structuredContent!.duplicate, true);
    const early = await tool("save_chapter", { sessionId: a, revision: 1, chapter: "Next", question: "?" });
    assert.ok(early.isError);
    assert.match(early.content[0].text, /Kael, Player 2/);

    await db.exec("reset role");
    await db.query(
      `update adventures set segments=jsonb_set(jsonb_set(segments,'{0,questions,0,answer}','"Ich klaue das Boot."'),'{0,questions,1,answer}','"Ich singe."') where id=$1`,
      [a],
    );
    await db.exec("set role service_role");
    const next = await tool("get_roleplay", { sessionId: a });
    assert.match(next.content[0].text, /Rain over the drowned city\./);
    assert.match(next.content[0].text, /> Was tust du\?\n\n\*\*Kael:\*\* Ich klaue das Boot\./);
    assert.match(next.content[0].text, /\*\*Player 2:\*\* Ich singe\./);
    assert.doesNotMatch(next.content[0].text, /Mira|Luc/);
    assert.match(next.content[0].text, /Continue from our choices\./);

    assert.match((await tool("save_chapter", { sessionId: a, revision: 0, chapter: "Stale", question: "?" })).content[0].text, /changed since you read it/);
    const second = await tool("save_chapter", {
      sessionId: a,
      revision: 1,
      chapter: "The boat sinks; the song draws the fish.",
      questions: [{ playerId: player, question: "Und jetzt?" }],
    });
    assert.equal(second.structuredContent!.chapter, 2);
    s = (await db.query<{ status: string; ai_mode: string; title: string; segments: { questions: unknown[] }[] }>("select * from adventures where id=$1", [a])).rows[0];
    assert.equal(s.segments[1].questions.length, 1);
  } finally {
    await db.close();
  }
});

test("Saving a ChatGPT roleplay creates a continuable story, idempotently, and imports keep Markdown intact", async () => {
  const { db, tool } = await setup();
  try {
    const args = {
      title: "Salt and Ash",
      language: "English",
      character: { name: "Wren", description: "A lighthouse keeper" },
      chapters: [
        { markdown: "The lamp dies.", question: "What do you do?", answer: "I climb the tower." },
        { markdown: "At the top, a stranger waits.", question: "Who do you call out to?" },
      ],
    };
    const saved = await tool("save_roleplay", args);
    const id = saved.structuredContent!.sessionId as string;
    assert.match(saved.content[0].text, /https:\/\/lore\.example\/interactive\//);
    assert.equal((await tool("save_roleplay", args)).structuredContent!.sessionId, id);
    const row = (await db.query<{ status: string; ai_mode: string; segments: { questions: { answer?: string }[] }[] }>("select * from adventures where id=$1", [id])).rows[0];
    assert.equal(row.status, "active");
    assert.equal(row.ai_mode, "chatgpt");
    assert.equal(row.segments[0].questions[0].answer, "I climb the tower.");
    assert.equal(row.segments[1].questions[0].answer, undefined);
    const players = (await db.query<{ identity_name: string }>("select * from adventure_players where adventure_id=$1", [id])).rows;
    assert.equal(players[0].identity_name, "Wren");
    // The saved roleplay continues like any Lorekeeper session.
    assert.match((await tool("get_roleplay", { sessionId: id })).content[0].text, /I play Wren: A lighthouse keeper\.[\s\S]*I haven't answered in Lorekeeper yet/);

    const updated = await tool("save_roleplay", { ...args, sessionId: id, chapters: [...args.chapters.slice(0, 1), { ...args.chapters[1], answer: "Hello?" }, { markdown: "The stranger smiles.", question: "And then?" }] });
    assert.equal(updated.structuredContent!.sessionId, id);
    assert.equal((await db.query("select * from adventures where owner_id=$1 and title='Salt and Ash'", [owner])).rows.length, 1);

    const markdown = "# The Long Night\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n*Fin.*";
    const imported = await tool("import_story", { title: "The Long Night", markdown });
    const storyId = imported.structuredContent!.sessionId as string;
    await tool("import_story", { title: "The Long Night", markdown: "## Part two", appendToSessionId: storyId });
    const story = (await db.query<{ status: string; segments: { narrative: string }[] }>("select * from adventures where id=$1", [storyId])).rows[0];
    assert.equal(story.status, "completed");
    assert.deepEqual(story.segments.map((x) => x.narrative), [markdown, "## Part two"]);
    assert.ok((await tool("import_story", { title: "x", markdown: "y", appendToSessionId: id })).isError);

    // Finished stories keep editable lobby settings, including each player's own voice.
    const revision = (await db.query<{ revision: number }>("select revision from adventures where id=$1", [storyId])).rows[0].revision;
    await db.query("select configure_adventure($1,$2,$3,$4,$5)", [
      storyId,
      owner,
      revision,
      JSON.stringify({ title: "The Long Night", world: "", voice: { language: "English", style: "Modern", tone: "Default", scope: "entire" }, edition: "codex", design: {}, ai_mode: "chatgpt" }),
      JSON.stringify([{ user: owner, name: "Wren", description: "", voice: { language: "German" } }]),
    ]);
    const after = (await db.query<{ status: string; edition: string }>("select * from adventures where id=$1", [storyId])).rows[0];
    assert.equal(after.status, "completed");
    assert.equal(after.edition, "codex");
    assert.deepEqual(
      (await db.query<{ voice: unknown }>("select voice from adventure_players where adventure_id=$1", [storyId])).rows[0].voice,
      { language: "German" },
    );
  } finally {
    await db.close();
  }
});

test("a writing style gets a short hint for ChatGPT", async () => {
  const { db, tool } = await setup();
  try {
    await db.query(`update adventures set voice='{"language":"English","style":"Medieval","tone":"Default","scope":"entire"}' where id=$1`, [a]);
    const text = (await tool("get_roleplay", { sessionId: a })).content[0].text;
    assert.match(text, /Write in Medieval style \(old-fashioned speech/);
    assert.match(text, /^Make a roleplay\./);
  } finally {
    await db.close();
  }
});

test("a chosen writing voice reaches ChatGPT as prose style, never as a framing storyteller", async () => {
  const { db, tool } = await setup();
  try {
    const preset = (await db.query<{ name: string; persona: string }>("select name,persona from narrators where id='pirate-captain'")).rows[0];
    assert.equal((await db.query("select * from narrators where mood='classic'")).rows.length, 2);
    await db.query("update adventures set voice=$2 where id=$1", [
      a,
      JSON.stringify({ language: "English", style: "Medieval", tone: "Default", scope: "entire", narrator: "pirate-captain", narratorName: preset.name, persona: preset.persona }),
    ]);
    const text = (await tool("get_roleplay", { sessionId: a })).content[0].text;
    assert.match(text, /\nWrite in classic pirate English, with expressions like arrr, ye and matey, in lively, entertaining prose\.\n/);
    assert.equal((await db.query("select * from narrators where id='pirate-yarn'")).rows.length, 0);
    assert.doesNotMatch(text, /Writing style/);
    assert.doesNotMatch(text, /Medieval style/);
    assert.doesNotMatch(text, /## |playerId \S+; unnamed/);
  } finally {
    await db.close();
  }
});

test("a player can speak in a different voice than the story", async () => {
  const { db, tool } = await setup();
  try {
    const ids = (await db.query<{ id: string }>("select id from narrators order by sort")).rows.map((r) => r.id);
    assert.ok(ids.includes("absolute-cinema") && ids.includes("fed-up") && ids.includes("wild-west") && ids.includes("spaceship-ai"));
    assert.ok(!ids.includes("posh-pirate") && !ids.includes("unhinged-pirate"));
    assert.equal(ids.length, 24);
    await db.query(`update adventures set voice='{"language":"English","style":"Modern","tone":"Default","scope":"entire","narrator":"wild-west","narratorName":"Wild West","persona":"Write like a dusty Wild West story with a drawl."}' where id=$1`, [a]);
    await db.query(`update adventure_players set voice='{"narrator":"pirate-captain","speech":"talks like a pirate captain"}' where user_id=$1`, [player]);
    const text = (await tool("get_roleplay", { sessionId: a })).content[0].text;
    assert.match(text, /\nWrite like a dusty Wild West story with a drawl\.\n/);
    assert.match(text, /\nPlayer 2 talks like a pirate captain\.\n/);
    assert.doesNotMatch(text, /Kael talks/);
  } finally {
    await db.close();
  }
});

test("a story set up in the wizard locks once begun", async () => {
  const { db, tool } = await setup();
  try {
    const themes = (await db.query<{ theme: string }>("select distinct theme from worlds")).rows.map((r) => r.theme);
    assert.equal(themes.length, 6);
    const settings = (title: string) => JSON.stringify({ title, world: "", voice: { language: "English" }, edition: "light", design: {}, ai_mode: "api", ai_provider: "shared", setup: { step: 2 } });
    await db.query("select configure_adventure($1,$2,0,$3,'[]')", [a, owner, settings("Before")]);
    type Row = { title: string; edition: string; ai_provider: string; setup: { step: number } };
    let s = (await db.query<Row>("select * from adventures where id=$1", [a])).rows[0];
    assert.equal(s.title, "Before");
    assert.equal(s.ai_provider, "shared");
    assert.equal(s.setup.step, 2);
    const r = (await tool("get_roleplay", { sessionId: a })).structuredContent!.revision as number;
    await tool("save_chapter", { sessionId: a, revision: r, chapter: "It begins.", question: "Now?" });
    // After the first chapter only the display can change.
    await db.query("select configure_adventure($1,$2,$3,$4,'[]')", [a, owner, r + 1, settings("After")]);
    s = (await db.query<Row>("select * from adventures where id=$1", [a])).rows[0];
    assert.equal(s.title, "Before");
    assert.equal(s.edition, "light");
    // A key per provider.
    await db.query("insert into ai_settings(user_id,provider,model,encrypted_key) values($1,'groq','m','k'),($1,'openai','m','k')", [owner]);
    assert.equal((await db.query("select * from ai_settings where user_id=$1", [owner])).rows.length, 2);
  } finally {
    await db.close();
  }
});
