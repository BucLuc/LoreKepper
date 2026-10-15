"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { playApi } from "@/lib/play-client";
import { supabase } from "@/lib/supabase";
import { type Adventure, type Player, type Voice } from "@/lib/play";
import type { LobbySettings } from "./adventure-lobby";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { AdventureExperience } from "./adventure-experience";
type Data = { story: Adventure; players: Player[] };
export function PlaySession({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null),
    [user, setUser] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(true),
    [now, setNow] = useState(0),
    [entered, setEntered] = useState(false),
    [typing, setTyping] = useState<Record<string, number>>({});
  const realtime = useRef<RealtimeChannel | null>(null),
    lastTyping = useRef(0);
  const attempted = useRef("");
  const load = useCallback(async () => {
    const r = await playApi("adventure", { id });
    setData((prev) => (JSON.stringify(prev) === JSON.stringify(r) ? prev : r));
  }, [id]);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (!document.hidden)
        playApi("adventure", { id })
          .then((r) => {
            if (alive)
              setData((prev) =>
                JSON.stringify(prev) === JSON.stringify(r) ? prev : r,
              );
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
      .catch((e) => {
        if (alive) setError(e.message);
      });
    const ch = supabase()
      .channel(`adventure:${id}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (alive && typeof payload.user === "string")
          setTyping((prev) => ({
            ...prev,
            [payload.user]: payload.typing ? Date.now() + 5000 : 0,
          }));
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "adventures",
          filter: `id=eq.${id}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "adventure_players",
          filter: `adventure_id=eq.${id}`,
        },
        refresh,
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") refresh();
      });
    realtime.current = ch;
    const poll = setInterval(refresh, 5000),
      tick = setInterval(() => setNow(Date.now()), 1000);
    const connection = () => {
      setOnline(navigator.onLine);
      refresh();
    };
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
      void supabase().removeChannel(ch);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [id]);
  const story = data?.story,
    questions = story?.segments.at(-1)?.questions || [],
    ready = questions.length > 0 && questions.every((q) => q.answer),
    generating =
      !!story?.generating_until &&
      new Date(story.generating_until).getTime() > now;
  const generate = useCallback(
    async (ending = false) => {
      setBusy(true);
      setError("");
      try {
        await playApi("generate", { id, ending });
        await load();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not continue the story.",
        );
        await load().catch(() => {});
      } finally {
        setBusy(false);
      }
    },
    [id, load],
  );
  useEffect(() => {
    // Pausing stops Lorekeeper's own narrator; ChatGPT only writes when asked,
    // and a pause would block it, so ChatGPT stories stay active.
    if (
      !entered &&
      story?.status === "active" &&
      story.ai_mode !== "chatgpt" &&
      story.owner_id === user &&
      !busy &&
      !generating
    ) {
      playApi("status", { id, status: "paused" })
        .then(load)
        .catch((e) => setError(e.message));
    }
  }, [
    entered,
    story?.status,
    story?.ai_mode,
    story?.owner_id,
    user,
    busy,
    generating,
    id,
    load,
  ]);
  useEffect(() => {
    if (
      !story ||
      !entered ||
      story.ai_mode === "chatgpt" ||
      story.owner_id !== user ||
      story.status !== "active" ||
      !ready ||
      generating ||
      busy ||
      story.last_error
    )
      return;
    const phase = `${id}:${story.revision}`;
    if (attempted.current === phase) return;
    attempted.current = phase;
    void generate();
  }, [story, ready, generating, busy, id, generate, entered, user]);
  async function action(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const revision = story?.revision;
  const configure = useCallback(
    async (settings: LobbySettings) => {
      setBusy(true);
      setError("");
      try {
        await playApi("configureLobby", {
          id,
          revision,
          ...settings,
        });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save lobby");
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [id, revision, load],
  );
  if (!data)
    return (
      <main id="main" className="lk-page">
        <Link href="/interactive" className="lk-back">
          ← Adventure library
        </Link>
        <div className="lk-loading" role={error ? "alert" : "status"}>
          {error || "Opening the next page…"}
        </div>
      </main>
    );
  return (
    <AdventureExperience
      story={data.story}
      players={data.players}
      user={user}
      busy={busy}
      generating={generating}
      online={online}
      error={error}
      typing={Object.keys(typing).filter((id) => typing[id] > now)}
      onEnter={() => setEntered(true)}
      onTyping={(active) => {
        if (active && Date.now() - lastTyping.current < 1000) return;
        lastTyping.current = Date.now();
        void realtime.current?.send({
          type: "broadcast",
          event: "typing",
          payload: { user, typing: active },
        });
      }}
      onArmChatGPT={() =>
        action(async () => {
          await playApi("armChatGPT", { id });
        })
      }
      onConfigure={configure}
      onInviteUser={(person) =>
        action(async () => {
          await playApi("inviteUser", { id, person });
        })
      }
      onGenerate={generate}
      onAnswer={(answer) =>
        action(async () => {
          await playApi("answer", {
            id,
            revision: data.story.revision,
            answer,
          });
        })
      }
      onStatus={(status) =>
        action(async () => {
          await playApi("status", { id, status });
          if (status === "paused") setEntered(false);
        })
      }
      onInvite={async () => {
        const r = await playApi("invite", { id });
        return `${location.origin}/join/${r.token}`;
      }}
    />
  );
}
export type StoryCast = {
  character: string;
  inherit: boolean;
  characterVoice: Voice;
};
