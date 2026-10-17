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
  playerVoice,
  storySetup,
  themeIds,
  speechLine,
  storyMarkdown,
  type Adventure,
  type Player,
  type Voice,
  type PlayerVoice,
} from "@/lib/play";
import { readerEditions } from "@/lib/reader-editions";
import { normalizeDesign } from "@/lib/edition-design";
import { storyRequest, decodeNarratorOutput } from "@/lib/story-narrator";
import { THEME_HINTS } from "@/lib/roleplay-prompt";
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
// A player's character settings; a voice preset becomes a short line
// ("talks like a pirate captain").
async function castSettings(
  admin: SupabaseClient,
  p: { user: string; name?: unknown; description?: unknown; voice?: unknown },
) {
  let v: PlayerVoice | null = playerVoice(p.voice);
  if (v?.narrator) {
    const preset = (
      await admin
        .from("narrators")
        .select("persona")
        .eq("id", v.narrator)
        .maybeSingle()
    ).data;
    v = preset ? { ...v, speech: speechLine(preset.persona) } : null;
  }
  return {
    user: p.user,
    name: typeof p.name === "string" ? p.name.trim().slice(0, 100) : "",
    description:
      typeof p.description === "string"
        ? p.description.trim().slice(0, 2000)
        : "",
    voice: v,
  };
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
      // Opening a conversation marks it read (best effort: the key may be missing).
      if (process.env.SUPABASE_SERVICE_ROLE_KEY)
        await createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { persistSession: false, autoRefreshToken: false } },
        )
          .from("chat_players")
          .update({ read_at: new Date().toISOString() })
          .eq("chat_id", b.id)
          .eq("user_id", user.id);
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
        const keys = unwrap(
          await admin
            .from("ai_settings")
            .select("provider,model")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false }),
        );
        const usage = unwrap(
          await admin
            .from("ai_usage")
            .select("day,units,calls")
            .eq("user_id", user.id)
            .order("day", { ascending: false })
            .limit(1),
        );
        result = { keys, usage, shared: !!process.env.LORE_AI_KEY };
        break;
      }
      case "saveAI":
        if (b.remove) {
          if (!providers[b.provider])
            throw new Error("Choose a supported provider.");
          unwrap(
            await admin
              .from("ai_settings")
              .delete()
              .eq("user_id", user.id)
              .eq("provider", b.provider),
          );
        } else {
          if (!providers[b.provider])
            throw new Error("Choose a supported provider.");
          const previous = unwrap(
            await admin
              .from("ai_settings")
              .select("encrypted_key")
              .eq("user_id", user.id)
              .eq("provider", b.provider)
              .maybeSingle(),
          );
          if (!b.key && !previous)
            throw new Error("Enter a key for the selected provider.");
          unwrap(
            await admin.from("ai_settings").upsert({
              user_id: user.id,
              provider: b.provider,
              model: text(b.model || providers[b.provider].model, 150),
              encrypted_key: b.key
                ? encrypt({ key: text(b.key, 500) }, "ai", user.id)
                : previous.encrypted_key,
              updated_at: new Date().toISOString(),
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
            setup: { step: 1 },
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
        if (
          b.identities !== undefined &&
          (!Array.isArray(b.identities) || b.identities.length > 8)
        )
          throw new Error("Invalid player settings.");
        const identities = await Promise.all(
          (b.identities || []).map((p: { user: string }) =>
            castSettings(admin, p),
          ),
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
        const aiProvider =
          b.aiProvider === "shared" || providers[b.aiProvider]
            ? b.aiProvider
            : null;
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
              ai_provider: aiProvider,
              ...(b.setup !== undefined ? { setup: storySetup(b.setup) } : {}),
            },
            casts: identities,
          }),
        );
        break;
      }
      case "configurePlayer": {
        // Everyone sets up their own character; the creator may set up anyone's.
        await member(db, b.id, false, user.id);
        const s = unwrap(
          await db.from("adventures").select("owner_id").eq("id", b.id).single(),
        );
        const target = typeof b.player === "string" ? b.player : user.id;
        if (target !== user.id && s.owner_id !== user.id)
          throw new Error("Only the creator can change another player's character.");
        const cast = await castSettings(admin, { ...b, user: target });
        unwrap(
          await admin
            .from("adventure_players")
            .update({
              identity_name: cast.name,
              description: cast.description,
              voice: cast.voice,
              character: null,
            })
            .eq("adventure_id", b.id)
            .eq("user_id", target)
            .select("user_id")
            .single(),
        );
        break;
      }
      case "aiOptions": {
        const keys = unwrap(
          await admin
            .from("ai_settings")
            .select("provider,model")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false }),
        );
        result = { keys, shared: !!process.env.LORE_AI_KEY };
        break;
      }
      case "questIdeas": {
        const s: Adventure = unwrap(
          await db.from("adventures").select("*").eq("id", b.id).single(),
        );
        if (s.owner_id !== user.id)
          throw new Error("Only the creator can conjure new quests.");
        const theme = themeIds.includes(b.theme) ? b.theme : s.setup?.theme;
        const avoid = Array.isArray(b.avoid)
          ? b.avoid.filter((t: unknown) => typeof t === "string").slice(0, 20)
          : [];
        const output = await generateAI(
          admin,
          user.id,
          `Return JSON: {"quests": [{"title": short title, "pitch": one teasing line, "story": the premise in 2-3 plain sentences, written by the player ("I …")}]}.`,
          `Give me 3 fresh, fun ideas for a roleplay${theme ? ` (${THEME_HINTS[theme]})` : ""}.${avoid.length ? ` Not these: ${avoid.join("; ")}.` : ""}`,
          1,
          true,
          [],
          undefined,
          s.ai_mode === "chatgpt" ? null : s.ai_provider,
        );
        let quests: unknown[] = [];
        try {
          const data = JSON.parse(
            output.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
          );
          quests = Array.isArray(data.quests) ? data.quests : [];
        } catch {}
        const ideas = storySetup({ ideas: quests })!.ideas!;
        if (!ideas.length)
          throw new Error("The AI's ideas got lost in the fog. Try again.");
        result = { ideas };
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
        // The invitation also lands in your direct chat with them. The player has
        // already joined, so a failed message never undoes the invitation.
        try {
          const s = unwrap(
            await admin
              .from("adventures")
              .select("title,setup")
              .eq("id", b.id)
              .single(),
          );
          const chat = unwrap(
            await admin.rpc("create_user_chat", {
              u: user.id,
              people: [b.person],
              chat_kind: "direct",
              chat_title: "",
            }),
          );
          const line = `${profile.name} has invited you to ${s.title ? `“${s.title}”` : "a new adventure"}.`;
          unwrap(
            await admin.from("chat_messages").insert({
              id: randomUUID(),
              chat_id: chat,
              user_id: user.id,
              name: profile.name,
              original: line,
              content: line,
              kind: "invite",
              meta: { adventure: b.id, title: s.title || "", theme: s.setup?.theme || null },
              status: "sent",
            }),
          );
        } catch (e) {
          console.error("Invitation message not sent", e);
        }
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
          const { system, prompt } = storyRequest(fresh, players, ending);
          const output = await generateAI(
            admin,
            fresh.owner_id,
            system,
            prompt,
            6,
            false,
            [],
            9000,
            fresh.ai_provider,
          );
          const turn = decodeNarratorOutput(
            output,
            players.map((p) => p.user_id),
            ending,
          );
          const committed = unwrap(
            await admin.rpc("commit_adventure_scene", {
              a: s.id,
              token,
              segment: {
                narrative: turn.narrative,
                questions: turn.questions,
                created: new Date().toISOString(),
              },
              story_title: turn.title,
              story_world: turn.world,
              memory: turn.summary || fresh.summary,
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
        const mode: "plain" | "rewrite" | "instruct" = ["rewrite", "instruct"].includes(b.mode)
            ? b.mode
            : "plain",
          original = text(b.message, 6000),
          id = text(b.messageId, 36);
        if (!/^[a-f0-9-]{36}$/i.test(id))
          throw new Error("Invalid message ID.");
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
        // Replies and context must come from this conversation.
        const ownMessages = async (ids: unknown[]) => {
          const wanted = ids.filter((x): x is string => typeof x === "string").slice(0, 40);
          return wanted.length
            ? (unwrap(
                await db
                  .from("chat_messages")
                  .select("id,name,original,content,character")
                  .eq("chat_id", b.id)
                  .in("id", wanted)
                  .order("created_at"),
              ) as { id: string; name: string; original: string; content: string | null; character: { name?: string } | null }[])
            : [];
        };
        const replyTo =
          typeof b.replyTo === "string" && (await ownMessages([b.replyTo])).length
            ? b.replyTo
            : null;
        // A writing voice (a narrators preset) and a language for AI messages.
        const language =
          typeof b.language === "string" ? b.language.trim().slice(0, 60) : "";
        const preset =
          typeof b.voice === "string" && /^[a-z0-9-]{2,40}$/.test(b.voice)
            ? (
                await admin
                  .from("narrators")
                  .select("id,name,persona")
                  .eq("id", b.voice)
                  .maybeSingle()
              ).data
            : null;
        if (mode === "rewrite" && !preset && !language)
          throw new Error("Choose a voice or a language to rewrite in.");
        const ai = mode !== "plain";
        unwrap(
          await admin.from("chat_messages").insert({
            id,
            chat_id: b.id,
            user_id: user.id,
            name: p.name,
            original,
            content: ai ? null : original,
            voice: ai
              ? { narrator: preset?.id, name: preset?.name, language: language || undefined }
              : null,
            meta: ai ? { mode, voice: preset?.name || language } : null,
            reply_to: replyTo,
            status: ai ? "pending" : "sent",
          }),
        );
        if (ai) {
          try {
            const people = unwrap(
              await db.from("chat_players").select("user_id,name").eq("chat_id", b.id),
            ) as { user_id: string; name: string }[];
            const partner =
              people
                .filter((x) => x.user_id !== user.id)
                .map((x) => x.name)
                .join(" and ") || "my friend";
            const how = [preset?.persona, language && `Write in ${language}.`]
              .filter(Boolean)
              .join(" ");
            const context = (
              await ownMessages(Array.isArray(b.context) ? b.context : [])
            )
              .map((m) => `${m.character?.name || m.name}: ${m.content || m.original}`)
              .join("\n");
            // Short on purpose, like the story prompts: what to do, in whose voice.
            const [system, prompt] =
              mode === "rewrite"
                ? [
                    `Rewrite my chat message. ${how} Keep what it says. Reply with the rewritten message only.`,
                    original,
                  ]
                : [
                    `You write my next chat message to ${partner}.${how ? ` ${how}` : ""} Reply with the message only.`,
                    `${context ? `Our conversation so far:\n${context}\n\n` : ""}What to write: ${original}`,
                  ];
            const written = await generateAI(
              admin,
              user.id,
              system,
              prompt,
              1,
              false,
              [],
              undefined,
              b.aiProvider === "shared" || providers[b.aiProvider] ? b.aiProvider : null,
            );
            unwrap(
              await admin
                .from("chat_messages")
                .update({ content: written.trim().slice(0, 12000), status: "sent" })
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
      case "chatHall": {
        result = unwrap(await admin.rpc("chat_hall", { u: user.id }));
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
