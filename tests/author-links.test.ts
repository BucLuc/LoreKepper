import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {validateEntries} from "../src/lib/validation";
import {exportFilename} from "../src/lib/export-name";
test("author assignment is scoped, permission checked, and preserves encrypted content",async()=>{
  const db=new PGlite();
  const owner="11111111-1111-4111-8111-111111111111", member="22222222-2222-4222-8222-222222222222", outsider="33333333-3333-4333-8333-333333333333";
  const cid="44444444-4444-4444-8444-444444444444",other="66666666-6666-4666-8666-666666666666",eid="55555555-5555-4555-8555-555555555555";
  const as=async(uid:string)=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec("set role authenticated");};
  try {
    await db.exec("create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;");
    for(const file of ["202610100001_lore.sql","202610100002_collection_creation_rls.sql","202610100003_entry_management.sql","202610100004_author_links.sql"])
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
    await db.query("insert into auth.users(id) values($1),($2),($3)",[owner,member,outsider]);
    await db.query("insert into collections(id,name,owner_id) values($1,'First',$3),($2,'Second',$3)",[cid,other,owner]);
    await db.query("insert into members values($1,$2)",[cid,member]);
    await as(owner);
    const authors=JSON.stringify([{author:"Old name"},{author:"Old name"},{userId:member}]);
    await db.query("select save_entry($1,$2,'ciphertext',$3::jsonb)",[eid,cid,authors]);
    const eid2="77777777-7777-4777-8777-777777777777";
    await db.query("select save_entry($1,$2,'other ciphertext',$3::jsonb)",[eid2,other,JSON.stringify([{author:"Old name"}])]);
    await assert.rejects(db.query("select assign_collection_author($1,'Old name',$2)",[cid,outsider]),/collection member/);
    await as(member);
    await assert.rejects(db.query("select assign_collection_author($1,'Old name',$2)",[cid,member]),/collection admin/);
    await assert.rejects(db.query("select save_entry($1,$2,'modified',$3::jsonb,true)",[eid,cid,authors]),/only edit/);
    await as(outsider);
    assert.equal((await db.query("select * from entry_authors")).rows.length,0);
    await assert.rejects(db.query("select save_entry($1,$2,'hack',$3::jsonb)",["88888888-8888-4888-8888-888888888888",cid,authors]),/membership/);
    await as(owner);
    assert.equal((await db.query<{count:number}>("select assign_collection_author($1,'Old name',$2) as count",[cid,member])).rows[0].count,1);
    assert.equal((await db.query<{count:number}>("select assign_collection_author($1,'Old name',$2) as count",[cid,member])).rows[0].count,0);
    const rows=(await db.query<{author_user_id:string;payload:string}>("select author_user_id,payload from entries where id=$1",[eid])).rows;
    assert.equal(rows[0].author_user_id,member);assert.equal(rows[0].payload,"ciphertext");
    assert.equal((await db.query("select * from entry_authors where collection_id=$1 and user_id is null",[cid])).rows.length,0);
    assert.equal((await db.query("select * from entry_authors where collection_id=$1 and user_id is null",[other])).rows.length,1);
    // One invalid author rolls back the whole batch, including prior valid rows.
    const id3="99999999-9999-4999-8999-999999999999";
    await assert.rejects(db.query("select save_entries($1::jsonb)",[JSON.stringify([{id:id3,collection:cid,payload:"a",authors:[{userId:member}]},{id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",collection:cid,payload:"b",authors:[{userId:outsider}]}])]),/collection member/);
    assert.equal((await db.query("select * from entries where id=$1",[id3])).rows.length,0);
    await assert.rejects(db.query("insert into entries(id,collection_id,creator_id,payload,author) values($1,$2,$3,'bypass','Name')",[id3,cid,owner]),/permission denied/);
    await db.exec("reset role");await db.query("delete from auth.users where id=$1",[member]);
    assert.equal((await db.query<{author:string;user_id:null}>("select author,user_id from entry_authors where entry_id=$1 order by message_index",[eid])).rows[0].author,"Old name");
    assert.equal((await db.query<{user_id:null}>("select user_id from entry_authors where entry_id=$1",[eid])).rows[0].user_id,null);
  }finally{await db.close();}
});
test("linked members need no fallback input; exports use dated safe filenames",()=>{
  const entry={title:"Story",type:"single",source:"original",reason:"",score:5,messages:[{userId:"22222222-2222-4222-8222-222222222222",timestamp:"now",content:"Words",source:"original",sourceFormat:"markdown"}]};
  assert.equal(validateEntries({entries:[entry]}).length,1);
  assert.throws(()=>validateEntries({entries:[{...entry,messages:[{...entry.messages[0],userId:undefined}]}]}));
  assert.equal(exportFilename("A/B","json",undefined,new Date(2026,9,10)),"A-B — 2026-10-10.json");
});
