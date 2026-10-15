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
      ["list_roleplays", "get_roleplay", "write_section", "save_chapter", "save_roleplay", "import_story"],
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
    assert.match(opening.content[0].text, /Language: Deutsch/);
    assert.match(opening.content[0].text, /Kael .*A smuggler with a debt/);
    assert.match(opening.content[0].text, /Player 2 \(playerId [^)]*; unnamed\).*speaks in Pirate — pirate talk/);
    // Account names ("Luc", "Mira") never reach ChatGPT.
    assert.doesNotMatch(JSON.stringify(opening), /Mira|Luc/);
    assert.match(opening.content[0].text, /Write the opening chapter/);
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
    assert.match(next.content[0].text, /Kael answered:\*\* Ich klaue das Boot\./);
    assert.match(next.content[0].text, /Player 2 answered:\*\* Ich singe\./);
    assert.doesNotMatch(next.content[0].text, /Mira|Luc/);
    assert.match(next.content[0].text, /Write chapter 2/);

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
    assert.match((await tool("get_roleplay", { sessionId: id })).content[0].text, /Waiting for Wren to answer/);

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

test("ChatGPT writes a chapter section by section; players read along, then it is finished with the question", async () => {
  const { db, tool } = await setup();
  try {
    const story = () =>
      db.query<{ status: string; draft: { parts: string[] } | null; segments: { narrative: string; questions: unknown[] }[]; revision: number }>("select * from adventures where id=$1", [a]).then((r) => r.rows[0]);
    // The lobby was opened and paused; ChatGPT may still write (pausing only stops Lorekeeper's narrator).
    await db.query("update adventures set status='paused' where id=$1", [a]);
    const first = await tool("write_section", { sessionId: a, revision: 0, sectionNumber: 1, section: "Rain falls.", title: "Regen" });
    assert.ok(!first.isError, first.content[0].text);
    assert.equal((await story()).status, "active");
    assert.ok((await tool("write_section", { sessionId: a, revision: 0, sectionNumber: 3, section: "Too early." })).isError);
    await tool("write_section", { sessionId: a, revision: 0, sectionNumber: 2, section: "The bell rings." });
    // A retried section is not added twice.
    assert.equal((await tool("write_section", { sessionId: a, revision: 0, sectionNumber: 2, section: "The bell rings." })).structuredContent!.duplicate, true);
    assert.deepEqual((await story()).draft, { parts: ["Rain falls.", "The bell rings."] });

    // While a chapter is half written the lobby can't change, and ChatGPT can pick it up again.
    await assert.rejects(
      db.query("select configure_adventure($1,$2,0,$3,'[]')", [a, owner, JSON.stringify({ title: "x", world: "", voice: {}, edition: "glorious", design: {}, ai_mode: "chatgpt" })]),
      /idle lobby/,
    );
    const reread = await tool("get_roleplay", { sessionId: a });
    assert.match(reread.content[0].text, /Chapter 1 \(in progress, 2 sections saved\)[\s\S]*The bell rings\./);
    assert.match(reread.content[0].text, /Go on with part 3/);

    const done = await tool("save_chapter", { sessionId: a, revision: 0, question: "Was tust du?" });
    assert.ok(!done.isError, done.content[0].text);
    const saved = await story();
    assert.equal(saved.draft, null);
    assert.equal(saved.segments[0].narrative, "Rain falls.\n\nThe bell rings.");
    assert.equal(saved.segments[0].questions.length, 2);
    // Retrying the finish after it succeeded is harmless.
    assert.equal((await tool("save_chapter", { sessionId: a, revision: 0, question: "Was tust du?" })).structuredContent!.duplicate, true);
    // Between chapters an active ChatGPT story's lobby stays editable.
    await db.query("select configure_adventure($1,$2,$3,$4,'[]')", [a, owner, saved.revision, JSON.stringify({ title: "Regen", world: "", voice: {}, edition: "codex", design: {}, ai_mode: "chatgpt" })]);
  } finally {
    await db.close();
  }
});

test("get_roleplay keeps the next step short, and oversized parts are refused", async () => {
  const { db, tool } = await setup();
  try {
    const view = await tool("get_roleplay", { sessionId: a });
    assert.match(view.content[0].text, /## Next step\nWrite the opening chapter \(in Deutsch\)\. Revision 0\.$/);
    const tooLong = await tool("write_section", { sessionId: a, revision: 0, sectionNumber: 1, section: "word ".repeat(1500) });
    assert.ok(tooLong.isError);
    assert.match(tooLong.content[0].text, /smaller parts/);
  } finally {
    await db.close();
  }
});

test("a writing style gets a short hint for ChatGPT", async () => {
  const { db, tool } = await setup();
  try {
    await db.query(`update adventures set voice='{"language":"English","style":"Medieval","tone":"Default","scope":"entire"}' where id=$1`, [a]);
    const text = (await tool("get_roleplay", { sessionId: a })).content[0].text;
    assert.match(text, /Writing style: Medieval — old-fashioned speech \(in English: thou/);
    assert.match(text, /## Next step\nWrite the opening chapter \(in English, Medieval style\)\./);
  } finally {
    await db.close();
  }
});

test("a chosen writing voice reaches ChatGPT as prose style, never as a framing storyteller", async () => {
  const { db, tool } = await setup();
  try {
    const preset = (await db.query<{ name: string; persona: string }>("select name,persona from narrators where id='pirate-captain'")).rows[0];
    assert.ok((await db.query("select * from narrators where mood='medieval'")).rows.length >= 5);
    await db.query("update adventures set voice=$2 where id=$1", [
      a,
      JSON.stringify({ language: "English", style: "Medieval", tone: "Default", scope: "entire", narrator: "pirate-captain", narratorName: preset.name, persona: preset.persona }),
    ]);
    const text = (await tool("get_roleplay", { sessionId: a })).content[0].text;
    assert.match(text, /- Writing voice: Pirate Yarn — The whole story, narration and dialogue, in salty pirate English.*no storyteller character, no frame/);
    assert.equal((await db.query("select * from narrators where id='pirate-parrot'")).rows.length, 0);
    assert.doesNotMatch(text, /Writing style/);
    assert.match(text, /\(in English, in the Pirate Yarn voice\)/);
  } finally {
    await db.close();
  }
});
