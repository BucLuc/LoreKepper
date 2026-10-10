import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { encrypt, decrypt } from "@/lib/encryption";
import { prepareEntries, type Entry } from "@/lib/archive";
import { validateEntries } from "@/lib/validation";
import { collectionJson, collectionMarkdown } from "@/lib/export-collection";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer "))
      return Response.json(
        { error: "Sign in first." },
        { status: 401, headers },
      );
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(authorization.slice(7));
    if (authError || !user)
      return Response.json(
        { error: "Your session expired. Sign in again." },
        { status: 401, headers },
      );
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 3_000_000)
      return Response.json(
        { error: "Import limit is 3 MB per batch." },
        { status: 413, headers },
      );
    const b = JSON.parse(raw);
    const unwrap = <T>(r: { data: T; error: { message: string } | null }) => {
      if (r.error) throw new Error(r.error.message);
      return r.data as NonNullable<T>;
    };
    const name = (v: unknown) => {
      if (typeof v !== "string" || !v.trim() || v.trim().length > 120)
        throw new Error("Enter a name of 1–120 characters.");
      return v.trim();
    };
    const collection = async (admin = false) => {
      const c = unwrap(
        await db
          .from("collections")
          .select("*")
          .eq("id", b.collection)
          .single(),
      );
      if (admin && c.owner_id !== user.id)
        throw new Error("Only the collection admin can do this.");
      return c;
    };
    let result: unknown = {};
    switch (b.action) {
      case "deleteAccount":
        unwrap(await db.rpc("delete_my_account"));
        break;
      case "home":
        result = {
          collections: unwrap(
            await db
              .from("collections")
              .select("*,entries(count),members(count)")
              .order("created_at"),
          ),
          profile: unwrap(
            await db.from("profiles").select("*").eq("id", user.id).single(),
          ),
        };
        break;
      case "createCollection":
        result = unwrap(
          await db
            .from("collections")
            .insert({ name: name(b.name), owner_id: user.id })
            .select()
            .single(),
        );
        break;
      case "export":
      case "collection": {
        const c = await collection();
        const rows = [];
        for (let offset = 0; ; offset += 500) {
          const batch = unwrap(
            await db
              .from("entries")
              .select("*")
              .eq("collection_id", c.id)
              .order("created_at")
              .order("id")
              .range(offset, offset + 499),
          );
          rows.push(...batch);
          if (batch.length < 500) break;
        }
        const members = unwrap(await db.from("members").select("user_id,profiles(id,name)").eq("collection_id", c.id));
        const attribution = [];
        for (let offset = 0; ; offset += 500) {
          const batch = unwrap(await db.from("entry_authors").select("*")
            .eq("collection_id", c.id).order("entry_id").order("message_index")
            .range(offset, offset + 499));
          attribution.push(...batch);
          if (batch.length < 500) break;
        }
        const byMessage = new Map(attribution.map(a => [`${a.entry_id}:${a.message_index}`, a]));
        const profileNames = new Map(members.map(m => [m.user_id, (m.profiles as unknown as {name:string}).name]));
        const original = rows.map(r => {
          const e = decrypt(r.payload, c.id, r.id) as Entry;
          return {...e, id:r.id, author:profileNames.get(r.author_user_id) || r.author, authorUserId:r.author_user_id,
            messages:e.messages.map((m,index) => {
              const linked = byMessage.get(`${r.id}:${index}`);
              return {...m, author:profileNames.get(linked?.user_id) || linked?.author || m.author,
                fallbackAuthor:linked?.author || m.author, userId:linked?.user_id || undefined};
            })};
        });
        const entries = prepareEntries(original);
        if (b.action === "export") {
          const selected = b.entry ? original.filter(e => e.id===b.entry) : original;
          if (b.entry && !selected.length) throw new Error("Entry not found.");
          result = {name:c.name, content:b.format==="md"
            ? collectionMarkdown(b.entry ? selected[0].title : c.name, prepareEntries(selected))
            : JSON.stringify(collectionJson(selected),null,2)};
          break;
        }
        result = {
          collection: c,
          entries,
          creators: Object.fromEntries(rows.map((r) => [r.id, r.creator_id])),
          members,
          favorites: unwrap(await db.from("favorites").select("*").eq("collection_id",c.id)),
          invites:
            c.owner_id === user.id
              ? unwrap(
                  await db
                    .from("invites")
                    .select("id,expires_at")
                    .eq("collection_id", c.id),
                )
              : [],
        };
        break;
      }
      case "updateEntry":
      case "save": {
        const c = await collection(Boolean(b.import));
        if (b.action === "updateEntry") {
          const existing = unwrap(
            await db
              .from("entries")
              .select("creator_id")
              .eq("collection_id", c.id)
              .eq("id", b.entry)
              .single(),
          );
          if (existing.creator_id !== user.id)
            throw new Error("You can only edit entries you created.");
        }
        const entries = validateEntries(b.archive);
        if (!b.import && entries.length !== 1)
          throw new Error("Create one entry at a time.");
        const ids: string[] = [];
        const batch = [];
        for (const entry of entries) {
          const id = b.action==="updateEntry" ? b.entry : randomUUID();
          const authors = entry.messages.map(m => ({author:m.author || null,userId:m.userId || null}));
          const content = {...entry, messages:entry.messages.map(m => {
            const {author, userId, fallbackAuthor, ...text} = m;
            void author; void userId; void fallbackAuthor;
            return {...text, id:text.id || randomUUID(), author:""};
          })};
          const payload=encrypt(content,c.id,id);
          if(b.action==="updateEntry")unwrap(await db.rpc("save_entry",{p_id:id,p_collection:c.id,p_payload:payload,p_authors:authors,p_update:true}));
          else batch.push({id,collection:c.id,payload,authors});
          ids.push(id);
        }
        if(batch.length)unwrap(await db.rpc("save_entries",{p_entries:batch}));
        result = {count:ids.length,id:ids[0]};
        break;
      }
      case "renameEntry": {
        const c=await collection();
        const row=unwrap(await db.from("entries").select("*").eq("id",b.entry).eq("collection_id",c.id).single());
        if(row.creator_id!==user.id)throw new Error("You can only rename entries you created.");
        const e=decrypt(row.payload,c.id,row.id);
        if (typeof b.name !== "string" || !b.name.trim() || b.name.trim().length > 500)
          throw new Error("Enter a title of 1–500 characters.");
        e.title=b.name.trim();
        const authors=unwrap(await db.from("entry_authors").select("*").eq("entry_id",row.id).order("message_index"));
        unwrap(await db.rpc("save_entry",{p_id:row.id,p_collection:c.id,p_payload:encrypt(e,c.id,row.id),p_authors:authors.map(a=>({author:a.author,userId:a.user_id})),p_update:true}));
        break;
      }
      case "deleteEntry": {
        const c = await collection();
        const entry = unwrap(
          await db
            .from("entries")
            .select("creator_id")
            .eq("collection_id", c.id)
            .eq("id", b.entry)
            .single(),
        );
        if (entry.creator_id !== user.id)
          throw new Error("You can only delete entries you created.");
        unwrap(
          await db
            .from("entries")
            .delete()
            .eq("collection_id", c.id)
            .eq("id", b.entry)
            .select("id")
            .single(),
        );
        break;
      }
      case "rename":
        await collection(true);
        unwrap(
          await db
            .from("collections")
            .update({ name: name(b.name) })
            .eq("id", b.collection),
        );
        break;
      case "delete":
        await collection(true);
        unwrap(await db.from("collections").delete().eq("id", b.collection));
        break;
      case "invite": {
        await collection(true);
        const token = randomBytes(32).toString("hex");
        unwrap(
          await db.from("invites").insert({
            collection_id: b.collection,
            token_hash: createHash("sha256").update(token).digest("hex"),
          }),
        );
        result = { token };
        break;
      }
      case "revoke":
        await collection(true);
        unwrap(
          await db
            .from("invites")
            .delete()
            .eq("collection_id", b.collection)
            .eq("id", b.id),
        );
        break;
      case "accept":
        if (typeof b.token !== "string" || !/^[a-f0-9]{64}$/.test(b.token))
          throw new Error("Invalid invitation.");
        result = {
          id: unwrap(await db.rpc("accept_invite", { token: b.token })),
        };
        break;
      case "favorite":
        await collection();
        if (b.remove)
          unwrap(
            await db
              .from("favorites")
              .delete()
              .eq("entry_id", b.entry)
              .eq("user_id", user.id)
              .eq("collection_id", b.collection),
          );
        else
          unwrap(
            await db.from("favorites").upsert({
              collection_id: b.collection,
              entry_id: b.entry,
              user_id: user.id,
            }, {ignoreDuplicates:true}),
          );
        break;
      case "assign":
        await collection(true);
        if (
          typeof b.author !== "string" ||
          !b.author.trim() ||
          b.author.length > 500
        )
          throw new Error("Invalid author.");
        result = {count:unwrap(await db.rpc("assign_collection_author",{p_collection:b.collection,p_author:b.author,p_user:b.userId}))};
        break;
      case "profile": {
        const n = name(b.name);
        if (n.length > 100)
          throw new Error("Profile names have a 100-character limit.");
        unwrap(await db.from("profiles").update({ name: n }).eq("id", user.id));
        break;
      }
      default:
        throw new Error("Unknown archive action.");
    }
    return Response.json(result, { headers });
  } catch (error) {
    console.error(
      "Archive request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Archive request failed.",
      },
      { status: 400, headers },
    );
  }
}
