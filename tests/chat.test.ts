import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  c = "33333333-3333-4333-8333-333333333333";
test("chat: one table per pair, unread counts, replies and invitations", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;",
    );
    const dir = new URL("../supabase/migrations/", import.meta.url);
    for (const f of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(f, dir), "utf8"));
    await db.query(
      `insert into auth.users(id,raw_user_meta_data) values($1,'{"name":"Luc"}'),($2,'{"name":"Mira"}'),($3,'{"name":"Ada"}')`,
      [a, b, c],
    );
    await db.exec("set role service_role");
    const open = async (u: string, other: string) =>
      (await db.query<{ id: string }>("select create_user_chat($1,array[$2]::uuid[],'direct','') id", [u, other])).rows[0].id;
    const chat = await open(a, b);
    assert.equal(await open(b, a), chat, "the same pair always shares one chat");
    const hall = async (u: string) =>
      (await db.query<{ h: { chats: { id: string; unread: number; partner: { name: string }; last: { kind: string } }[]; people: { name: string }[] } }>("select chat_hall($1) h", [u])).rows[0].h;
    assert.deepEqual((await hall(a)).people.map((p) => p.name), ["Ada", "Mira"]);
    await db.query("update chat_players set read_at=now()-interval '1 minute'");
    await db.query(
      "insert into chat_messages(id,chat_id,user_id,name,original,content) values(gen_random_uuid(),$1,$2,'Mira','Hello','Hello')",
      [chat, b],
    );
    const first = (await db.query<{ id: string }>("select id from chat_messages")).rows[0].id;
    await db.query(
      "insert into chat_messages(id,chat_id,user_id,name,original,content,kind,meta,reply_to,created_at) values(gen_random_uuid(),$1,$2,'Mira','Mira has invited you.','Mira has invited you.','invite','{\"adventure\":\"x\"}',$3,now()+interval '1 second')",
      [chat, b, first],
    );
    const mine = (await hall(a)).chats[0];
    assert.equal(mine.partner.name, "Mira");
    assert.equal(mine.unread, 2);
    assert.equal(mine.last.kind, "invite");
    assert.equal((await hall(b)).chats[0].unread, 0, "your own messages are never unread");
    // Deleting the message replied to keeps the reply.
    await db.query("delete from chat_messages where id=$1", [first]);
    assert.equal((await db.query("select reply_to from chat_messages")).rows.length, 1);
    await assert.rejects(db.query("insert into chat_messages(id,chat_id,user_id,name,original,kind) values(gen_random_uuid(),$1,$2,'Luc','x','poll')", [chat, a]));
  } finally {
    await db.close();
  }
});
