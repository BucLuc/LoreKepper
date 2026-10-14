import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  messageRange,
  selectedMessages,
  conversationMessages,
} from "../src/lib/chat-selection";
test("inclusive chat selection supports reverse ranges and exclusions while preserving every message", () => {
  const rows = ["a", "b", "c", "d"].map((id, i) => ({
    id,
    name: `User ${i}`,
    original: `Original ${i}`,
    content: i === 2 ? "Changed" : null,
    created_at: `2026-10-13T12:0${i}:00Z`,
  }));
  assert.deepEqual(messageRange(rows, "d", "b"), ["b", "c", "d"]);
  assert.throws(() => messageRange(rows, "absent", "d"));
  const chosen = selectedMessages(rows, ["d", "b"]);
  assert.deepEqual(
    chosen.map((m) => m.id),
    ["b", "d"],
  );
  const payload = conversationMessages(chosen);
  assert.equal(payload.length, 2);
  assert.equal(payload[0].author, "User 1");
  assert.equal(payload[1].content, "Original 3");
  assert.equal(payload[1].timestamp, rows[3].created_at);
  assert.match(conversationMessages([rows[2]], true)[0].content, /Original 2/);
});
test("lobby and chat migration enforces owner edits, paused invitations, direct reuse, privacy, and atomic opening metadata", async () => {
  const db = new PGlite(),
    owner = "11111111-1111-4111-8111-111111111111",
    player = "22222222-2222-4222-8222-222222222222",
    other = "33333333-3333-4333-8333-333333333333",
    a = "44444444-4444-4444-8444-444444444444";
  try {
    await db.exec(
      "create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;",
    );
    for (const file of [
      "202610100001_lore.sql",
      "202610100002_collection_creation_rls.sql",
      "202610100003_entry_management.sql",
      "202610100004_author_links.sql",
      "202610130001_play.sql",
      "202610130002_lobbies_and_chats.sql",
    ])
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.query("insert into auth.users(id) values($1),($2),($3)", [
      owner,
      player,
      other,
    ]);
    await db.query(
      "insert into adventures(id,owner_id,title,world,mode,voice,edition,design) values($1,$2,'','','solo','{}','glorious','{}')",
      [a, owner],
    );
    await db.query(
      "insert into adventure_players(adventure_id,user_id,name) values($1,$2,'Owner')",
      [a, owner],
    );
    await db.exec("set role service_role");
    const settings = {
      title: "",
      world: "",
      voice: { language: "English" },
      edition: "glorious",
      design: {},
    };
    await assert.rejects(
      db.query("select configure_adventure($1,$2,0,$3,'[]')", [
        a,
        player,
        settings,
      ]),
    );
    await db.query("select configure_adventure($1,$2,0,$3,'[]')", [
      a,
      owner,
      settings,
    ]);
    await assert.rejects(
      db.query("select configure_adventure($1,$2,0,$3,'[]')", [
        a,
        owner,
        settings,
      ]),
    );
    await db.query("select invite_adventure_user($1,$2,$3)", [
      a,
      owner,
      player,
    ]);
    assert.equal(
      (
        await db.query<{ mode: string }>(
          "select mode from adventures where id=$1",
          [a],
        )
      ).rows[0].mode,
      "multiplayer",
    );
    const token = (
      await db.query<{ t: string }>("select lease_adventure($1,false) t", [a])
    ).rows[0].t;
    await assert.rejects(
      db.query("select configure_adventure($1,$2,1,$3,'[]')", [
        a,
        owner,
        settings,
      ]),
    );
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "select commit_adventure_scene($1,$2,$3,'Memory',false,'Thornwick','A kingdom') ok",
          [
            a,
            token,
            {
              narrative: "## Chapter I: Trouble",
              questions: [{ player: owner, text: "Your move?" }],
            },
          ],
        )
      ).rows[0].ok,
      true,
    );
    const story = (
      await db.query<{ title: string; world: string }>(
        "select title,world from adventures where id=$1",
        [a],
      )
    ).rows[0];
    assert.equal(story.title, "Thornwick");
    assert.equal(story.world, "A kingdom");
    await assert.rejects(
      db.query("select set_adventure_status($1,$2,'paused')", [a, player]),
    );
    await db.query("select set_adventure_status($1,$2,'paused')", [a, owner]);
    await db.query("select invite_adventure_user($1,$2,$3)", [a, owner, other]);
    const c1 = (
      await db.query<{ id: string }>(
        "select create_user_chat($1,array[$2::uuid],'direct','') id",
        [owner, player],
      )
    ).rows[0].id;
    const c2 = (
      await db.query<{ id: string }>(
        "select create_user_chat($1,array[$2::uuid],'direct','') id",
        [player, owner],
      )
    ).rows[0].id;
    assert.equal(c1, c2);
    const group = (
      await db.query<{ id: string }>(
        "select create_user_chat($1,array[$2::uuid,$3::uuid],'group','The party') id",
        [owner, player, other],
      )
    ).rows[0].id;
    assert.equal(
      (await db.query("select * from chat_players where chat_id=$1", [group]))
        .rows.length,
      3,
    );
    await assert.rejects(
      db.query(
        "select create_user_chat($1,array[$2::uuid,$3::uuid],'direct','')",
        [owner, player, other],
      ),
    );
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      other,
    ]);
    await db.exec("set role authenticated");
    assert.equal(
      (await db.query("select * from chats where id=$1", [c1])).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from chats where id=$1", [group])).rows.length,
      1,
    );
    await assert.rejects(
      db.query("select configure_adventure($1,$2,2,$3,'[]')", [
        a,
        owner,
        settings,
      ]),
    );
  } finally {
    await db.close();
  }
});
