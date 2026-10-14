import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { defaultVoice, type Adventure, type Player } from "../src/lib/play";
import { handoffContext, validateHandoffTurn } from "../src/lib/handoff";
import { gptActionSchema } from "../src/lib/gpt-action-schema";
const owner = "11111111-1111-4111-8111-111111111111",
  player = "22222222-2222-4222-8222-222222222222",
  a = "44444444-4444-4444-8444-444444444444";
test("handoff includes actual answers, optional identities, readiness and revision without account credentials", () => {
  const story = {
    id: a,
    owner_id: owner,
    title: "",
    world: "",
    ai_mode: "chatgpt",
    status: "active",
    voice: defaultVoice,
    summary: "",
    revision: 3,
    segments: [
      {
        narrative: "The guard waits.",
        questions: [
          {
            player: owner,
            text: "Your move?",
            answer: "I request a sandwich.",
          },
          { player, text: "Your move?" },
        ],
        created: "",
      },
    ],
  } as Adventure;
  const players: Player[] = [
    {
      user_id: owner,
      name: "Visitor",
      description: "A weary traveller",
      character: null,
    },
    { user_id: player, name: "Mira", character: null },
  ];
  const context = handoffContext(story, players);
  assert.equal(context.ready, false);
  assert.equal(context.waiting[0].id, player);
  assert.equal(context.revision, 3);
  assert.equal(context.currentActions[0].action, "I request a sandwich.");
  assert.equal(context.players[0].description, "A weary traveller");
  assert.ok(!JSON.stringify(context).includes("encrypted_key"));
  assert.throws(
    () =>
      validateHandoffTurn(story, players, {
        requestId: "x",
        revision: 3,
        narrative: "We go north",
        summary: "",
        questions: [{ player: owner, text: "Your move?" }],
        resolvedActions: [],
      }),
    /every submitted action/,
  );
  const schema = gptActionSchema("https://stories.example");
  assert.equal(
    schema.components.securitySchemes.LoreKeeperOAuth.type,
    "oauth2",
  );
  assert.equal(
    schema.paths["/api/story-bridge/sessions/{id}/turns"].post.operationId,
    "saveStoryTurn",
  );
});
test("bridge migration binds OAuth to users and guards readiness, revisions, retries, revocation and complete imports", async () => {
  const db = new PGlite();
  try {
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
    ])
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${f}`, import.meta.url),
          "utf8",
        ),
      );
    await db.query("insert into auth.users(id) values($1),($2)", [
      owner,
      player,
    ]);
    await db.query(
      "insert into adventures(id,owner_id,title,world,mode,voice,edition,design) values($1,$2,'','','solo','{}','glorious','{}')",
      [a, owner],
    );
    await db.query(
      "insert into adventure_players(adventure_id,user_id,name,character) values($1,$2,'Original','{\"name\":\"Old character\"}')",
      [a, owner],
    );
    await db.exec("set role service_role");
    await db.query("select configure_adventure($1,$2,0,$3,$4)", [
      a,
      owner,
      {
        title: "",
        world: "",
        voice: { language: "English" },
        edition: "glorious",
        design: {},
        ai_mode: "chatgpt",
      },
      [{ user: owner, name: "Visitor", description: "A traveller" }],
    ]);
    const identity = (
      await db.query<{ name: string; identity_name: string; description: string; character: null }>(
        "select name,identity_name,description,character from adventure_players where adventure_id=$1",
        [a],
      )
    ).rows[0];
    assert.equal(identity.name, "Original");
    assert.equal(identity.identity_name, "Visitor");
    assert.equal(identity.description, "A traveller");
    assert.equal(identity.character, null);
    await assert.rejects(
      db.query("select arm_chatgpt_story($1,$2)", [a, player]),
    );
    await db.query("select arm_chatgpt_story($1,$2)", [a, owner]);
    const segment = {
      narrative:
        "## Chapter I: The gate\n\n*Thornwick, dusk*\n\nA guard waits.",
      questions: [{ player: owner, text: "Your move?" }],
    };
    const save =
      "select commit_gpt_turn($1,$2,$3,$4,$5,$6,'Memory',false,'At the gate','Thornwick') result";
    await assert.rejects(
      db.query(save, [a, player, 1, "first", "hash", segment]),
    );
    const r = await db.query<{
      result: { revision: number; duplicate: boolean };
    }>(save, [a, owner, 1, "first", "hash", segment]);
    assert.equal(r.rows[0].result.revision, 2);
    assert.equal(
      (
        await db.query<{ result: { duplicate: boolean } }>(save, [
          a,
          owner,
          1,
          "first",
          "hash",
          segment,
        ])
      ).rows[0].result.duplicate,
      true,
    );
    await assert.rejects(
      db.query(save, [a, owner, 1, "first", "different", segment]),
    );
    await assert.rejects(
      db.query(save, [a, owner, 2, "second", "hash2", segment]),
    );
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    await db.exec("set role authenticated");
    await db.query(
      "select submit_adventure_answer($1,2,'I request a sandwich.')",
      [a],
    );
    await assert.rejects(db.query("select authenticate_gpt('access')"));
    await db.exec("reset role;set role service_role");
    await db.query("select set_adventure_status($1,$2,'paused')", [a, owner]);
    await assert.rejects(
      db.query(save, [a, owner, 2, "second", "hash2", segment]),
    );
    await db.query("select arm_chatgpt_story($1,$2)", [a, owner]);
    await db.query(save, [a, owner, 2, "second", "hash2", segment]);
    await db.query(
      "insert into gpt_oauth_codes(code_hash,user_id,redirect_uri) values('code',$1,'https://callback.example')",
      [owner],
    );
    assert.equal(
      (
        await db.query<{ u: string }>(
          "select exchange_gpt_code('code','https://callback.example') u",
        )
      ).rows[0].u,
      owner,
    );
    assert.equal(
      (
        await db.query<{ u: null }>(
          "select exchange_gpt_code('code','https://callback.example') u",
        )
      ).rows[0].u,
      null,
    );
    await db.query(
      "insert into gpt_connections(user_id,access_hash,refresh_hash,access_expires,refresh_expires) values($1,'access','refresh',now()+interval '1 hour',now()+interval '30 days')",
      [owner],
    );
    assert.equal(
      (await db.query<{ u: string }>("select authenticate_gpt('access') u"))
        .rows[0].u,
      owner,
    );
    await db.query(
      "select rotate_gpt_refresh('refresh','new-access','new-refresh')",
    );
    assert.equal(
      (await db.query<{ u: null }>("select authenticate_gpt('access') u"))
        .rows[0].u,
      null,
    );
    assert.equal(
      (await db.query<{ u: string }>("select authenticate_gpt('new-access') u"))
        .rows[0].u,
      owner,
    );
    await db.query("delete from gpt_connections where user_id=$1", [owner]);
    assert.equal(
      (await db.query<{ u: null }>("select authenticate_gpt('new-access') u"))
        .rows[0].u,
      null,
    );
    const markdown =
      "## Chapter I\n\nEvery original paragraph.\n\n## Chapter II\n\nThe end.";
    const query =
      "select import_gpt_story($1,'import','same-hash','The whole tale','World','Memory',$2,'glorious','{}') id";
    const id = (await db.query<{ id: string }>(query, [owner, markdown]))
      .rows[0].id;
    assert.equal(
      (await db.query<{ id: string }>(query, [owner, markdown])).rows[0].id,
      id,
    );
    const imported = (
      await db.query<{ segments: { narrative: string }[]; status: string }>(
        "select segments,status from adventures where id=$1",
        [id],
      )
    ).rows[0];
    assert.equal(imported.segments[0].narrative, markdown);
    assert.equal(imported.status, "completed");
  } finally {
    await db.close();
  }
});
