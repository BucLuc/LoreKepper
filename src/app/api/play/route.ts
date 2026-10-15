import { conversationMessages } from "@/lib/chat-selection";
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { encrypt } from "@/lib/encryption";
import { AIError, generateAI, providers } from "@/lib/ai";
import {
  avatars,
  characterSnapshot,
  voice,
  voicePrompt,
  parseTurn,
  playerVoice,
  storyMarkdown,
  type Adventure,
  type Player,
  type Voice,
} from "@/lib/play";
import { readerEditions } from "@/lib/reader-editions";
import { normalizeDesign } from "@/lib/edition-design";
import {
  storyRequest,
  validateResolutions,
  decodeNarratorOutput,
} from "@/lib/story-narrator";
export const maxDuration = 120;
function unwrap<T>(r: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
}
function text(v: unknown, max = 120) {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw new Error(`Enter text of 1–${max} characters.`);
  return v.trim();
}
async function member(
  db: SupabaseClient,
  id: string,
  chat: boolean,
  user: string,
) {
  return unwrap(
    await db
      .from(chat ? "chat_players" : "adventure_players")
      .select("*")
      .eq(chat ? "chat_id" : "adventure_id", id)
      .eq("user_id", user)
      .single(),
  );
}
async function chatHistory(db: SupabaseClient, id: string) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const batch = unwrap(
      await db
        .from("chat_messages")
        .select("*")
        .eq("chat_id", id)
        .order("created_at")
        .order("id")
        .range(offset, offset + 499),
    );
    rows.push(...batch);
    if (batch.length < 500) break;
  }
  return rows;
}
export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const authorization = req.headers.get("authorization") || "";
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
      error,
    } = await db.auth.getUser(authorization.slice(7));
    if (error || !user)
      return Response.json(
        { error: "Your session expired. Sign in again." },
        { status: 401, headers },
      );
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 200000)
      return Response.json(
        { error: "Request too large." },
        { status: 413, headers },
      );
    const b = JSON.parse(raw);
    const profile = unwrap(
      await db.from("profiles").select("name").eq("id", user.id).single(),
    );
    if (b.action === "viewer")
      return Response.json({ user: user.id, name: profile.name }, { headers });
    if (b.action === "home")
      return Response.json(
        {
          user: user.id,
          name: profile.name,
          characters: unwrap(
            await db.from("characters").select("*").order("created_at"),
          ),
          adventures: unwrap(
            await db
              .from("adventures")
              .select("id,owner_id,title,status,edition,mode,voice,world,created_at")
              .order("created_at", { ascending: false }),
          ),
          chats: unwrap(
            await db
              .from("chats")
              .select("*")
              .order("created_at", { ascending: false }),
          ),
          collections: unwrap(
            await db.from("collections").select("id,name,owner_id"),
          ),
        },
        { headers },
      );
    if (b.action === "character" || b.action === "importCharacters") {
      const items =
        b.action === "importCharacters" ? b.characters : [b.character];
      if (!Array.isArray(items) || !items.length || items.length > 100)
        throw new Error("Import 1–100 characters as a JSON array.");
      const rows = items.map((c) => ({
        owner_id: user.id,
        collection_id: c.collection_id || b.collection || null,
        name: text(c.name),
        kind: text(c.kind || "Human"),
        personality: text(c.personality || "A curious adventurer.", 6000),
        avatar: avatars.includes(c.avatar) ? c.avatar : avatars[0],
        voice: voice(c.voice),
      }));
      return Response.json(
        b.id
          ? unwrap(
              await db
                .from("characters")
                .update(rows[0])
                .eq("id", b.id)
                .select()
                .single(),
            )
          : unwrap(await db.from("characters").insert(rows).select()),
        { headers },
      );
    }
    if (b.action === "deleteCharacter") {
      unwrap(await db.from("characters").delete().eq("id", b.id));
      return Response.json({}, { headers });
    }
    if (b.action === "adventure") {
      const s = unwrap(
        await db.from("adventures").select("*").eq("id", b.id).single(),
      );
      const { generation_token, ...safe } = s;
      void generation_token;
      return Response.json(
        {
          story: safe,
          players: unwrap(
            await db
              .from("adventure_players")
              .select("*")
              .eq("adventure_id", b.id),
          ),
        },
        { headers },
      );
    }
    if (b.action === "chat") {
      const messages =
        b.all === true
          ? await chatHistory(db, b.id)
          : unwrap(
              await db
                .from("chat_messages")
                .select("*")
                .eq("chat_id", b.id)
                .order("created_at", { ascending: false })
                .order("id", { ascending: false })
                .limit(100),
            ).reverse();
      return Response.json(
        {
          chat: unwrap(
            await db.from("chats").select("*").eq("id", b.id).single(),
          ),
          players: unwrap(
            await db.from("chat_players").select("*").eq("chat_id", b.id),
          ),
          messages,
          more: b.all !== true && messages.length === 100,
        },
        { headers },
      );
    }
    if (b.action === "answer") {
      unwrap(
        await db.rpc("submit_adventure_answer", {
          a: b.id,
          r: b.revision,
          answer: text(b.answer, 6000),
        }),
      );
      return Response.json({}, { headers });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      throw new Error(
        "Configure the server-only SUPABASE_SERVICE_ROLE_KEY to enable stories, chat and AI access.",
      );
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const getCharacter = async (id: string) =>
      characterSnapshot(
        unwrap(await db.from("characters").select("*").eq("id", id).single()),
        b.inherit !== false,
        b.characterVoice || b.voice,
      );
    let result: unknown = {};
    switch (b.action) {
      case "aiSettings": {
        const settings = unwrap(
          await admin
            .from("ai_settings")
            .select("provider,model")
            .eq("user_id", user.id)
            .maybeSingle(),
        );
        const usage = unwrap(
          await admin
            .from("ai_usage")
            .select("day,units,calls")
            .eq("user_id", user.id)
            .order("day", { ascending: false })
            .limit(1),
        );
        result = { settings, usage, shared: !!process.env.LORE_AI_KEY };
        break;
      }
      case "saveAI":
        if (b.remove)
          unwrap(
            await admin.from("ai_settings").delete().eq("user_id", user.id),
          );
        else {
          if (!providers[b.provider])
            throw new Error("Choose a supported provider.");
          const previous = unwrap(
            await admin
              .from("ai_settings")
              .select("encrypted_key,provider")
              .eq("user_id", user.id)
              .maybeSingle(),
          );
          if (!b.key && (!previous || previous.provider !== b.provider))
            throw new Error("Enter a key for the selected provider.");
          unwrap(
            await admin.from("ai_settings").upsert({
              user_id: user.id,
              provider: b.provider,
              model: text(b.model || providers[b.provider].model, 150),
              encrypted_key: b.key
                ? encrypt({ key: text(b.key, 500) }, "ai", user.id)
                : previous.encrypted_key,
            }),
          );
        }
        break;
      case "createAdventure": {
        const edition =
          readerEditions.find((e) => e.id === b.edition)?.id || "glorious";
        const id = randomUUID();
        unwrap(
          await admin.from("adventures").insert({
            id,
            owner_id: user.id,
            title:
              typeof b.title === "string" ? b.title.trim().slice(0, 120) : "",
            mode: b.mode === "multiplayer" ? "multiplayer" : "solo",
            world:
              typeof b.world === "string" ? b.world.trim().slice(0, 6000) : "",
            voice: voice(b.voice || { scope: "entire" }),
            edition,
            design: normalizeDesign(b.design, edition),
          }),
        );
        try {
          unwrap(
            await admin.from("adventure_players").insert({
              adventure_id: id,
              user_id: user.id,
              name: profile.name,
              character: b.character ? await getCharacter(b.character) : null,
            }),
          );
        } catch (e) {
          await admin.from("adventures").delete().eq("id", id);
          throw e;
        }
        result = { id };
        break;
      }
      case "selectCharacter": {
        const storyOwner = unwrap(
          await db
            .from("adventures")
            .select("owner_id")
            .eq("id", b.id)
            .single(),
        );
        if (storyOwner.owner_id !== user.id)
          throw new Error("Only the creator can change the cast.");
        await member(db, b.id, false, user.id);
        result = unwrap(
          await admin.rpc("select_adventure_character", {
            a: b.id,
            u: user.id,
            c: b.character ? await getCharacter(b.character) : null,
          }),
        );
        break;
      }
      case "findUsers": {
        const query = text(b.query, 100).replace(/[%_\\]/g, "");
        if (query.length < 2) throw new Error("Enter at least two characters.");
        result = {
          users: unwrap(
            await admin
              .from("profiles")
              .select("id,name")
              .ilike("name", `${query}%`)
              .neq("id", user.id)
              .order("name")
              .limit(20),
          ),
        };
        break;
      }
      case "createChat": {
        if (!Array.isArray(b.people))
          throw new Error("Choose who to chat with.");
        const id = unwrap(
          await admin.rpc("create_user_chat", {
            u: user.id,
            people: b.people,
            chat_kind: b.kind === "direct" ? "direct" : "group",
            chat_title:
              typeof b.title === "string" ? b.title.trim().slice(0, 120) : "",
          }),
        );
        result = { id };
        break;
      }
      case "configureLobby": {
        await member(db, b.id, false, user.id);
        const edition =
          readerEditions.find((e) => e.id === b.edition)?.id || "glorious";
        if (!Array.isArray(b.identities) || b.identities.length > 8)
          throw new Error("Invalid player settings.");
        const identities = b.identities.map(
          (p: {
            user: string;
            name?: string;
            description?: string;
            voice?: unknown;
          }) => ({
            user: p.user,
            name: typeof p.name === "string" ? p.name.trim().slice(0, 100) : "",
            description:
              typeof p.description === "string"
                ? p.description.trim().slice(0, 2000)
                : "",
            voice: playerVoice(p.voice),
          }),
        );
        // A narrator replaces the old writing style for the story as a whole; its
        // persona is copied in so the story keeps it even if the preset changes.
        const chosen =
          typeof b.voice?.narrator === "string" ? b.voice.narrator : "";
        let narrator: Partial<Voice> = {};
        if (chosen === "custom") {
          const persona =
            typeof b.voice.persona === "string"
              ? b.voice.persona.trim().slice(0, 600)
              : "";
          narrator = {
            narrator: "custom",
            narratorName: "a narrator of the player's own design",
            persona,
          };
        } else if (chosen) {
          const preset = (
            await admin
              .from("narrators")
              .select("id,name,persona")
              .eq("id", chosen)
              .maybeSingle()
          ).data;
          if (preset)
            narrator = {
              narrator: preset.id,
              narratorName: preset.name,
              persona: preset.persona,
            };
        }
        const storyVoice: Voice = {
          ...voice(b.voice),
          style: "Modern",
          tone: "Default",
          scope: "entire",
          ...narrator,
        };
        result = unwrap(
          await admin.rpc("configure_adventure", {
            a: b.id,
            u: user.id,
            r: b.revision,
            settings: {
              title:
                typeof b.title === "string" ? b.title.trim().slice(0, 120) : "",
              world:
                typeof b.world === "string"
                  ? b.world.trim().slice(0, 6000)
                  : "",
              voice: storyVoice,
              edition,
              design: normalizeDesign(b.design, edition),
              ai_mode: b.aiMode === "chatgpt" ? "chatgpt" : "api",
            },
            casts: identities,
          }),
        );
        break;
      }
      case "armChatGPT": {
        await member(db, b.id, false, user.id);
        result = unwrap(
          await admin.rpc("arm_chatgpt_story", { a: b.id, u: user.id }),
        );
        break;
      }
      case "inviteUser": {
        await member(db, b.id, false, user.id);
        result = unwrap(
          await admin.rpc("invite_adventure_user", {
            a: b.id,
            u: user.id,
            person: b.person,
          }),
        );
        break;
      }
      case "invite": {
        const chat = b.kind === "chat";
        await member(db, b.id, chat, user.id);
        const s = unwrap(
          await db
            .from(chat ? "chats" : "adventures")
            .select("*")
            .eq("id", b.id)
            .single(),
        );
        if (
          s.owner_id !== user.id ||
          (chat ? s.kind === "direct" : !["lobby", "paused"].includes(s.status))
        )
          throw new Error(
            "Only the creator can invite from a lobby or group chat.",
          );
        const token = randomBytes(32).toString("hex");
        unwrap(
          await admin.from("play_invites").insert({
            token_hash: createHash("sha256").update(token).digest("hex"),
            [chat ? "chat_id" : "adventure_id"]: b.id,
          }),
        );
        result = { token };
        break;
      }
      case "join": {
        if (typeof b.token !== "string" || !/^[a-f0-9]{64}$/.test(b.token))
          throw new Error("Invalid invitation.");
        result = unwrap(
          await admin.rpc("join_play", {
            hash: createHash("sha256").update(b.token).digest("hex"),
            u: user.id,
            player_name: profile.name,
          }),
        );
        break;
      }
      case "deleteAdventure": {
        // Reading through the user's client proves access; only the creator deletes.
        const s = unwrap(
          await db.from("adventures").select("owner_id").eq("id", b.id).single(),
        );
        if (s.owner_id !== user.id)
          throw new Error("Only the creator can delete this story.");
        unwrap(
          await admin
            .from("adventures")
            .delete()
            .eq("id", b.id)
            .eq("owner_id", user.id),
        );
        break;
      }
      case "status": {
        await member(db, b.id, false, user.id);
        result = unwrap(
          await admin.rpc("set_adventure_status", {
            a: b.id,
            u: user.id,
            next_status: b.status,
          }),
        );
        break;
      }
      case "generate": {
        const s: Adventure = unwrap(
          await db.from("adventures").select("*").eq("id", b.id).single(),
        );
        if (s.ai_mode === "chatgpt")
          throw new Error(
            "Continue this session in your connected ChatGPT chat.",
          );
        const ending = b.ending === true;
        if (
          (["lobby", "paused"].includes(s.status) || ending) &&
          s.owner_id !== user.id
        )
          throw new Error(
            "Only the Session Master can start or conclude the adventure.",
          );
        const token = unwrap(
          await admin.rpc("lease_adventure", { a: s.id, ending }),
        );
        if (!token) {
          result = { waiting: true };
          break;
        }
        try {
          const fresh: Adventure = unwrap(
            await admin.from("adventures").select("*").eq("id", s.id).single(),
          );
          const players: Player[] = unwrap(
            await db
              .from("adventure_players")
              .select("*")
              .eq("adventure_id", s.id),
          );
          const { system, prompt, actions, history } = storyRequest(
            fresh,
            players,
            ending,
          );
          const output = await generateAI(
            admin,
            fresh.owner_id,
            system,
            prompt,
            6,
            false,
            history,
            9000,
          );
          const decoded = decodeNarratorOutput(output);
          if (
            !fresh.segments.length &&
            ((!fresh.title &&
              !(typeof decoded.title === "string" && decoded.title.trim())) ||
              (!fresh.world &&
                !(typeof decoded.world === "string" && decoded.world.trim())))
          )
            throw new Error(
              "The narrator did not finish the world setup. Retry the opening.",
            );
          const turn = parseTurn(
            JSON.stringify(decoded),
            players.map((p) => p.user_id),
            ending,
          );
          const resolvedActions = validateResolutions(
            decoded.resolvedActions,
            turn.narrative,
            actions,
          );
          const committed = unwrap(
            await admin.rpc("commit_adventure_scene", {
              a: s.id,
              token,
              segment: {
                narrative: turn.narrative,
                questions: turn.questions,
                resolvedActions,
                created: new Date().toISOString(),
              },
              story_title:
                typeof decoded.title === "string"
                  ? decoded.title.slice(0, 120)
                  : "",
              story_world:
                typeof decoded.world === "string"
                  ? decoded.world.slice(0, 6000)
                  : "",
              memory: turn.summary,
              ending,
            }),
          );
          if (!committed)
            throw new Error("Generation expired. Reload and retry.");
        } catch (e) {
          await admin
            .from("adventures")
            .update({
              generation_token: null,
              generating_until: null,
              last_error: e instanceof Error ? e.message : "Generation failed.",
            })
            .eq("id", s.id)
            .eq("generation_token", token);
          throw e;
        }
        break;
      }
      case "sendMessage": {
        const p = await member(db, b.id, true, user.id);
        const original = text(b.message, 6000),
          id = text(b.messageId, 36);
        if (!/^[a-f0-9-]{36}$/i.test(id))
          throw new Error("Invalid message ID.");
        const c = b.character ? await getCharacter(b.character) : null;
        const v = voice(b.voice);
        const transform = !!c || b.transform === true;
        const existing = unwrap(
          await db
            .from("chat_messages")
            .select("id")
            .eq("id", id)
            .maybeSingle(),
        );
        if (existing) {
          result = { id };
          break;
        }
        const recent = unwrap(
          await admin
            .from("chat_messages")
            .select("id")
            .eq("user_id", user.id)
            .gte("created_at", new Date(Date.now() - 60000).toISOString())
            .limit(31),
        );
        if (recent.length >= 30)
          throw new Error("Please slow down; 30 messages per minute.");
        unwrap(
          await admin.from("chat_messages").insert({
            id,
            chat_id: b.id,
            user_id: user.id,
            name: p.name,
            original,
            content: transform ? null : original,
            character: c,
            voice: transform ? v : null,
            status: transform ? "pending" : "sent",
          }),
        );
        if (transform) {
          try {
            const transformed = await generateAI(
              admin,
              user.id,
              `Transform a message without answering it. Preserve exact meaning, facts, names, numbers and negations. Never add new claims. Return only the transformed message. ${voicePrompt(v, true)} ${c ? `Character: ${JSON.stringify(c)}` : ""}`,
              original,
              1,
            );
            unwrap(
              await admin
                .from("chat_messages")
                .update({ content: transformed, status: "sent" })
                .eq("id", id),
            );
          } catch (e) {
            await admin
              .from("chat_messages")
              .update({ status: "failed" })
              .eq("id", id);
            throw e;
          }
        }
        result = { id };
        break;
      }
      case "exportCollection": {
        const chat = b.kind === "chat";
        await member(db, b.id, chat, user.id);
        let title: string,
          content: string,
          started = new Date().toISOString();
        let savedMessages: Record<string, unknown>[] | undefined;
        if (chat) {
          const c = unwrap(
            await db.from("chats").select("*").eq("id", b.id).single(),
          );
          title =
            typeof b.title === "string" && b.title.trim()
              ? text(b.title, 120)
              : c.title;
          let messages = await chatHistory(db, b.id);
          if (Array.isArray(b.messageIds)) {
            const selected = new Set(b.messageIds);
            if (
              !selected.size ||
              selected.size > 5000 ||
              messages.filter((m) => selected.has(m.id)).length !==
                selected.size
            )
              throw new Error("Invalid message selection.");
            messages = messages.filter((m) => selected.has(m.id));
          }
          savedMessages = conversationMessages(
            messages,
            b.interactions === true,
          );
          content = messages
            .map(
              (m) =>
                `**${m.character?.name || m.name}:** ${m.content || m.original}${b.interactions && m.content && m.content !== m.original ? `\n\n> Original: ${m.original}` : ""}`,
            )
            .join("\n\n");
        } else {
          const s: Adventure = unwrap(
            await db.from("adventures").select("*").eq("id", b.id).single(),
          );
          title = s.title;
          // Date the saved copy like the live story: when the adventure began.
          started = s.segments[0]?.created || started;
          content = storyMarkdown(
            s,
            unwrap(
              await db
                .from("adventure_players")
                .select("*")
                .eq("adventure_id", b.id),
            ),
            b.interactions === true,
            Array.isArray(b.hiddenDecisions)
              ? b.hiddenDecisions
                  .filter((k: unknown) => typeof k === "string")
                  .slice(0, 5000)
              : [],
          );
        }
        if (!content.trim())
          throw new Error("There is no story to export yet.");
        const collection = unwrap(
          await db
            .from("collections")
            .select("id")
            .eq("id", b.collection)
            .single(),
        );
        const id = randomUUID();
        const payload = encrypt(
          {
            id,
            title,
            type: chat ? "discussion" : "story",
            source: "LoreKeeper",
            score: 0,
            reason: chat ? "Saved conversation" : "Interactive adventure",
            messages: savedMessages || [
              {
                id: randomUUID(),
                author: "",
                timestamp: started,
                content,
                source: "LoreKeeper",
                sourceFormat: "markdown",
              },
            ],
          },
          collection.id,
          id,
        );
        unwrap(
          await db.rpc("save_entry", {
            p_id: id,
            p_collection: collection.id,
            p_payload: payload,
            p_authors: [{ author: profile.name, userId: user.id }],
            p_update: false,
          }),
        );
        unwrap(
          await admin
            .from("entries")
            .update({ [chat ? "source_chat_id" : "source_adventure_id"]: b.id })
            .eq("id", id)
            .eq("collection_id", collection.id),
        );
        result = { id };
        break;
      }
      default:
        throw new Error("Unknown play action.");
    }
    return Response.json(result, { headers });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Request failed." },
      { status: e instanceof AIError ? e.publicStatus : 400, headers },
    );
  }
}
