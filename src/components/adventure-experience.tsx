"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  storyEntry,
  storyMarkdown,
  type Adventure,
  type Player,
  type Question,
} from "@/lib/play";
import { readerEditions } from "@/lib/reader-editions";
import { editionPalettes } from "@/lib/edition-design";
import { resolveReaderFont } from "@/lib/reader-fonts";
import { StoryDocument } from "./story-document";
import { ChatGPTHandoff } from "./chatgpt-handoff";
import { StoryInteractions } from "./story-interactions";
import { AdventureLobby, type LobbySettings } from "./adventure-lobby";
import { PlayExport } from "./play-export";
import { Modal } from "./vault-ui";
import { Icon } from "./icon";
export type ExperienceProps = {
  story: Adventure;
  players: Player[];
  user: string;
  busy: boolean;
  generating: boolean;
  online: boolean;
  error: string;
  typing?: string[];
  initialLobby?: boolean;
  onGenerate: (ending?: boolean) => Promise<void>;
  onAnswer: (answer: string) => Promise<void>;
  onStatus: (s: string) => Promise<void>;
  onInvite: () => Promise<string>;
  onArmChatGPT: () => Promise<void>;
  onConfigure: (settings: LobbySettings) => Promise<void>;
  onInviteUser: (id: string) => Promise<void>;
  onEnter?: () => void;
  onTyping?: (typing: boolean) => void;
};
const revealStore = (id: string) => `lorekeeper-revealed:${id}`;
function readRevealed(id: string) {
  try {
    return typeof window === "undefined"
      ? ""
      : localStorage.getItem(revealStore(id)) || "";
  } catch {
    return "";
  }
}
export function AdventureExperience(p: ExperienceProps) {
  const { story, players, user, busy, generating } = p;
  const [lobby, setLobby] = useState(p.initialLobby !== false),
    [view, setView] = useState<"scene" | "story">("story"),
    [scene, setScene] = useState<number | null>(null),
    [interactions, setInteractions] = useState(true),
    [menu, setMenu] = useState(false),
    [exporting, setExporting] = useState(false),
    [ending, setEnding] = useState(false),
    // The newest scene animates once per device, then always reads instantly.
    [revealed, setRevealed] = useState(() => readRevealed(story.id));
  const master = story.owner_id === user,
    inLobby =
      story.status === "lobby" ||
      story.status === "paused" ||
      (lobby && story.status !== "completed");
  const index =
      scene === null
        ? Math.max(0, story.segments.length - 1)
        : Math.min(scene, story.segments.length - 1),
    last = story.segments.length - 1,
    latest = story.segments[last],
    sceneKey = latest ? latest.created || String(last) : "",
    animate = !!latest && revealed !== sceneKey && !generating;
  const markRevealed = useCallback(() => {
    if (!sceneKey) return;
    setRevealed(sceneKey);
    try {
      localStorage.setItem(revealStore(story.id), sceneKey);
    } catch {}
  }, [sceneKey, story.id]);
  const changeView = (next: "scene" | "story") => {
    // Switching the view counts as having seen the scene; never replay it.
    markRevealed();
    setView(next);
  };
  const palette =
    editionPalettes[story.design.background] || editionPalettes[story.edition];
  const vars = {
    "--play-ink": palette?.ink,
    "--play-accent": palette?.accent,
    "--play-paper": palette?.surface,
    "--play-font": resolveReaderFont(story.edition, story.design.font).family,
  } as CSSProperties;
  const start = async (mode?: "api" | "chatgpt") => {
    p.onEnter?.();
    if ((mode || story.ai_mode) === "chatgpt") {
      if (master) await p.onArmChatGPT();
      setLobby(false);
      return;
    }
    if (story.segments.length) {
      if (story.status !== "active") await p.onStatus("active");
      setLobby(false);
      p.onEnter?.();
    } else {
      await p.onGenerate();
      setLobby(false);
      p.onEnter?.();
    }
  };
  const returnLobby = async () => {
    if (master && story.status === "active") await p.onStatus("paused");
    setMenu(false);
    setLobby(true);
  };
  if (inLobby)
    return (
      <main
        id="main"
        className={`lkx-lobby-page play-edition-${story.edition}`}
        style={vars}
      >
        <AdventureLobby
          story={story}
          players={players}
          user={user}
          busy={busy}
          generating={generating}
          error={p.error || story.last_error || ""}
          onSave={p.onConfigure}
          onStart={start}
          onInvite={p.onInvite}
          onInviteUser={p.onInviteUser}
        />
      </main>
    );
  return (
    <main
      id="main"
      className={`lk-experience play-immersive lkx-play play-edition-${story.edition}`}
      data-playing
      style={vars}
    >
      <div className="lkx-play-atmosphere" aria-hidden="true" />
      <header className="lkx-bar">
        <button
          className="lkx-bar-back"
          onClick={() => void returnLobby().catch(() => {})}
        >
          <Icon name="chevron" />
          <span>Lobby</span>
        </button>
        <div className="lkx-bar-title">
          <small>
            {story.status === "completed"
              ? "A story to keep"
              : `Scene ${last + 1} · A living story`}
          </small>
          <h1>{story.title || "An unexpected adventure"}</h1>
        </div>
        <div className="lkx-bar-tools">
          <div className="lkx-switch" role="group" aria-label="Reading view">
            <button
              aria-pressed={view === "story"}
              onClick={() => changeView("story")}
            >
              Full story
            </button>
            <button
              aria-pressed={view === "scene"}
              onClick={() => changeView("scene")}
            >
              This scene
            </button>
          </div>
          <button
            className="lkx-tool"
            aria-pressed={interactions}
            aria-label="Show past decisions in the text"
            title={interactions ? "Hide past decisions" : "Show past decisions"}
            onClick={() => setInteractions((v) => !v)}
          >
            <Icon name="scroll" />
          </button>
          <button
            className="lkx-tool"
            aria-label="Export story"
            title="Export story"
            onClick={() => setExporting(true)}
          >
            <Icon name="export" />
          </button>
          <button
            className="lkx-tool"
            aria-label="Story menu"
            title="Story menu"
            onClick={() => setMenu(true)}
          >
            <Icon name="more" />
          </button>
        </div>
      </header>
      <div className="lkx-play-body">
        {story.ai_mode === "chatgpt" && (
          <div className="lkx-play-notice">
            <ChatGPTHandoff
              story={story}
              players={players}
              compact={story.segments.length > 0}
              canSave={master}
            />
          </div>
        )}
        {(p.error || story.last_error) && (
          <p className="lkx-play-alert" role="alert">
            {p.error || story.last_error}
            <button
              disabled={busy || generating}
              onClick={() => void p.onGenerate()}
            >
              Retry scene
            </button>
          </p>
        )}
        {story.segments.length > 0 ? (
          <SceneDocument
            key={story.id}
            {...p}
            index={index}
            view={view}
            interactions={interactions}
            animate={animate}
            onRevealed={markRevealed}
          />
        ) : (
          <Narrating
            text={
              story.ai_mode === "chatgpt"
                ? "Waiting for the opening from your connected ChatGPT chat"
                : "The narrator is writing your world"
            }
          />
        )}
        {generating && story.segments.length > 0 && (
          <Narrating text="The next passage is taking shape" />
        )}
        {view === "scene" && story.segments.length > 1 && (
          <nav className="lkx-scene-nav" aria-label="Scenes">
            <button
              aria-label="Previous scene"
              disabled={index <= 0}
              onClick={() => setScene(index - 1)}
            >
              <Icon name="chevron" />
            </button>
            <span>
              Scene {index + 1} <small>of {last + 1}</small>
            </span>
            <button
              aria-label="Next scene"
              disabled={index >= last}
              onClick={() => setScene(index + 1)}
            >
              <Icon name="chevron" />
            </button>
          </nav>
        )}
      </div>
      {menu && (
        <Modal open title="Your adventure" onClose={() => setMenu(false)}>
          <div className="lk-form">
            <h3>{story.title}</h3>
            <p>{players.map((p) => p.name).join(" · ")}</p>
            <button
              className="lk-button"
              onClick={() => void returnLobby().catch(() => {})}
            >
              {master ? "Pause and return to lobby" : "Return to lobby"}
            </button>
            {master &&
              story.status === "active" &&
              story.ai_mode !== "chatgpt" && (
                <button
                  className="lk-text-button"
                  onClick={() => {
                    setMenu(false);
                    setEnding(true);
                  }}
                >
                  Write an ending
                </button>
              )}
            <Link className="lk-text-button" href="/interactive">
              Leave story — your place is saved
            </Link>
          </div>
        </Modal>
      )}
      {ending && (
        <Modal open title="One final chapter?" onClose={() => setEnding(false)}>
          <p>Your story remains available to read and export.</p>
          <button
            className="lk-button is-primary"
            onClick={() => {
              setEnding(false);
              void p.onGenerate(true);
            }}
          >
            Write the ending
          </button>
        </Modal>
      )}
      {exporting && (
        <PlayExport
          hiddenDecisions={[]}
          id={story.id}
          title={story.title}
          entry={storyEntry(story, players, interactions)}
          edition={story.edition}
          design={story.design}
          content={storyMarkdown(story, players, interactions)}
          interactions={interactions}
          onInteractions={setInteractions}
          onClose={() => setExporting(false)}
        />
      )}
    </main>
  );
}
function Narrating({ text }: { text: string }) {
  return (
    <div className="lkx-narrating" role="status">
      <span className="lkx-narrating-mark" aria-hidden="true">
        ✒
      </span>
      <span>
        {text}
        <span className="lkx-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </span>
    </div>
  );
}
const playerName = (players: Player[], id: string) => {
  const player = players.find((x) => x.user_id === id);
  return player?.identity_name || player?.name || "A companion";
};
function SceneDocument(
  p: ExperienceProps & {
    index: number;
    view: "scene" | "story";
    interactions: boolean;
    animate: boolean;
    onRevealed: () => void;
  },
) {
  const { story, index, players, animate, onRevealed } = p,
    last = story.segments.length - 1,
    latest = story.segments[last],
    showsLatest = p.view === "story" || index === last,
    // The quill is open while this scene still waits for anyone's decision.
    open =
      story.status === "active" &&
      !!latest?.questions.length &&
      latest.questions.some((q) => !q.answer),
    playing = animate && showsLatest;
  const body = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // Decisions become markers in the Markdown; every edition (including the
  // paginated gallery manuscripts, which clone their DOM) renders them in place.
  const segments = story.segments
    .map((s, i) => ({
      ...s,
      narrative:
        (i === last
          ? `[Scene](#lore-decision-${playing ? "scene" : "anchor"}-${i})\n\n`
          : "") +
        s.narrative +
        (i === last && open
          ? "\n\n[Quill](#lore-decision-quill)"
          : p.interactions
            ? s.questions
                .map((q, j) =>
                  q.answer ? `\n\n[Decision](#lore-decision-${i}-${j})` : "",
                )
                .join("")
            : ""),
      questions: [],
    }))
    .filter((_, i) => p.view === "story" || i === index);
  const signature = JSON.stringify([
    story.id,
    story.title,
    players.map((x) => x.name),
    segments.map((s) => s.narrative),
  ]);
  // Rebuild (and re-paginate) only when the visible text truly changes, so a
  // companion's answer or presence update never resets the reader's draft.
  const entry = useMemo(
    () => storyEntry({ ...story, segments }, players, false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );
  useEffect(() => {
    if (!playing || p.generating) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onRevealed();
      return;
    }
    const words = (latest?.narrative || "").trim().split(/\s+/).length;
    const timer = setTimeout(onRevealed, words * 28 + 500);
    return () => clearTimeout(timer);
  }, [playing, p.generating, latest?.narrative, onRevealed]);
  // Find the visible quill slot. Gallery editions lay out a hidden template and
  // clone it into pages, so the live slot is the one outside `.gallery-measure`.
  useLayoutEffect(() => {
    const root = body.current;
    if (!root) return;
    const find = () => {
      const next =
        Array.from(root.querySelectorAll<HTMLElement>(".lkx-quill-slot")).find(
          (el) => !el.closest(".gallery-measure"),
        ) || null;
      setSlot((prev) => (prev === next ? prev : next));
    };
    find();
    const observer = new MutationObserver(find);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const scrolled = useRef("");
  useEffect(() => {
    if (p.view !== "story" || last < 1) return;
    const target = `${story.id}:${last}`;
    if (scrolled.current === target) return;
    const timer = setTimeout(() => {
      const anchor = Array.from(
        body.current?.querySelectorAll<HTMLElement>(".lkx-scene-anchor") || [],
      ).find((el) => !el.closest(".gallery-measure"));
      if (!anchor) return;
      scrolled.current = target;
      anchor.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 350);
    return () => clearTimeout(timer);
  }, [p.view, last, story.id, entry]);
  const theme =
    readerEditions.find((e) => e.id === story.edition) || readerEditions[0];
  const render = useCallback(
    (key: string) => {
      if (key.startsWith("scene-") || key.startsWith("anchor-"))
        return <span className="lkx-scene-anchor" aria-hidden="true" />;
      if (key === "quill") return <div className="lkx-quill-slot" />;
      const [i, j] = key.split("-").map(Number),
        q = story.segments[i]?.questions[j];
      return q?.answer ? <InkDecision q={q} players={players} /> : null;
    },
    [story.segments, players],
  );
  return (
    <div
      className="lkx-reading lk-reveal-page"
      ref={body}
      data-view={p.view}
      data-reveal={playing ? "playing" : "complete"}
    >
      {playing && (
        <button className="lkx-skip" onClick={onRevealed}>
          Reveal the whole passage
        </button>
      )}
      <StoryInteractions.Provider value={render}>
        <StoryDocument
          entry={entry}
          style={story.edition}
          theme={theme}
          design={{
            ...story.design,
            pages: false,
            showCover: p.view === "story" && story.design.showCover,
          }}
          size={20}
          ongoing={story.status !== "completed"}
        />
      </StoryInteractions.Provider>
      {slot && open && showsLatest && !playing &&
        createPortal(<Quill {...p} questions={latest.questions} />, slot)}
    </div>
  );
}
function InkDecision({ q, players }: { q: Question; players: Player[] }) {
  return (
    <div className="lkx-ink">
      <p className="lkx-ink-question">
        <b>{playerName(players, q.player)}</b> {q.text}
      </p>
      <p className="lkx-ink-answer">{q.answer}</p>
    </div>
  );
}
function Quill(p: ExperienceProps & { questions: Question[] }) {
  const mine = p.questions.filter((q) => q.player === p.user && !q.answer);
  const others = p.questions.filter((q) => q.player !== p.user || q.answer);
  return (
    <div className="lkx-quill" data-mine={mine.length ? "yes" : "no"}>
      <span className="lkx-quill-ornament" aria-hidden="true">
        <i />✦<i />
      </span>
      {others.map((q) =>
        q.answer ? (
          <InkDecision key={q.player} q={q} players={p.players} />
        ) : (
          <p className="lkx-quill-waiting" key={q.player} role="status">
            <b>{playerName(p.players, q.player)}</b>
            {p.typing?.includes(q.player) ? " is writing" : " is deciding"}
            <span className="lkx-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </p>
        ),
      )}
      {mine.map((q) => (
        <QuillField key={q.player} {...p} question={q} />
      ))}
    </div>
  );
}
function QuillField(p: ExperienceProps & { question: Question }) {
  const key = `lorekeeper-draft:${p.story.id}:${p.story.segments.at(-1)?.created || "opening"}`;
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) queueMicrotask(() => setText(saved));
    } catch {}
  }, [key]);
  const name = playerName(p.players, p.question.player);
  return (
    <div
      className="lkx-quill-field"
      onClick={(e) => {
        if (e.target === e.currentTarget) field.current?.focus();
      }}
    >
      <label className="lkx-quill-question" htmlFor="adventure-action">
        <b>{name}</b>
        {p.question.text}
      </label>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          try {
            p.onTyping?.(false);
            await p.onAnswer(text);
            localStorage.removeItem(key);
            setText("");
          } catch {}
        }}
      >
        <textarea
          ref={field}
          id="adventure-action"
          rows={2}
          required
          maxLength={6000}
          value={text}
          disabled={p.busy || p.generating || !p.online}
          onChange={(e) => {
            setText(e.target.value);
            // Grow line by line, like ink filling the ruled page.
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
            try {
              localStorage.setItem(key, e.target.value);
            } catch {}
            p.onTyping?.(!!e.target.value);
          }}
          onBlur={() => p.onTyping?.(false)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={`And so ${name}…`}
        />
        <span className="lkx-quill-foot">
          <small>
            {!p.online
              ? "Offline — your draft is kept"
              : "Ctrl + Enter to inscribe"}
          </small>
          <button disabled={p.busy || p.generating || !p.online || !text.trim()}>
            {p.busy ? "Inscribing…" : "Inscribe"} <span aria-hidden="true">✒</span>
          </button>
        </span>
      </form>
    </div>
  );
}
