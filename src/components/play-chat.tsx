"use client";
import {
  messageRange,
  selectedMessages,
  conversationMessages,
} from "@/lib/chat-selection";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { playApi } from "@/lib/play-client";
import { supabase } from "@/lib/supabase";
import { defaultVoice, type Voice, type Character } from "@/lib/play";
import { prepareEntries } from "@/lib/archive";
import { presetDesign } from "@/lib/edition-design";
import { EditionMarkdown } from "./edition-markdown";
import { VoiceSettings } from "./voice-settings";
import { PlayExport } from "./play-export";
import { Modal } from "./vault-ui";
import { Icon } from "./icon";
type ChatMessage = {
  id: string;
  user_id: string;
  name: string;
  original: string;
  content: string | null;
  status: string;
  character: Character | null;
  created_at: string;
};
type Data = {
  chat: { title: string; owner_id: string; kind?: string };
  players: { user_id: string; name: string }[];
  messages: ChatMessage[];
  more?: boolean;
};
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
    [mode, setMode] = useState("normal"),
    [v, setVoice] = useState<Voice>(defaultVoice),
    [exporting, setExporting] = useState(false),
    [originals, setOriginals] = useState(false),
    [voiceOpen, setVoiceOpen] = useState(false),
    [invite, setInvite] = useState(""),
    [inviteOpen, setInviteOpen] = useState(false),
    [copied, setCopied] = useState(false),
    [selecting, setSelecting] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [rangeFrom, setRangeFrom] = useState(""),
    [rangeTo, setRangeTo] = useState("");
  const full = useRef(false),
    retryId = useRef<string | null>(null),
    end = useRef<HTMLDivElement>(null);
  const load = useCallback(
    async () =>
      setData(
        initialData || (await playApi("chat", { id, all: full.current })),
      ),
    [id, initialData],
  );
  useEffect(() => {
    if (initialData) return;
    let alive = true;
    const refresh = () => {
      if (!document.hidden)
        playApi("chat", { id, all: full.current })
          .then((r) => {
            if (alive) setData(r);
          })
          .catch((e) => {
            if (alive) setError(e.message);
          });
    };
    refresh();
    playApi("viewer")
      .then((r) => {
        if (alive) {
          setUser(r.user);
        }
      })
      .catch(() => {});
    const channel = supabase()
      .channel(`chat:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `chat_id=eq.${id}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_players",
          filter: `chat_id=eq.${id}`,
        },
        refresh,
      )
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
  const chosen = selecting
    ? selectedMessages(data?.messages || [], selected)
    : data?.messages || [];
  const title = data?.chat.title || "Chat",
    content =
      chosen
        .map(
          (m) =>
            `**${m.character?.name || m.name}:** ${m.content || m.original}${originals && m.content && m.content !== m.original ? `\n\n> Original: ${m.original}` : ""}`,
        )
        .join("\n\n") || "";
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
        : [
            {
              id,
              author: "Players",
              content: "*No messages yet.*",
              timestamp: "",
              source: "LoreKeeper",
              sourceFormat: "markdown",
            },
          ],
    },
  ])[0];
  async function send() {
    const messageId = retryId.current || crypto.randomUUID();
    retryId.current = messageId;
    try {
      await playApi("sendMessage", {
        id,
        message,
        messageId,
        transform: mode === "voice",
        voice: v,
      });
      setMessage("");
      retryId.current = null;
    } catch (e) {
      await load();
      const { data: saved } = await supabase()
        .from("chat_messages")
        .select("id")
        .eq("id", messageId)
        .maybeSingle();
      if (saved) {
        setMessage("");
        retryId.current = null;
      }
      throw e;
    }
    await load();
  }
  return (
    <main id="main" className="lk-chat-room">
      <header className="lk-chat-room-header">
        <Link
          className="lk-back"
          href="/chat"
          aria-label="Back to conversations"
        >
          <Icon name="chevron" />
        </Link>
        <div>
          <h1>{title}</h1>
          <small>
            {data
              ? data.players.map((p) => p.name).join(" · ")
              : "Opening conversation…"}
          </small>
        </div>
        {data?.chat.owner_id === user && data.chat.kind !== "direct" && (
          <button
            className="lk-icon-button"
            aria-label="Invite friends"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await playApi("invite", { id, kind: "chat" });
                setInvite(`${location.origin}/join/${r.token}`);
                setInviteOpen(true);
              })
            }
          >
            <Icon name="users" />
          </button>
        )}
        <button
          className="lk-button"
          disabled={busy || !data?.messages.length}
          onClick={() =>
            void run(async () => {
              full.current = true;
              await load();
              setSelecting((s) => !s);
            })
          }
        >
          {selecting ? "Done selecting" : "Select messages"}
        </button>
        <button
          className="lk-icon-button"
          aria-label="Save or export conversation"
          disabled={
            busy || !data?.messages.length || (selecting && !selected.length)
          }
          onClick={() =>
            void run(async () => {
              full.current = true;
              await load();
              setExporting(true);
            })
          }
        >
          <Icon name="export" />
        </button>
      </header>
      {error && (
        <p className="lk-alert" role="alert">
          {error}
        </p>
      )}
      {selecting && (
        <div className="lk-message-selection">
          <strong>{selected.length} messages selected</strong>
          <div>
            <label>
              From
              <select
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
              >
                <option value="">Choose message…</option>
                {data?.messages.map((m, i) => (
                  <option key={m.id} value={m.id}>
                    {i + 1}. {m.name}: {(m.content || m.original).slice(0, 45)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              To
              <select
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
              >
                <option value="">Choose message…</option>
                {data?.messages.map((m, i) => (
                  <option key={m.id} value={m.id}>
                    {i + 1}. {m.name}: {(m.content || m.original).slice(0, 45)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="lk-button"
              disabled={!rangeFrom || !rangeTo}
              onClick={() =>
                setSelected(
                  messageRange(data?.messages || [], rangeFrom, rangeTo),
                )
              }
            >
              Select range
            </button>
          </div>
          <button
            className="lk-text-button"
            onClick={() => setSelected(data?.messages.map((m) => m.id) || [])}
          >
            Select all
          </button>
          <button className="lk-text-button" onClick={() => setSelected([])}>
            Clear
          </button>
          <button
            className="lk-button is-primary"
            disabled={!selected.length}
            onClick={() => setExporting(true)}
          >
            Create entry from selection
          </button>
          <small>Uncheck any message to leave it out.</small>
        </div>
      )}
      <section
        className="lk-chat-messages"
        aria-label="Messages"
        aria-live="polite"
      >
        {data?.more && (
          <button
            className="lk-text-button"
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
        {data && !data.messages.length && (
          <div className="lk-empty">
            <Icon name="users" />
            <h2>The first word is yours.</h2>
            <p>Talk normally, or try a different writing voice.</p>
          </div>
        )}
        {data?.messages.map((m) => (
          <article
            key={m.id}
            className={`lk-chat-message ${m.user_id === user ? "is-mine" : ""}`}
          >
            {selecting && (
              <label className="lk-message-check">
                <input
                  type="checkbox"
                  checked={selected.includes(m.id)}
                  onChange={(e) =>
                    setSelected((ids) =>
                      e.target.checked
                        ? [...ids, m.id]
                        : ids.filter((id) => id !== m.id),
                    )
                  }
                />{" "}
                Include this message
              </label>
            )}
            <header>
              <span>
                {m.character?.avatar || "✦"}{" "}
                <strong>{m.character?.name || m.name}</strong>
                {m.character && <small> · {m.name}</small>}
              </span>
              <time dateTime={m.created_at}>
                {new Date(m.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </header>
            <EditionMarkdown text={m.content || m.original} style="dark" />
            {m.status === "pending" && (
              <small>Finding the right voice… Original saved.</small>
            )}
            {m.status === "failed" && (
              <small>
                Transformation failed. This is your original message.
              </small>
            )}
            {m.content && m.content !== m.original && (
              <details>
                <summary>View original message</summary>
                <p>{m.original}</p>
              </details>
            )}
          </article>
        ))}
        <div ref={end} />
      </section>
      {data && !selecting && (
        <form
          className="lk-chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void run(send);
          }}
        >
          <div className="lk-chat-compose-top">
            <div className="lk-segments" aria-label="Message voice">
              {[
                ["normal", "Myself"],
                ["voice", "A voice"],
              ].map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={mode === id}
                  disabled={busy}
                  onClick={() => setMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode !== "normal" && (
              <button
                type="button"
                className="lk-text-button"
                disabled={busy}
                onClick={() => setVoiceOpen(true)}
              >
                <Icon name="settings" />
                {v.language} · {v.style}
              </button>
            )}
          </div>
          <div className="lk-action-row">
            <textarea
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
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={
                mode === "normal"
                  ? "Say something worth preserving…"
                  : "Your words, in a different voice…"
              }
            />
            <button
              className="lk-action-send"
              disabled={busy || !message.trim()}
            >
              {busy ? "Sending…" : "Send"}
              <Icon name="arrow" />
            </button>
          </div>
          <div className="lk-action-hint">
            <span>
              {mode === "normal"
                ? "Sent exactly as you write it."
                : "Your original message stays available."}
            </span>
            <kbd>Ctrl + Enter</kbd>
          </div>
        </form>
      )}
      {voiceOpen && (
        <Modal
          open
          title="Voice for this conversation"
          onClose={() => setVoiceOpen(false)}
        >
          <div className="lk-form">
            <p className="lk-hint">
              Choose the language and writing voice for messages in this
              conversation.
            </p>
            <VoiceSettings value={v} onChange={setVoice} />
            <button
              className="lk-button is-primary"
              onClick={() => setVoiceOpen(false)}
            >
              Use this voice
            </button>
          </div>
        </Modal>
      )}
      {inviteOpen && (
        <Modal
          open
          title="Invite a friend"
          onClose={() => setInviteOpen(false)}
        >
          <div className="lk-form">
            <p className="lk-hint">
              Your friend can join after signing in. This link expires in seven
              days.
            </p>
            <label>
              Invitation link
              <input
                readOnly
                value={invite}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <button
              className="lk-button is-primary"
              onClick={() =>
                void run(async () => {
                  await navigator.clipboard.writeText(invite);
                  setCopied(true);
                })
              }
            >
              <Icon name={copied ? "check" : "copy"} />
              {copied ? "Copied" : "Copy invitation"}
            </button>
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
          messageIds={selecting ? selected : undefined}
          initialFormat={selecting ? "collection" : undefined}
        />
      )}
    </main>
  );
}
