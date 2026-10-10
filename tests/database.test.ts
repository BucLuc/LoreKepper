import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
test("migration enforces membership, admin permissions, invitation expiry, favorites and deletion", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111",
    member = "22222222-2222-4222-8222-222222222222",
    outsider = "33333333-3333-4333-8333-333333333333",
    cid = "44444444-4444-4444-8444-444444444444",
    eid = "55555555-5555-4555-8555-555555555555";
  try {
    await db.exec(
      `create role authenticated; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610100001_lore.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query("insert into auth.users(id) values($1),($2),($3)", [
      owner,
      member,
      outsider,
    ]);
    const as = async (uid: string) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        uid,
      ]);
      await db.exec("set role authenticated");
    };
    await as(owner);
    // Reproduce the original policy failure for the app's insert().select().
    await assert.rejects(
      db.query(
        "insert into collections(id,name,owner_id) values($1,$2,$3) returning *",
        [cid, "A hall", owner],
      ),
      /new row violates row-level security policy/,
    );
    await db.exec("reset role");
    const fix = await readFile(
      new URL(
        "../supabase/migrations/202610100002_collection_creation_rls.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(fix);
    await db.exec(fix); // Safe to rerun in the hosted SQL editor.
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610100003_entry_management.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await as(owner);
    await assert.rejects(
      db.query(
        "insert into collections(id,name,owner_id) values($1,$2,$3) returning *",
        [cid, "Forged owner", member],
      ),
    );
    await db.query(
      "insert into collections(id,name,owner_id) values($1,$2,$3) returning *",
      [cid, "A hall", owner],
    );
    assert.equal((await db.query("select * from members")).rows.length, 1);
    await db.query(
      "insert into entries(id,collection_id,creator_id,payload) values($1,$2,$3,$4)",
      [eid, cid, owner, "ciphertext"],
    );
    const token = "a".repeat(64),
      hash = createHash("sha256").update(token).digest("hex");
    await db.query(
      "insert into invites(collection_id,token_hash) values($1,$2)",
      [cid, hash],
    );
    await as(member);
    assert.equal((await db.query("select * from entries")).rows.length, 0);
    await assert.rejects(
      db.query("insert into members values($1,$2)", [cid, member]),
    );
    await assert.rejects(db.query("select accept_invite($1)", ["invalid"]));
    await db.query("select accept_invite($1)", [token]);
    await db.query("select accept_invite($1)", [token]);
    assert.equal((await db.query("select * from members")).rows.length, 2);
    assert.equal((await db.query("select * from entries")).rows.length, 1);
    assert.equal((await db.query("select * from profiles")).rows.length, 2);
    // Members cannot edit/delete another user's contribution, even directly.
    assert.equal(
      (
        await db.query(
          "update entries set payload=$1 where id=$2 returning id",
          ["forged", eid],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await db.query("delete from entries where id=$1 returning id", [eid]))
        .rows.length,
      0,
    );
    const memberEntry = "66666666-6666-4666-8666-666666666666";
    await db.query(
      "insert into entries(id,collection_id,creator_id,payload) values($1,$2,$3,$4)",
      [memberEntry, cid, member, "member ciphertext"],
    );
    assert.equal(
      (
        await db.query(
          "update entries set payload=$1 where id=$2 returning id",
          ["updated ciphertext", memberEntry],
        )
      ).rows.length,
      1,
    );
    await assert.rejects(
      db.query("update entries set creator_id=$1 where id=$2", [
        owner,
        memberEntry,
      ]),
    );
    await assert.rejects(
      db.query("update entries set id=$1 where id=$2", [
        "77777777-7777-4777-8777-777777777777",
        memberEntry,
      ]),
    );
    await db.query("insert into favorites values($1,$2,$3)", [
      cid,
      memberEntry,
      member,
    ]);
    assert.equal(
      (
        await db.query("delete from entries where id=$1 returning id", [
          memberEntry,
        ])
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query("select * from favorites where entry_id=$1", [
          memberEntry,
        ])
      ).rows.length,
      0,
    );
    await db.query("update collections set name=$1 where id=$2", [
      "Forged name",
      cid,
    ]);
    assert.equal(
      (await db.query<{ name: string }>("select name from collections")).rows[0]
        .name,
      "A hall",
    );
    await assert.rejects(
      db.query("insert into invites(collection_id,token_hash) values($1,$2)", [
        cid,
        "forged",
      ]),
    );
    await assert.rejects(
      db.query("insert into author_assignments values($1,$2,$3)", [
        cid,
        "Original",
        member,
      ]),
    );
    await db.query("insert into favorites values($1,$2,$3)", [
      cid,
      eid,
      member,
    ]);
    await as(owner);
    await db.query("insert into favorites values($1,$2,$3)", [cid, eid, owner]);
    await db.query("insert into author_assignments values($1,$2,$3)", [
      cid,
      "Original",
      member,
    ]);
    await assert.rejects(
      db.query("insert into author_assignments values($1,$2,$3)", [
        cid,
        "Other",
        outsider,
      ]),
    );
    await as(member);
    await db.query("delete from favorites where user_id=$1", [owner]);
    assert.equal((await db.query("select * from favorites")).rows.length, 2);
    await db.query("delete from favorites where user_id=$1", [member]);
    assert.equal((await db.query("select * from favorites")).rows.length, 1);
    await as(owner);
    await db.query("update invites set expires_at=now()-interval '1 second'");
    await as(outsider);
    await assert.rejects(db.query("select accept_invite($1)", [token]));
    assert.equal((await db.query("select * from entries")).rows.length, 0);
    await as(owner);
    await db.query("select delete_my_account()");
    await db.exec("reset role");
    assert.equal((await db.query("select * from collections")).rows.length, 0);
    assert.equal((await db.query("select * from entries")).rows.length, 0);
    assert.equal((await db.query("select * from favorites")).rows.length, 0);
    assert.equal((await db.query("select * from invites")).rows.length, 0);
    assert.equal(
      (await db.query("select * from author_assignments")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from auth.users where id=$1", [owner])).rows
        .length,
      0,
    );
  } finally {
    await db.close();
  }
});
