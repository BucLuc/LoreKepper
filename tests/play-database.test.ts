import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("play migration enforces privacy, snapshots, atomic turns, leases and creator quotas", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111",
    player = "22222222-2222-4222-8222-222222222222",
    outsider = "33333333-3333-4333-8333-333333333333",
    a = "44444444-4444-4444-8444-444444444444",
    collection = "55555555-5555-4555-8555-555555555555",
    char = "66666666-6666-4666-8666-666666666666";
  try {
    await db.exec(
      "create role authenticated; create role anon; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to authenticated,service_role; grant execute on function auth.uid() to authenticated,service_role;",
    );
    for (const file of [
      "202610100001_lore.sql",
      "202610100002_collection_creation_rls.sql",
      "202610100003_entry_management.sql",
      "202610100004_author_links.sql",
      "202610130001_play.sql",
    ])
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.query<Record<string, unknown>>(
      "insert into auth.users(id) values($1),($2),($3)",
      [owner, player, outsider],
    );
    const as = async (u: string, role = "authenticated") => {
      await db.exec("reset role");
      await db.query<Record<string, unknown>>(
        "select set_config('request.jwt.claim.sub',$1,false)",
        [u],
      );
      await db.exec(`set role ${role}`);
    };
    await as(owner);
    await db.query<Record<string, unknown>>(
      "insert into collections(id,name,owner_id) values($1,$2,$3)",
      [collection, "Private lore", owner],
    );
    await db.query<Record<string, unknown>>(
      "insert into characters(id,owner_id,collection_id,name,kind,personality,avatar,voice) values($1,$2,$3,'Knight','Human','Proud','🛡️','{}')",
      [char, owner, collection],
    );
    await as(outsider);
    assert.equal(
      (await db.query<Record<string, unknown>>("select * from characters")).rows
        .length,
      0,
    );
    await assert.rejects(
      db.query<Record<string, unknown>>(
        "insert into characters(owner_id,name,kind,personality,avatar,voice) values($1,'Forged','Human','Proud','🛡️','{}')",
        [owner],
      ),
      /row-level security/,
    );
    await as(owner, "service_role");
    await db.query<Record<string, unknown>>(
      "insert into adventures(id,owner_id,title,mode,world,voice,edition,design) values($1,$2,'Bridge','multiplayer','Kingdom','{}','glorious','{}')",
      [a, owner],
    );
    await db.query<Record<string, unknown>>(
      'insert into adventure_players values($1,$2,\'Owner\',\'{"id":"66666666-6666-4666-8666-666666666666","name":"Knight"}\')',
      [a, owner],
    );
    await db.query<Record<string, unknown>>(
      "insert into play_invites(token_hash,adventure_id) values('invite',$1)",
      [a],
    );
    await db.query<Record<string, unknown>>("select join_play($1,$2,$3)", [
      "invite",
      player,
      "Player",
    ]);
    await as(player);
    assert.equal(
      (await db.query<Record<string, unknown>>("select * from adventures")).rows
        .length,
      1,
    );
    assert.equal(
      (await db.query<Record<string, unknown>>("select * from characters")).rows
        .length,
      0,
    );
    await assert.rejects(
      db.query<Record<string, unknown>>("select join_play('invite',$1,'Bad')", [
        outsider,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query<Record<string, unknown>>("select * from ai_settings"),
      /permission denied/,
    );
    await assert.rejects(
      db.query<Record<string, unknown>>(
        "update adventures set status='completed' where id=$1",
        [a],
      ),
      /permission denied/,
    );
    await as(outsider);
    assert.equal(
      (await db.query<Record<string, unknown>>("select * from adventures")).rows
        .length,
      0,
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "select * from adventure_players",
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query<Record<string, unknown>>(
        "select submit_adventure_answer($1,0,'Forge')",
        [a],
      ),
      /Not a participant/,
    );
    await as(owner, "service_role");
    const lease = (
      await db.query<{ lease_adventure: string }>(
        "select lease_adventure($1,false)",
        [a],
      )
    ).rows[0].lease_adventure;
    assert.ok(lease);
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "select lease_adventure($1,false)",
          [a],
        )
      ).rows[0].lease_adventure,
      null,
    );
    await assert.rejects(
      db.query<Record<string, unknown>>(
        "select join_play('invite',$1,'Late')",
        [outsider],
      ),
      /already started/,
    );
    const segment = {
      narrative: "Bridge breaks.",
      questions: [
        { player: owner, text: "Hold the rope?" },
        { player, text: "Save the cat?" },
      ],
      created: new Date().toISOString(),
    };
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "select commit_adventure($1,$2,$3,$4,false)",
          [a, lease, JSON.stringify(segment), "Bridge broken"],
        )
      ).rows[0].commit_adventure,
      true,
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "select commit_adventure($1,$2,$3,$4,false)",
          [a, lease, JSON.stringify(segment), "Duplicate"],
        )
      ).rows[0].commit_adventure,
      false,
    );
    await as(owner);
    await db.query<Record<string, unknown>>(
      "delete from characters where id=$1",
      [char],
    );
    assert.equal(
      (
        await db.query<{ character: { name: string } }>(
          "select character from adventure_players where user_id=$1",
          [owner],
        )
      ).rows[0].character.name,
      "Knight",
    );
    await db.query<Record<string, unknown>>(
      "select submit_adventure_answer($1,1,'Hold')",
      [a],
    );
    await assert.rejects(
      db.query<Record<string, unknown>>(
        "select submit_adventure_answer($1,1,'Duplicate')",
        [a],
      ),
      /already answered/,
    );
    await as(owner, "service_role");
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "select lease_adventure($1,false)",
          [a],
        )
      ).rows[0].lease_adventure,
      null,
    );
    await as(player);
    await assert.rejects(
      db.query<Record<string, unknown>>(
        "select submit_adventure_answer($1,0,'Stale')",
        [a],
      ),
      /changed/,
    );
    await db.query<Record<string, unknown>>(
      "select submit_adventure_answer($1,1,'Save cat')",
      [a],
    );
    await as(owner, "service_role");
    assert.ok(
      (
        await db.query<Record<string, unknown>>(
          "select lease_adventure($1,false)",
          [a],
        )
      ).rows[0].lease_adventure,
    );
    await db.query<Record<string, unknown>>(
      "select reserve_ai_usage($1,6,10,100)",
      [owner],
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "select units from ai_usage where user_id=$1",
          [owner],
        )
      ).rows[0].units,
      6,
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "select * from ai_usage where user_id=$1",
          [player],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query<Record<string, unknown>>(
        "select reserve_ai_usage($1,6,10,100)",
        [owner],
      ),
      /wait a few seconds/,
    );
    await db.query<Record<string, unknown>>(
      "update ai_usage set last_call=now()-interval '10 seconds' where user_id=$1",
      [owner],
    );
    await assert.rejects(
      db.query<Record<string, unknown>>(
        "select reserve_ai_usage($1,6,10,100)",
        [owner],
      ),
      /quota reached/,
    );
    // BYOK units do not consume the shared global allowance.
    await db.query("select reserve_ai_usage($1,90,500,0)", [player]);
    await db.query("select reserve_ai_usage($1,1,10,7)", [outsider]);
    await assert.rejects(db.query("select reserve_ai_usage($1,1,10,7)", [owner]), /Shared daily/);
    // Chat membership is independent of collections and adventures.
    await db.query("insert into chats(id,owner_id,title) values($1,$2,'Private fire')", [a,owner]);
    await db.query("insert into chat_players values($1,$2,'Owner')", [a,owner]);
    await db.query("insert into play_invites(token_hash,chat_id) values('chat-invite',$1)", [a]);
    await db.query("select join_play('chat-invite',$1,'Player')", [player]);
    await db.query("insert into chat_messages(id,chat_id,user_id,name,original,content,status) values($1,$2,$3,'Owner','I waited 20 minutes.','For twenty minutes have I waited!','sent')", [char,a,owner]);
    await as(player);
    assert.equal((await db.query<{original:string}>("select original from chat_messages")).rows[0].original, 'I waited 20 minutes.');
    await assert.rejects(db.query("update chat_messages set original='Tampered'"), /permission denied/);
    await as(outsider);
    assert.equal((await db.query("select * from chats")).rows.length, 0);
    assert.equal((await db.query("select * from chat_messages")).rows.length, 0);
    assert.equal((await db.query("select * from chat_players")).rows.length, 0);
  } finally {
    await db.close();
  }
});
