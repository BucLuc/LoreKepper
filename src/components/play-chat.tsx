"use client";
import { conversationMessages, messageRange } from "@/lib/chat-selection";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { playApi } from "@/lib/play-client";
import { supabase } from "@/lib/supabase";
import type { Character } from "@/lib/play";
import { prepareEntries } from "@/lib/archive";
import { presetDesign } from "@/lib/edition-design";
import { providerName } from "@/lib/ai-config";
import { themeOf } from "@/lib/story-themes";
import { EditionMarkdown } from "./edition-markdown";
import { PlayExport } from "./play-export";
import { Modal, SkeletonLines } from "./vault-ui";
import { Icon } from "./icon";
import { Feedback } from "./feedback";
import { Crumbs } from "./crumbs";
import { Sigil } from "./chat-hall";
import { VoiceGrid } from "./story-party";
import { useNarratorPresets } from "./narrator-picker";
import { useAIOptions } from "./story-form";
import { languages } from "./voice-settings";
type ChatMessage = {
  id: string;
  user_id: string;
  name: string;
  original: string;
  content: string | null;
  status: string;
  kind?: "text" | "invite";
  meta?: { mode?: "rewrite" | "instruct"; voice?: string; adventure?: string; title?: string; theme?: string | null } | null;
  reply_to?: string | null;
  character: Character | null;
  created_at: string;
};
type Data = {
  chat: { title: string; owner_id: string; kind?: string };
  players: { user_id: string; name: string }[];
  messages: ChatMessage[];
  more?: boolean;
};
type Mode = "plain" | "rewrite" | "instruct";
// How you write, remembered on this device: mode, voice, language and AI.
type Quill = { mode: Mode; voice: string; language: string; ai: string };
const QUILL_KEY = "lorekeeper-chat-quill";
const modes: [Mode, string, string][] = [
  ["plain", "As myself", "Sent exactly as you write it."],
  ["rewrite", "Rewrite in a voice", "You write it; the AI says it in your chosen voice."],
  ["instruct", "Let the quill write", "Tell the AI what to write; it writes the message for you."],
];
const plainText = (t: string, n: number) => t.replace(/[#*_>`]/g, "").slice(0, n);
export function PlayChat({
  id,
  initialData,
  initialUser = "",
}: {
  id: string;
  initialData?: Data;
  initialUser?: string;
}) {
  const [data, setData] = useState<Data | null>(initialData || null),
    [user, setUser] = useState(initialUser),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [quill, setQuillState] = useState<Quill>({ mode: "plain", voice: "", language: "", ai: "" }),
    [voiceOpen, setVoiceOpen] = useState(false),
    [replyTo, setReplyTo] = useState<string | null>(null),
    // Marking messages: for the gallery, or as context for the quill.
    [picking, setPicking] = useState<"gallery" | "context" | null>(null),
    [marked, setMarked] = useState<string[]>([]),
    [context, setContext] = useState<string[]>([]),
    [anchor, setAnchor] = useState(""),
    [exporting, setExporting] = useState(false),
    [originals, setOriginals] = useState(false);
  const full = useRef(false),
    retryId = useRef<string | null>(null),
    end = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  const { presets, loaded: presetsLoaded } = useNarratorPresets();
  const { options: ai } = useAIOptions(!initialData);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(QUILL_KEY) || "null");
      if (saved && typeof saved === "object") queueMicrotask(() => setQuillState((q) => ({ ...q, ...saved })));
    } catch {}
  }, []);
  const setQuill = (change: Partial<Quill>) =>
    setQuillState((q) => {
      const next = { ...q, ...change };
      try {
        localStorage.setItem(QUILL_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  const load = useCallback(
    async () => setData(initialData || (await playApi("chat", { id, all: full.current }))),
    [id, initialData],
  );
  useEffect(() => {
    if (initialData) return;
    let alive = true;
    const refresh = () => {
      if (!document.hidden)
        playApi("chat", { id, all: full.current })
          .then((r) => alive && setData(r))
          .catch((e) => alive && setError(e.message));
    };
    refresh();
    playApi("viewer")
      .then((r) => alive && setUser(r.user))
      .catch(() => {});
    const channel = supabase()
      .channel(`chat:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `chat_id=eq.${id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_players", filter: `chat_id=eq.${id}` }, refresh)
      .subscribe((s) => {
        if (s === "SUBSCRIBED") refresh();
      });
    const poll = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      clearInterval(poll);
      void supabase().removeChannel(channel);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [id, initialData]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [data?.messages.length]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const messages = data?.messages || [],
    byId = new Map(messages.map((m) => [m.id, m])),
    others = (data?.players || []).filter((p) => p.user_id !== user),
    direct = data?.chat.kind === "direct",
    title = direct ? others.map((p) => p.name).join(" & ") || "A quiet table" : data?.chat.title || "Chat",
    voice = presets.find((p) => p.id === quill.voice),
    quillAI = quill.ai || (ai?.shared ? "shared" : ai?.keys[0]?.provider || ""),
    noAI = !!ai && !ai.shared && !ai.keys.length;
  // Marked messages in conversation order (all of them when none are marked).
  const chosen = marked.length ? messages.filter((m) => marked.includes(m.id)) : messages;
  const entry = prepareEntries([
    {
      id,
      title,
      type: "discussion",
      score: 0,
      reason: "Saved conversation",
      source: "LoreKeeper",
      messages: chosen.length
        ? conversationMessages(chosen, originals)
        : [{ id, author: "Players", content: "*No messages yet.*", timestamp: "", source: "LoreKeeper", sourceFormat: "markdown" }],
    },
  ])[0];
  const content = chosen
    .map(
      (m) =>
        `**${m.character?.name || m.name}:** ${m.content || m.original}${originals && m.content && m.content !== m.original ? `\n\n> Original: ${m.original}` : ""}`,
    )
    .join("\n\n");
  // Click marks one message; Shift+click marks everything since the last one.
  const pick = (m: ChatMessage, e: MouseEvent) => {
    const set = picking === "context" ? setContext : setMarked;
    if (e.shiftKey && anchor) {
      const range = messageRange(messages, anchor, m.id);
      set((ids) => [...new Set([...ids, ...range])]);
    } else set((ids) => (ids.includes(m.id) ? ids.filter((x) => x !== m.id) : [...ids, m.id]));
    setAnchor(m.id);
  };
  async function send() {
    const messageId = retryId.current || crypto.randomUUID();
    retryId.current = messageId;
    try {
      await playApi("sendMessage", {
        id,
        message,
        messageId,
        mode: quill.mode,
        voice: quill.voice || undefined,
        language: quill.language || undefined,
        aiProvider: quillAI || undefined,
        replyTo,
        context: quill.mode === "instruct" ? context : [],
      });
      setMessage("");
      setReplyTo(null);
      setContext([]);
      retryId.current = null;
    } catch (e) {
      await load();
      const { data: saved } = await supabase().from("chat_messages").select("id").eq("id", messageId).maybeSingle();
      if (saved) {
        setMessage("");
        retryId.current = null;
      }
      throw e;
    }
    await load();
  }
  const replying = replyTo ? byId.get(replyTo) : null;
  const rewriteNeedsVoice = quill.mode === "rewrite" && !quill.voice && !quill.language;
  const markedNow = picking === "context" ? context : marked;
  const dayOf = (m: ChatMessage) => new Date(m.created_at).toDateString();
  return (
    <main id="main" className="lkx-chat">
      <header className="lkx-chat-head">
        <Crumbs items={[{ label: "Chat", href: "/chat" }, { label: data ? title : "…" }]} />
        <div className="lkx-chat-who">
          {data ? <Sigil name={title} size="is-large" /> : <span className="skeleton-seal" aria-hidden="true" />}
          <div>
            {data ? <h1>{title}</h1> : <SkeletonLines lines={1} label="Opening the conversation" />}
            <small>
              {data
                ? `${messages.length ? `${messages.length} message${messages.length === 1 ? "" : "s"}` : "A fresh table"}${direct ? "" : ` · ${data.players.map((p) => p.name).join(", ")}`}`
                : ""}
            </small>
          </div>
        </div>
        <div className="lkx-chat-tools">
          <button
            type="button"
            className="lkx-chat-tool"
            aria-pressed={picking === "gallery"}
            disabled={busy || !messages.length}
            onClick={() =>
              void run(async () => {
                full.current = true;
                await load();
                setPicking((p) => (p === "gallery" ? null : "gallery"));
              })
            }
          >
            <Icon name="check" /> Mark messages
          </button>
          <button
            type="button"
            className="lkx-chat-tool"
            disabled={busy || !messages.length}
            onClick={() =>
              void run(async () => {
                full.current = true;
                await load();
                setExporting(true);
              })
            }
          >
            <Icon name="export" /> Save to the gallery
          </button>
        </div>
      </header>
      {error && (
        <Feedback error onDismiss={() => setError("")}>
          {error}
        </Feedback>
      )}
      <section className="lkx-chat-scroll" aria-label="Messages" aria-live="polite" data-picking={picking || undefined}>
        {data?.more && (
          <button
            className="lk-text-button lkx-chat-earlier"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                full.current = true;
                await load();
              })
            }
          >
            Load earlier messages
          </button>
        )}
        {!data && (
          <div className="lk-chat-skeleton" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonLines key={i} lines={2} className={i % 2 ? "is-mine" : ""} />
            ))}
          </div>
        )}
        {data && !messages.length && (
          <div className="lkx-chat-empty">
            <span aria-hidden="true">🕯️</span>
            <h2>The first word is yours.</h2>
            <p>Speak plainly, borrow a voice, or let the quill write it for you.</p>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.user_id === user,
            divider = !i || dayOf(messages[i - 1]) !== dayOf(m),
            parent = m.reply_to ? byId.get(m.reply_to) : null,
            isMarked = markedNow.includes(m.id);
          return (
            <div key={m.id} className={`lkx-chat-row ${mine ? "is-mine" : ""}`}>
              {divider && (
                <div className="lkx-chat-day">
                  <span>
                    {new Date(m.created_at).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                </div>
              )}
              <article
                id={`msg-${m.id}`}
                className={`lkx-msg ${mine ? "is-mine" : ""} ${m.kind === "invite" ? "is-invite" : ""}`}
                data-marked={isMarked || undefined}
                onClick={picking ? (e) => pick(m, e) : undefined}
              >
                {picking && (
                  <span className="lkx-msg-check" aria-hidden="true">
                    {isMarked ? "✓" : ""}
                  </span>
                )}
                {!mine && !direct && <strong className="lkx-msg-name">{m.character?.name || m.name}</strong>}
                {parent && (
                  <a className="lkx-msg-quote" href={`#msg-${parent.id}`} onClick={(e) => picking && e.preventDefault()}>
                    <b>{parent.user_id === user ? "You" : parent.name}</b>
                    {plainText(parent.content || parent.original, 120)}
                  </a>
                )}
                {m.kind === "invite" && m.meta?.adventure ? (
                  <div className="lkx-invite-card">
                    <span className="lkx-invite-sigil" aria-hidden="true">
                      {themeOf(m.meta.theme)?.sigil || "⚔️"}
                    </span>
                    <span className="lkx-eyebrow">A summons</span>
                    <strong>{m.meta.title || "A new adventure"}</strong>
                    <p>{mine ? `You invited ${title} to this tale.` : `${m.name} has invited you to join the tale.`}</p>
                    <Link className="gold-button lkx-begin" href={`/interactive/${m.meta.adventure}`}>
                      Enter the lobby <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                ) : m.status === "pending" ? (
                  <div className="lkx-msg-writing">
                    <span>✒ The quill is writing{m.meta?.voice ? ` as ${m.meta.voice}` : ""}…</span>
                    <SkeletonLines lines={2} />
                  </div>
                ) : (
                  <EditionMarkdown text={m.content || m.original} style="dark" />
                )}
                {m.status === "failed" && (
                  <small className="lkx-msg-note">The quill failed. This is what you wrote.</small>
                )}
                <footer>
                  {m.meta?.mode && m.status === "sent" && (
                    <span className="lkx-msg-badge">
                      {m.meta.mode === "instruct" ? "✦ Written by the quill" : "✒ Rewritten"}
                      {m.meta.voice ? ` · ${m.meta.voice}` : ""}
                    </span>
                  )}
                  <time dateTime={m.created_at}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </time>
                  {!picking && m.kind !== "invite" && (
                    <button
                      type="button"
                      className="lkx-msg-reply"
                      onClick={() => {
                        setReplyTo(m.id);
                        input.current?.focus();
                      }}
                    >
                      Reply
                    </button>
                  )}
                </footer>
                {m.content && m.content !== m.original && m.status === "sent" && (
                  <details className="lkx-msg-original">
                    <summary>{m.meta?.mode === "instruct" ? "The instruction" : "The original"}</summary>
                    <p>{m.original}</p>
                  </details>
                )}
              </article>
            </div>
          );
        })}
        <div ref={end} />
      </section>
      {picking ? (
        <div className="lkx-chat-pickbar" role="region" aria-label={picking === "context" ? "Choose context" : "Marked messages"}>
          <div>
            <strong>
              {picking === "context"
                ? `${context.length} message${context.length === 1 ? "" : "s"} as context for the quill`
                : `${marked.length} message${marked.length === 1 ? "" : "s"} marked`}
            </strong>
            <small>Click a message to mark it · Shift+click marks a whole stretch</small>
          </div>
          <button type="button" className="lk-text-button" onClick={() => (picking === "context" ? setContext : setMarked)(messages.map((m) => m.id))}>
            All
          </button>
          <button type="button" className="lk-text-button" onClick={() => (picking === "context" ? setContext : setMarked)([])}>
            None
          </button>
          <button type="button" className="lk-text-button" onClick={() => setPicking(null)}>
            {picking === "gallery" ? "Done" : "Cancel"}
          </button>
          {picking === "gallery" ? (
            <button type="button" className="gold-button lkx-begin" disabled={!marked.length} onClick={() => setExporting(true)}>
              Save to the gallery <span aria-hidden="true">→</span>
            </button>
          ) : (
            <button type="button" className="gold-button lkx-begin" onClick={() => setPicking(null)}>
              Use as context <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      ) : (
        data && (
          <form
            className="lkx-compose"
            onSubmit={(e) => {
              e.preventDefault();
              void run(send);
            }}
          >
            <div className="lkx-compose-modes">
              <div className="lkx-segments" role="group" aria-label="How to write">
                {modes.map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={quill.mode === value}
                    disabled={busy || (value !== "plain" && noAI)}
                    title={value !== "plain" && noAI ? "No AI available: add a key under AI access" : undefined}
                    onClick={() => setQuill({ mode: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {quill.mode !== "plain" && (
                <>
                  <button type="button" className="lkx-compose-chip" onClick={() => setVoiceOpen(true)}>
                    🎭 {voice?.name || (quill.voice ? "…" : "My own voice")}
                    {quill.language ? ` · ${quill.language}` : ""}
                  </button>
                  {quill.mode === "instruct" && (
                    <button
                      type="button"
                      className="lkx-compose-chip"
                      onClick={() => {
                        full.current = true;
                        void load();
                        setPicking("context");
                      }}
                    >
                      📜 {context.length ? `${context.length} messages as context` : "Add context"}
                    </button>
                  )}
                  {ai && (ai.shared || ai.keys.length > 0) && (
                    <label className="lkx-quill-select" title="Which AI writes">
                      <span aria-hidden="true">✒</span>
                      <span className="sr-only">Which AI writes</span>
                      <select value={quillAI} onChange={(e) => setQuill({ ai: e.target.value })}>
                        {ai.shared && <option value="shared">Lorekeeper&apos;s free AI</option>}
                        {ai.keys.map((k) => (
                          <option key={k.provider} value={k.provider}>
                            {providerName(k.provider)} · your key
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}
            </div>
            {replying && (
              <div className="lkx-compose-reply">
                <span>
                  Replying to <b>{replying.user_id === user ? "yourself" : replying.name}</b>:{" "}
                  {plainText(replying.content || replying.original, 90)}
                </span>
                <button type="button" aria-label="Cancel the reply" onClick={() => setReplyTo(null)}>
                  <Icon name="close" />
                </button>
              </div>
            )}
            <div className="lkx-compose-row">
              <textarea
                ref={input}
                aria-label="Message"
                rows={2}
                required
                maxLength={6000}
                disabled={busy}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  retryId.current = null;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={
                  quill.mode === "plain"
                    ? "Say something worth preserving…"
                    : quill.mode === "rewrite"
                      ? `Write it plainly; it arrives ${voice ? `as ${voice.name}` : "in your chosen voice"}…`
                      : "Tell the quill what to write, e.g. distract him with a wild tale about geese…"
                }
              />
              <button
                className="lkx-compose-send"
                disabled={busy || !message.trim() || rewriteNeedsVoice}
                title={rewriteNeedsVoice ? "Choose a voice or language first" : undefined}
              >
                {busy ? (quill.mode === "plain" ? "Sending…" : "Writing…") : quill.mode === "instruct" ? "Write it" : "Send"}
                <Icon name="arrow" />
              </button>
            </div>
            <div className="lkx-compose-hint">
              <span>{modes.find((x) => x[0] === quill.mode)![2]}</span>
              <span>
                <kbd>Enter</kbd> sends · <kbd>Shift + Enter</kbd> new line
              </span>
            </div>
          </form>
        )
      )}
      {voiceOpen && (
        <Modal open wide title="Whose voice do you borrow?" onClose={() => setVoiceOpen(false)}>
          <div className="lkx-sheet lkx-chat-voices">
            <VoiceGrid
              presets={presets}
              loaded={presetsLoaded}
              value={quill.voice}
              onChange={(voiceId) => setQuill({ voice: voiceId })}
              initialTheme={voice?.mood || ""}
              plain={{ name: "My own voice", hint: "No special voice: just the language below, or tidied up." }}
            />
            <div className="lkx-chat-voices-foot">
              <label className="lkx-field">
                <span>Language</span>
                <select value={quill.language} onChange={(e) => setQuill({ language: e.target.value })}>
                  <option value="">As I write it</option>
                  {languages.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="gold-button lkx-begin" onClick={() => setVoiceOpen(false)}>
                Use this voice <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
      {exporting && (
        <PlayExport
          id={id}
          title={title}
          entry={entry}
          edition="dark"
          design={presetDesign("dark")}
          content={content}
          interactions={originals}
          onInteractions={setOriginals}
          onClose={() => setExporting(false)}
          kind="chat"
          messageIds={marked.length ? marked : undefined}
          initialFormat="collection"
        />
      )}
    </main>
  );
}
