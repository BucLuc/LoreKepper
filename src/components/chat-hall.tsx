"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { playApi } from "@/lib/play-client";
import { supabase } from "@/lib/supabase";
import { Feedback } from "./feedback";
import { Icon } from "./icon";
import { SkeletonCards } from "./vault-ui";
type HallChat = {
  id: string;
  kind: "direct" | "group";
  title: string;
  created_at: string;
  partner: { id: string; name: string } | null;
  last: { text: string; kind: string; from: string; at: string } | null;
  unread: number;
};
type Hall = { chats: HallChat[]; people: { id: string; name: string }[] };
export function when(at: string) {
  const d = new Date(at),
    days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 1 && d.getDate() === new Date().getDate())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}
export function Sigil({ name, size = "" }: { name: string; size?: string }) {
  return (
    <span className={`lkx-seal ${size}`} aria-hidden="true">
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}
// Every adventurer has one conversation with every other: yours first, newest on
// top, then everyone you haven't written to yet.
export function ChatHall({ initialHall, me = "" }: { initialHall?: Hall; me?: string }) {
  const router = useRouter();
  const [hall, setHall] = useState<Hall | null>(initialHall || null),
    [user, setUser] = useState(me),
    [search, setSearch] = useState(""),
    [opening, setOpening] = useState(""),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    if (initialHall) return;
    setHall(await playApi("chatHall"));
  }, [initialHall]);
  useEffect(() => {
    if (initialHall) return;
    let alive = true;
    const refresh = () => {
      if (!document.hidden) load().catch((e) => alive && setError(e.message));
    };
    refresh();
    playApi("viewer")
      .then((r) => alive && setUser(r.user))
      .catch(() => {});
    // Row-level security limits these events to your own conversations.
    const channel = supabase()
      .channel("chat-hall")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, refresh)
      .subscribe();
    const timer = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      void supabase().removeChannel(channel);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [initialHall, load]);
  const q = search.trim().toLowerCase();
  const chats = (hall?.chats || []).filter((c) =>
    (c.partner?.name || c.title).toLowerCase().includes(q),
  );
  const talked = new Set((hall?.chats || []).filter((c) => c.kind === "direct").map((c) => c.partner?.id));
  const strangers = (hall?.people || []).filter((p) => !talked.has(p.id) && p.name.toLowerCase().includes(q));
  const unread = (hall?.chats || []).reduce((n, c) => n + c.unread, 0);
  const open = async (person: string) => {
    setOpening(person);
    try {
      const r = await playApi("createChat", { kind: "direct", people: [person] });
      router.push(`/chat/${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The door would not open.");
      setOpening("");
    }
  };
  return (
    <main id="main" className="lkx-hall">
      <header className="lkx-hall-hero">
        <div className="lkx-hero-arch" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <span className="lkx-eyebrow">Good company · Questionable conversations</span>
        <h1>
          The Hall of <em>Whispers</em>
        </h1>
        <p className="lkx-hero-lede">
          One table for every pair of adventurers. Speak plainly, borrow a pirate&apos;s
          tongue, or let the quill write the reply for you.
        </p>
        <ul className="lkx-hero-facts">
          <li>{hall ? `${hall.chats.length} conversation${hall.chats.length === 1 ? "" : "s"}` : "…"}</li>
          {unread > 0 && <li>{unread} unread</li>}
          <li>{hall ? `${hall.people.length} adventurers` : "…"}</li>
        </ul>
        <label className="lk-search lkx-hall-search">
          <Icon name="search" />
          <input
            aria-label="Find an adventurer"
            placeholder="Find an adventurer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </header>
      {error && (
        <Feedback error onDismiss={() => setError("")}>
          {error} {!hall && <Link href="/login?next=%2Fchat">Sign in →</Link>}
        </Feedback>
      )}
      <section className="lkx-hall-section" aria-labelledby="lkx-hall-chats">
        <span className="lkx-eyebrow">Your tables</span>
        <h2 id="lkx-hall-chats">Conversations</h2>
        <div className="lkx-tables">
          {!hall && !error && <SkeletonCards count={3} className="is-row" label="Opening the hall" />}
          {chats.map((c) => {
            const name = c.kind === "direct" ? c.partner?.name || "A vanished adventurer" : c.title;
            return (
              <Link key={c.id} href={`/chat/${c.id}`} className="lkx-table" data-unread={c.unread > 0 || undefined}>
                <Sigil name={name} />
                <span className="lkx-table-copy">
                  <strong>
                    {name}
                    {c.kind === "group" && <small> · old group chat</small>}
                  </strong>
                  <span>
                    {c.last ? (
                      <>
                        {c.last.kind === "invite" && <b className="lkx-table-invite">⚔ Invitation · </b>}
                        {c.last.from === user && c.last.kind !== "invite" && <b>You: </b>}
                        {c.last.text.replace(/[#*_>`]/g, "").slice(0, 110)}
                      </>
                    ) : (
                      <em>No words exchanged yet.</em>
                    )}
                  </span>
                </span>
                <span className="lkx-table-meta">
                  <time dateTime={c.last?.at || c.created_at}>{when(c.last?.at || c.created_at)}</time>
                  {c.unread > 0 && <span className="lkx-unread">{c.unread}</span>}
                </span>
              </Link>
            );
          })}
          {hall && !chats.length && (
            <p className="lkx-hall-empty">
              {q ? "No conversation matches." : "No conversations yet. Pick an adventurer below and say hello."}
            </p>
          )}
        </div>
      </section>
      <section className="lkx-hall-section" aria-labelledby="lkx-hall-people">
        <span className="lkx-eyebrow">Not yet spoken to</span>
        <h2 id="lkx-hall-people">Fellow adventurers</h2>
        <div className="lkx-strangers">
          {!hall && !error && <SkeletonCards count={6} label="Gathering the adventurers" />}
          {strangers.map((p) => (
            <button
              key={p.id}
              type="button"
              className="lkx-stranger"
              disabled={!!opening}
              onClick={() => void open(p.id)}
            >
              <Sigil name={p.name} size="is-large" />
              <strong>{p.name}</strong>
              <small>{opening === p.id ? "Pulling up a chair…" : "Start a conversation →"}</small>
            </button>
          ))}
          {hall && !strangers.length && (
            <p className="lkx-hall-empty">
              {q ? "Nobody by that name." : "You have spoken with everyone in the realm."}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
