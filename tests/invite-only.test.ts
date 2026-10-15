import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
const migration = (file: string) =>
  readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8");
test("only admins create collections, roles are locked and invitations admit new accounts", async () => {
  const db = new PGlite();
  const admin = "11111111-1111-4111-8111-111111111111",
    member = "22222222-2222-4222-8222-222222222222",
    invited = "33333333-3333-4333-8333-333333333333",
    cid = "44444444-4444-4444-8444-444444444444";
  try {
    await db.exec(
      `create role authenticated; create role anon; create role service_role; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to authenticated,service_role; grant execute on function auth.uid() to authenticated;`,
    );
    for (const file of [
      "202610100001_lore.sql",
      "202610100002_collection_creation_rls.sql",
      "202610100003_entry_management.sql",
      "202610150001_invite_only_roles.sql",
    ])
      await db.exec(await migration(file));
    await db.query("insert into auth.users(id) values($1),($2)", [admin, member]);
    assert.deepEqual(
      (await db.query<{ role: string }>("select role from profiles")).rows.map((r) => r.role),
      ["member", "member"],
    );
    // The owner promotes their account manually in the SQL editor.
    await db.query("update profiles set role='admin' where id=$1", [admin]);
    const as = async (uid: string) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
      await db.exec("set role authenticated");
    };
    await as(member);
    await assert.rejects(
      db.query("insert into collections(name,owner_id) values('Mine',$1) returning *", [member]),
      /row-level security/,
    );
    await assert.rejects(
      db.query("update profiles set role='admin' where id=$1", [member]),
      /permission denied/,
    );
    await db.query("update profiles set name='Renamed' where id=$1", [member]);
    await assert.rejects(db.query("select redeem_invite($1,$2)", ["a".repeat(64), member]));
    await as(admin);
    await db.query(
      "insert into collections(id,name,owner_id) values($1,'The hall',$2) returning *",
      [cid, admin],
    );
    const token = "b".repeat(64);
    await db.query("insert into invites(collection_id,token_hash) values($1,$2)", [
      cid,
      createHash("sha256").update(token).digest("hex"),
    ]);
    await db.exec("reset role");
    await db.exec("set role service_role");
    assert.equal(
      (await db.query<{ n: string }>("select invite_preview($1) n", [token])).rows[0].n,
      "The hall",
    );
    assert.equal(
      (await db.query<{ n: string | null }>("select invite_preview($1) n", ["c".repeat(64)])).rows[0].n,
      null,
    );
    await db.exec("reset role");
    await db.query("insert into auth.users(id) values($1)", [invited]);
    await db.exec("set role service_role");
    await assert.rejects(db.query("select redeem_invite($1,$2)", ["c".repeat(64), invited]), /invalid/);
    await db.query("select redeem_invite($1,$2)", [token, invited]);
    await db.exec("reset role");
    assert.equal(
      (await db.query("select * from members where collection_id=$1 and user_id=$2", [cid, invited])).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
