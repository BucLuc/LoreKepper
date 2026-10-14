"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import { playApi } from "@/lib/play-client";
import { type Adventure, type Character } from "@/lib/play";
import { readerEditions } from "@/lib/reader-editions";
import { editionPalettes } from "@/lib/edition-design";
import { CharacterEditor, type PlayCollection } from "./character-editor";
import { Icon } from "./icon";
import { UserPicker, type PickedUser } from "./user-picker";
import { Modal } from "./vault-ui";
type Home = {
  user: string;
  characters: Character[];
  adventures: Adventure[];
  chats: { id: string; title: string; created_at: string; kind?: string }[];
  collections: PlayCollection[];
};
export function PlayHub({
  tab,
  initialHome,
}: {
  tab: "stories" | "characters" | "chat";
  initialHome?: Home;
}) {
  const router = useRouter();
  const [home, setHome] = useState<Home | null>(initialHome || null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [editor, setEditor] = useState<Character | "new" | null>(null),
    [importOpen, setImportOpen] = useState(false),
    [collection, setCollection] = useState(""),
    [newChat, setNewChat] = useState(false),
    [title, setTitle] = useState(""),
    [chatKind, setChatKind] = useState("direct"),
    [people, setPeople] = useState<PickedUser[]>([]),
    [doomed, setDoomed] = useState<Adventure | null>(null);
  const load = useCallback(async () => {
    setHome(await playApi("home"));
  }, []);
  useEffect(() => {
    if (initialHome) return;
    let alive = true;
    playApi("home")
      .then((r) => {
        if (alive) setHome(r);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [tab, initialHome]);
  const homeUser = home?.user;
  useEffect(() => {
    if (initialHome || !homeUser) return;
    const refresh = () => {
      if (!document.hidden) void load().catch((e) => setError(e.message));
    };
    const channel = supabase()
      .channel(`play-home:${homeUser}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "adventures",
          filter: `owner_id=eq.${homeUser}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "adventure_players",
          filter: `user_id=eq.${homeUser}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_players",
          filter: `user_id=eq.${homeUser}`,
        },
        refresh,
      )
      .subscribe();
    const timer = setInterval(refresh, 10000);
    return () => {
      clearInterval(timer);
      void supabase().removeChannel(channel);
    };
  }, [homeUser, initialHome, load]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const owned = home?.collections.filter((c) => c.owner_id === home.user) || [];
  const adventures =
    home?.adventures.filter(
      (s) =>
        (filter === "all" ||
          (filter === "active"
            ? s.status !== "completed"
            : s.status === "completed")) &&
        `${s.title || "Untitled story lobby"} ${s.world}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || [];
  const characters =
    home?.characters.filter(
      (c) =>
        (filter === "all" ||
          (filter === "personal"
            ? !c.collection_id
            : c.collection_id === filter)) &&
        `${c.name} ${c.kind} ${c.personality}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || [];
  return (
    <main id="main" className="lk-page">
      <header className="lk-page-heading">
        <div>
          <span className="lk-kicker">
            {tab === "stories"
              ? "THE NEXT CHAPTER IS YOURS"
              : tab === "characters"
                ? "FAMILIAR FACES. NEW POSSIBILITIES."
                : "GOOD COMPANY. QUESTIONABLE CONVERSATIONS."}
          </span>
          <h1>
            {tab === "stories"
              ? <>Your <em>adventures.</em></>
              : tab === "characters"
                ? "Your characters"
                : "Chat"}
          </h1>
          <p>
            {tab === "stories"
              ? "Return to a living story, or step into an entirely new one."
              : tab === "characters"
                ? "Create a personality once. Choose their voice anew in every story."
                : "Talk as yourself, try a different voice, or step into character."}
          </p>
        </div>
        {tab === "stories" ? (
          <Link
            prefetch={false}
            href="/interactive/new"
            className="lk-button is-primary"
          >
            <Icon name="plus" /> New adventure
          </Link>
        ) : tab === "characters" ? (
          <button
            className="lk-button is-primary"
            onClick={() => setEditor("new")}
            disabled={!home}
          >
            <Icon name="plus" /> New character
          </button>
        ) : tab === "chat" ? (
          <button
            className="lk-button is-primary"
            onClick={() => setNewChat(true)}
            disabled={!home}
          >
            <Icon name="plus" /> New conversation
          </button>
        ) : null}
      </header>
      {error && (
        <p className="lk-alert" role="alert">
          {error} {!home && <Link href="/login">Sign in →</Link>}
        </p>
      )}
      {notice && (
        <p className="lk-notice" role="status">
          <Icon name="check" />
          {notice}
        </p>
      )}
      {!home && !error && (
        <div className="lk-loading" role="status">
          Opening your library…
        </div>
      )}
      {home && tab === "stories" && (
        <>
          <section
            className={`lk-adventure-banner ${home.adventures.length ? "is-compact" : ""}`}
          >
            <div>
              <span className="lk-kicker">
                A SERIOUS WORLD. YOUR QUESTIONABLE DECISIONS.
              </span>
              <h2>
                Do something{" "}
                <br />
                <em>unexpected.</em>
              </h2>
              <p>
                The narrator builds the world. You decide what happens to your
                character — even when the plot had other plans.
              </p>
              <Link
                prefetch={false}
                href="/interactive/new"
                className="lk-text-button"
              >
                Start a new story <Icon name="arrow" />
              </Link>
            </div>
            <div className="lk-banner-art" aria-hidden="true">
              <div className="lk-orbit" />
              <Icon name="book" />
              <span>✦</span>
            </div>
            <blockquote>
              “Thou art late,” said the queen.
              <br />
              <span>Your next move is entirely up to you.</span>
            </blockquote>
          </section>
          <div className="lk-library-toolbar">
            <div className="lk-segments">
              {[
                ["all", "All stories"],
                ["active", "In progress"],
                ["completed", "Completed"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <Search
              value={search}
              onChange={setSearch}
              placeholder="Find an adventure…"
            />
          </div>
          {adventures.length ? (
            <div className="lkx-shelf">
              {adventures.map((s) => {
                const edition = readerEditions.find((e) => e.id === s.edition),
                  p = editionPalettes[s.edition],
                  status =
                    s.status === "lobby"
                      ? "Ready to begin"
                      : s.status === "active"
                        ? "In progress"
                        : s.status === "paused"
                          ? "Paused"
                          : "Completed";
                return (
                  <article
                    key={s.id}
                    className="lkx-book"
                    style={
                      {
                        "--card-paper": p?.surface,
                        "--card-ink": p?.ink,
                        "--card-accent": p?.accent,
                      } as CSSProperties
                    }
                  >
                    <Link
                      href={`/interactive/${s.id}`}
                      className="lkx-book-cover"
                      aria-label={`${s.title || "Untitled story lobby"} — ${status}`}
                    >
                      <span className={`lkx-book-status status-${s.status}`}>
                        {status}
                      </span>
                      <span className="lkx-book-mark" aria-hidden="true">
                        {edition?.mark || "✦"}
                      </span>
                      <span className="lkx-book-title">
                        {s.title || "Untitled story"}
                      </span>
                      <span className="lkx-book-rule" aria-hidden="true" />
                      <small>{edition?.name || "A living story"}</small>
                    </Link>
                    <div className="lkx-book-caption">
                      <p>
                        {s.world?.trim()
                          ? s.world.trim().slice(0, 110) +
                            (s.world.trim().length > 110 ? "…" : "")
                          : "A world still waiting to be named."}
                      </p>
                      <footer>
                        <span>
                          {s.voice?.language || "English"} ·{" "}
                          {s.mode === "multiplayer" ? "With friends" : "Solo"}
                        </span>
                        {s.owner_id === home.user && (
                          <button
                            className="lkx-book-delete"
                            aria-label={`Delete ${s.title || "this story"}`}
                            title="Delete story"
                            disabled={busy}
                            onClick={() => setDoomed(s)}
                          >
                            <Icon name="trash" />
                          </button>
                        )}
                        <Link
                          href={`/interactive/${s.id}`}
                          className="lkx-book-open"
                          tabIndex={-1}
                        >
                          {s.status === "lobby"
                            ? "Enter lobby"
                            : s.status === "completed"
                              ? "Read"
                              : "Continue"}
                          <Icon name="arrow" />
                        </Link>
                      </footer>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={
                home.adventures.length
                  ? "No matching stories"
                  : "Your first chapter is waiting"
              }
              text={
                home.adventures.length
                  ? "Try another search or filter."
                  : "Pick a world, step into a character, and see what happens."
              }
            />
          )}
        </>
      )}
      {home && tab === "characters" && (
        <>
          <div className="lk-library-toolbar">
            <Search
              value={search}
              onChange={setSearch}
              placeholder="Find a character…"
            />
            <div className="lk-toolbar-actions">
              <select
                aria-label="Filter character origin"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All characters</option>
                <option value="personal">My personal characters</option>
                {home.collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button className="lk-button" onClick={() => setImportOpen(true)}>
                <Icon name="export" /> Import
              </button>
            </div>
          </div>
          {characters.length ? (
            <div className="lk-character-grid">
              {characters.map((c) => (
                <article className="lk-character-card" key={c.id}>
                  <div className="lk-character-card-top">
                    <span className="lk-character-avatar">{c.avatar}</span>
                    <span className="lk-origin">
                      {c.collection_id
                        ? home.collections.find((x) => x.id === c.collection_id)
                            ?.name
                        : "Personal"}
                    </span>
                  </div>
                  <h2>{c.name}</h2>
                  <span className="lk-character-kind">{c.kind}</span>
                  <p>{c.personality}</p>
                  <details className="lk-character-history">
                    <summary>Story appearances</summary>
                    <CharacterHistory id={c.id} />
                  </details>
                  {(c.owner_id === home.user ||
                    owned.some((x) => x.id === c.collection_id)) && (
                    <footer>
                      <button
                        className="lk-text-button"
                        onClick={() => setEditor(c)}
                      >
                        <Icon name="edit" /> Edit character
                      </button>
                      <button
                        className="lk-icon-button"
                        aria-label={`Delete ${c.name}`}
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete ${c.name}? Saved story appearances remain.`,
                            )
                          )
                            void run(async () => {
                              await playApi("deleteCharacter", { id: c.id });
                              await load();
                              setNotice(
                                "Character deleted. Saved story snapshots are preserved.",
                              );
                            });
                        }}
                      >
                        <Icon name="trash" />
                      </button>
                    </footer>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Someone worth remembering"
              text="Add a hero, a mischievous cat, or a person with a spectacularly bad plan."
            />
          )}
        </>
      )}
      {home && tab === "chat" && (
        <>
          <Search
            value={search}
            onChange={setSearch}
            placeholder="Find a conversation…"
          />
          <section className="lk-conversation-list">
            {home.chats
              .filter((c) =>
                c.title.toLowerCase().includes(search.toLowerCase()),
              )
              .map((c) => (
                <Link href={`/chat/${c.id}`} key={c.id}>
                  <span className="lk-conversation-icon">
                    <Icon name="users" />
                  </span>
                  <div>
                    <h2>{c.title}</h2>
                    <p>
                      {c.kind === "direct" ? "Direct message" : "Group chat"} ·{" "}
                      {new Date(c.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <Icon name="arrow" />
                </Link>
              ))}
            {!home.chats.length && (
              <EmptyState
                title="Pull up a chair"
                text="Message a user directly or start a group with your friends."
              />
            )}
          </section>
        </>
      )}
      {doomed && (
        <Modal
          open
          title="Delete this story?"
          onClose={() => {
            if (!busy) setDoomed(null);
          }}
        >
          <div className="lk-form lkx-confirm">
            <p>
              <strong>{doomed.title || "Untitled story"}</strong> and every
              scene, decision and invitation in it will be removed for all
              players. This cannot be undone.
            </p>
            {error && (
              <p className="lk-alert" role="alert">
                {error}
              </p>
            )}
            <div className="lkx-confirm-actions">
              <button
                className="lk-button"
                disabled={busy}
                onClick={() => setDoomed(null)}
              >
                Keep it
              </button>
              <button
                className="lk-button lkx-danger"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await playApi("deleteAdventure", { id: doomed.id });
                    setDoomed(null);
                    await load();
                    setNotice("Story deleted.");
                  })
                }
              >
                <Icon name="trash" />
                {busy ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {editor && (
        <CharacterEditor
          value={editor === "new" ? undefined : editor}
          collections={owned}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            await load();
            setNotice("Character saved. Choose their voice in each adventure.");
          }}
        />
      )}
      {newChat && (
        <Modal
          open
          title="Start a conversation"
          onClose={() => {
            if (!busy) setNewChat(false);
          }}
        >
          <form
            className="lk-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await playApi("createChat", {
                  title,
                  kind: chatKind,
                  people: people.map((p) => p.id),
                });
                router.push(`/chat/${r.id}`);
              });
            }}
          >
            <p className="lk-hint">
              Choose a user to message directly, or gather several people in a
              group.
            </p>
            <div className="lk-segments">
              <button
                type="button"
                aria-pressed={chatKind === "direct"}
                onClick={() => {
                  setChatKind("direct");
                  setPeople((p) => p.slice(0, 1));
                }}
              >
                Direct message
              </button>
              <button
                type="button"
                aria-pressed={chatKind === "group"}
                onClick={() => setChatKind("group")}
              >
                Group chat
              </button>
            </div>
            <UserPicker
              selected={people}
              onChange={setPeople}
              multiple={chatKind === "group"}
            />
            <label>
              Conversation name
              <input
                autoFocus
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tales around the fire"
              />
            </label>
            <button
              className="lk-button is-primary"
              disabled={busy || !people.length}
            >
              {busy ? "Creating…" : "Create conversation"} <Icon name="arrow" />
            </button>
          </form>
        </Modal>
      )}
      {importOpen && (
        <Modal
          open
          title="Import characters"
          onClose={() => {
            if (!busy) setImportOpen(false);
          }}
        >
          <div className="lk-form">
            <p className="lk-hint">
              Choose a JSON array with name, kind, personality and avatar.
              Choose language and voice in each adventure.
            </p>
            <label>
              Save to
              <select
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
              >
                <option value="">My personal characters</option>
                {owned.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="lk-upload">
              Choose a JSON file
              <input
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    void run(async () => {
                      if (f.size > 180000)
                        throw new Error(
                          "Choose a JSON file smaller than 180 KB.",
                        );
                      await playApi("importCharacters", {
                        characters: JSON.parse(await f.text()),
                        collection: collection || null,
                      });
                      await load();
                      setImportOpen(false);
                      setNotice("Characters imported.");
                    });
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </Modal>
      )}
    </main>
  );
}
function Search({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
}) {
  return (
    <label className="lk-search">
      <Icon name="search" />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="lk-empty">
      <Icon name="book" />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
function CharacterHistory({ id }: { id: string }) {
  const [stories, setStories] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    let alive = true;
    import("@/lib/supabase").then(async ({ supabase }) => {
      const { data } = await supabase()
        .from("adventure_players")
        .select("adventure_id")
        .contains("character", { id });
      if (!data?.length) return;
      const r = await supabase()
        .from("adventures")
        .select("id,title")
        .in(
          "id",
          (data as { adventure_id: string }[]).map((p) => p.adventure_id),
        );
      if (alive) setStories(r.data || []);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return (
    <ul>
      {stories.length ? (
        stories.map((s) => (
          <li key={s.id}>
            <Link href={`/interactive/${s.id}`}>
              {s.title || "Untitled story lobby"}
            </Link>
          </li>
        ))
      ) : (
        <li>No accessible story appearances yet.</li>
      )}
    </ul>
  );
}
