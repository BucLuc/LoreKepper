"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { useReaderPreferences } from "@/lib/reader-preferences";
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
import { AdventureLobby } from "./adventure-lobby";
import { StorySetup } from "./story-setup";
import type { PlayerCast, StorySettings } from "./story-form";
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
  onConfigure: (settings: StorySettings) => Promise<void>;
  onPlayer: (player: string, cast: PlayerCast) => Promise<void>;
  onInviteUser: (id: string) => Promise<void>;
  onEnter?: () => void;
  onTyping?: (typing: boolean) => void;
};
const revealStore = (id: string) => `lorekeeper-revealed:${id}`;
function readRevealed(id: string) {
  try {
    return localStorage.getItem(revealStore(id)) || "";
  } catch {
    return "";
  }
}
const noSubscription = () => () => {};
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
    // Read storage after hydration (server snapshot: null = nothing to animate).
    storedReveal = useSyncExternalStore(
      noSubscription,
      () => readRevealed(story.id),
      () => null,
    ),
    [revealedNow, setRevealed] = useState<string | null>(null),
    revealed = revealedNow ?? storedReveal;
  const master = story.owner_id === user,
    // Finished stories open in the lobby too, so their display stays editable.
    inLobby = story.status === "lobby" || story.status === "paused" || lobby;
  const hiddenKey = `lorekeeper-hidden:${story.id}`;
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(hiddenKey) || "[]");
      if (Array.isArray(saved)) queueMicrotask(() => setHidden(saved));
    } catch {}
  }, [hiddenKey]);
  const toggleHidden = useCallback(
    (key: string) =>
      setHidden((all) => {
        const next = all.includes(key)
          ? all.filter((k) => k !== key)
          : [...all, key];
        try {
          localStorage.setItem(hiddenKey, JSON.stringify(next));
        } catch {}
        return next;
      }),
    [hiddenKey],
  );
  // ChatGPT's half-written chapter shows as an extra scene; each new section
  // reveals on its own while the next one is being written.
  const draft = story.draft?.parts.length ? story.draft.parts : null,
    scenes = story.segments.length + (draft ? 1 : 0);
  // Text already revealed as a draft must not replay once the chapter is final.
  const [draftText, setDraftText] = useState("");
  if (draft && draft.join("\n\n") !== draftText) setDraftText(draft.join("\n\n"));
  const index =
      scene === null
        ? Math.max(0, scenes - 1)
        : Math.min(scene, scenes - 1),
    last = story.segments.length - 1,
    latest = story.segments[last],
    sceneKey = draft
      ? `draft:${story.segments.length}:${draft.length}`
      : latest
        ? latest.created || String(last)
        : "",
    animate =
      !!sceneKey &&
      revealed !== null &&
      revealed !== sceneKey &&
      !generating &&
      (!!draft || latest.narrative !== draftText);
  // When ChatGPT starts writing while you wait in the lobby, open the story.
  const progress = `${story.segments.length}:${draft?.length || 0}`;
  const [seenProgress, setSeenProgress] = useState(progress);
  if (progress !== seenProgress) {
    setSeenProgress(progress);
    if (story.ai_mode === "chatgpt" && story.status === "active")
      setLobby(false);
  }
  const onEnter = p.onEnter;
  useEffect(() => {
    if (!lobby) onEnter?.();
  }, [lobby, onEnter]);
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
    if (story.status === "completed") {
      setLobby(false);
      return;
    }
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
    if (master && story.status === "active" && story.ai_mode !== "chatgpt")
      await p.onStatus("paused");
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
        {story.setup &&
        !story.setup.done &&
        story.status === "lobby" &&
        !story.segments.length &&
        !draft ? (
          <StorySetup
            story={story}
            players={players}
            user={user}
            busy={busy}
            generating={generating}
            error={p.error || story.last_error || ""}
            onSave={p.onConfigure}
            onPlayer={p.onPlayer}
            onInvite={p.onInvite}
            onInviteUser={p.onInviteUser}
          />
        ) : (
          <AdventureLobby
            story={story}
            players={players}
            user={user}
            busy={busy}
            generating={generating}
            error={p.error || story.last_error || ""}
            onSave={p.onConfigure}
            onPlayer={p.onPlayer}
            onStart={start}
            onInvite={p.onInvite}
            onInviteUser={p.onInviteUser}
          />
        )}
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
              : `Scene ${scenes} · A living story`}
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
            aria-label="Show questions and answers in the text"
            title={
              interactions
                ? "Hide questions & answers"
                : "Show questions & answers"
            }
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
        {scenes > 0 ? (
          <SceneDocument
            key={story.id}
            {...p}
            index={index}
            view={view}
            interactions={interactions}
            hidden={hidden}
            onToggleHidden={toggleHidden}
            animate={animate}
            onRevealed={markRevealed}
          />
        ) : (
          <Narrating
            text={
              story.ai_mode === "chatgpt"
                ? "Waiting for the opening from ChatGPT"
                : "The narrator is writing your world"
            }
          />
        )}
        {view === "scene" && scenes > 1 && (
          <nav className="lkx-scene-nav" aria-label="Scenes">
            <button
              aria-label="Previous scene"
              disabled={index <= 0}
              onClick={() => setScene(index - 1)}
            >
              <Icon name="chevron" />
            </button>
            <span>
              Scene {index + 1} <small>of {scenes}</small>
            </span>
            <button
              aria-label="Next scene"
              disabled={index >= scenes - 1}
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
              {master && story.status === "active"
                ? "Pause and return to lobby"
                : "Return to lobby"}
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
          hiddenDecisions={hidden}
          id={story.id}
          title={story.title}
          entry={storyEntry(story, players, interactions, hidden)}
          edition={story.edition}
          design={story.design}
          content={storyMarkdown(story, players, interactions, hidden)}
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
// Hidden DOM that paginated editions measure and clone; never the visible copy.
const layoutTemplates = ".gallery-measure, .gallery-staging, .reader-page-source";
const playerName = (players: Player[], id: string) => {
  const player = players.find((x) => x.user_id === id);
  return player?.identity_name || player?.name || "A companion";
};
function SceneDocument(
  p: ExperienceProps & {
    index: number;
    view: "scene" | "story";
    interactions: boolean;
    hidden: string[];
    onToggleHidden: (key: string) => void;
    animate: boolean;
    onRevealed: () => void;
  },
) {
  const { story, index, players, animate, onRevealed, onToggleHidden } = p,
    draft = story.draft?.parts.length ? story.draft.parts : null,
    // ChatGPT's half-written chapter reads as one more chapter after the saved ones.
    chapters = draft
      ? [
          ...story.segments,
          { narrative: draft.join("\n\n"), questions: [], created: "" },
        ]
      : story.segments,
    last = chapters.length - 1,
    latest = chapters[last],
    showsLatest = p.view === "story" || index === last,
    // The current turn stays live in the text until the next chapter arrives:
    // open questions, answers as they come in, then "the story continues".
    live = !draft && story.status === "active" && !!latest?.questions.length,
    // While ChatGPT writes on, the answers it is answering stay in view.
    answered = draft ? story.segments.length - 1 : -1,
    playing = animate && showsLatest,
    // Only the newest text reveals word by word (for a draft: its newest section).
    newest = draft ? draft[draft.length - 1] : latest?.narrative || "",
    // A4 sheets have a fixed height, so the quill sits after them instead of inside.
    paged = !!story.design.pages;
  const { size, plain, showEmojis } = useReaderPreferences();
  const body = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  // Decisions become markers in the Markdown; every edition (including the
  // paginated gallery manuscripts, which clone their DOM) renders them in place.
  // Hidden ones carry "-h" so paginated editions re-lay out when it changes.
  const segments = chapters
    .map((s, i) => ({
      ...s,
      narrative:
        (i === last
          ? `[Scene](#lore-decision-${playing && !draft ? "scene" : "anchor"}-${i})\n\n`
          : "") +
        (i === last && draft
          ? [
              ...draft.slice(0, -1),
              ...(playing ? [`[Scene](#lore-decision-scene-${i})`] : []),
              newest,
            ].join("\n\n") + "\n\n[Quill](#lore-decision-quill)"
          : s.narrative) +
        (i === last && (live || draft)
          ? live
            ? "\n\n[Quill](#lore-decision-quill)"
            : ""
          : p.interactions || i === answered
            ? s.questions
                .map((q, j) =>
                  q.answer
                    ? `\n\n[Decision](#lore-decision-${i}-${j}${p.hidden.includes(`${i}-${j}`) ? "-h" : ""})`
                    : "",
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
    const words = newest.trim().split(/\s+/).length;
    const timer = setTimeout(onRevealed, words * 28 + 500);
    return () => clearTimeout(timer);
  }, [playing, p.generating, newest, onRevealed]);
  // Find the visible quill slot. Paginated editions lay out a hidden template and
  // clone it into pages, so the live slot is the one outside those templates.
  // Each turn draws a line to the page edge; its flag lives in an overlay
  // outside the page, because most editions clip anything past their border.
  useLayoutEffect(() => {
    const root = body.current;
    if (!root) return;
    const place = () => {
      const origin = root.getBoundingClientRect(),
        next: Flag[] = [];
      root.querySelectorAll<HTMLElement>(".lkx-tab").forEach((tab) => {
        const turn = tab.closest<HTMLElement>(".lkx-turn");
        const page = tab.closest<HTMLElement>(".sheet, .story-document");
        if (!turn || !page || tab.closest(layoutTemplates)) return;
        const box = page.getBoundingClientRect(),
          scale = box.width / (page.offsetWidth || box.width) || 1,
          line = tab.getBoundingClientRect();
        turn.style.setProperty(
          "--reach",
          `${Math.max(0, (box.right - turn.getBoundingClientRect().right) / scale - 4)}px`,
        );
        next.push({
          top: Math.round(line.top - origin.top + line.height / 2 - 13),
          left: Math.round(box.right - origin.left - 10),
          mark: tab.dataset.mark || "",
          label: tab.dataset.label || "",
          toggle: tab.dataset.toggle,
          state: turn.dataset.state || "",
        });
      });
      setFlags((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    };
    const find = () => {
      const next =
        Array.from(root.querySelectorAll<HTMLElement>(".lkx-quill-slot")).find(
          (el) => !el.closest(layoutTemplates),
        ) || null;
      setSlot((prev) => (prev === next ? prev : next));
      place();
    };
    find();
    const observer = new MutationObserver(find);
    observer.observe(root, { childList: true, subtree: true });
    const resize = new ResizeObserver(place);
    resize.observe(root);
    return () => {
      observer.disconnect();
      resize.disconnect();
    };
  }, []);
  const scrolled = useRef("");
  useEffect(() => {
    if (p.view !== "story" || last < 1) return;
    const target = `${story.id}:${last}`;
    if (scrolled.current === target) return;
    const timer = setTimeout(() => {
      const anchor = Array.from(
        body.current?.querySelectorAll<HTMLElement>(".lkx-scene-anchor") || [],
      ).find((el) => !el.closest(layoutTemplates));
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
      const [i, j, flag] = key.split("-"),
        q = story.segments[Number(i)]?.questions[Number(j)];
      return q?.answer ? (
        <Decision
          q={q}
          players={players}
          id={`${i}-${j}`}
          hidden={flag === "h"}
        />
      ) : null;
    },
    [story.segments, players],
  );
  return (
    <div
      className="lkx-reading lk-reveal-page"
      ref={body}
      data-view={p.view}
      data-reveal={playing ? "playing" : "complete"}
      // Delegated, because paginated editions show cloned DOM without React handlers.
      onClick={(e) => {
        const toggle = (e.target as HTMLElement).closest<HTMLElement>(
          "[data-toggle-decision]",
        );
        if (toggle) onToggleHidden(toggle.dataset.toggleDecision!);
      }}
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
            showCover: p.view === "story" && story.design.showCover,
          }}
          size={size}
          plain={plain}
          showEmojis={showEmojis}
          ongoing={story.status !== "completed"}
        />
      </StoryInteractions.Provider>
      <div className="lkx-flags">
        {flags.map((f, i) =>
          f.toggle ? (
            <button
              key={i}
              type="button"
              className="lkx-flag"
              data-state={f.state}
              style={{ top: f.top, left: f.left }}
              data-toggle-decision={f.toggle}
              aria-label={f.label}
              title={f.label}
            >
              {f.mark}
            </button>
          ) : (
            <span
              key={i}
              className="lkx-flag"
              data-state={f.state}
              style={{ top: f.top, left: f.left }}
              title={f.label}
            >
              {f.mark}
            </span>
          ),
        )}
      </div>
      {showsLatest &&
        ((live && !playing) || !!draft) &&
        (paged ? (
          <Quill {...p} questions={latest.questions} />
        ) : (
          slot &&
          createPortal(<Quill {...p} questions={latest.questions} />, slot)
        ))}
    </div>
  );
}
type Flag = {
  top: number;
  left: number;
  mark: string;
  label: string;
  toggle?: string;
  state: string;
};
// A line to the page edge. SceneDocument reads its data to place the flag that
// sticks out past the border, so every turn is easy to spot.
function Tab({
  mark,
  label,
  toggle,
}: {
  mark: string;
  label: string;
  toggle?: string;
}) {
  return (
    <span
      className="lkx-tab"
      aria-hidden="true"
      data-mark={mark}
      data-label={label}
      data-toggle={toggle}
    />
  );
}
function Decision({
  q,
  players,
  id,
  hidden,
}: {
  q: Question;
  players: Player[];
  id: string;
  hidden: boolean;
}) {
  return hidden ? (
    <div className="lkx-turn" data-state="hidden">
      <Tab mark="◇" label="Show this question again" toggle={id} />
      <p className="lkx-turn-hidden">Question</p>
    </div>
  ) : (
    <div className="lkx-turn" data-state="answered">
      <Tab mark="✦" label="Hide this question" toggle={id} />
      <p className="lkx-turn-q">
        <b>{playerName(players, q.player)}</b> {q.text}
      </p>
      <p className="lkx-turn-a">{q.answer}</p>
    </div>
  );
}
function Quill(p: ExperienceProps & { questions: Question[] }) {
  const answered = p.questions.every((q) => q.answer);
  // ChatGPT is writing the next chapter into the story right now.
  const writing = !!p.story.draft?.parts.length;
  const continuing =
    writing ||
    p.generating ||
    (answered &&
      (p.story.ai_mode === "chatgpt" || (!p.story.last_error && !p.error)));
  return (
    <div className="lkx-quill">
      {p.questions.map((q) =>
        q.answer ? (
          <div className="lkx-turn" data-state="answered" key={q.player}>
            <Tab mark="✓" label="Answered" />
            <p className="lkx-turn-q">
              <b>{playerName(p.players, q.player)}</b> {q.text}
            </p>
            <p className="lkx-turn-a">{q.answer}</p>
          </div>
        ) : q.player === p.user ? (
          <QuillField key={q.player} {...p} question={q} />
        ) : (
          <div className="lkx-turn" data-state="waiting" key={q.player}>
            <Tab mark="…" label="Waiting for an answer" />
            <p className="lkx-turn-q">
              <b>{playerName(p.players, q.player)}</b> {q.text}
            </p>
            <p className="lkx-turn-wait" role="status">
              {p.typing?.includes(q.player) ? (
                <>
                  {playerName(p.players, q.player)} is writing
                  <Dots />
                </>
              ) : (
                `${playerName(p.players, q.player)} has not answered yet`
              )}
            </p>
          </div>
        ),
      )}
      {continuing && (
        <p className="lkx-continuing" role="status">
          {p.story.ai_mode === "chatgpt" && !p.generating && !writing
            ? "The story continues in ChatGPT — write “Continue” there"
            : "The story continues"}
          <Dots />
        </p>
      )}
    </div>
  );
}
function Dots() {
  return (
    <span className="lkx-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
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
      className="lkx-turn"
      data-state="mine"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button, textarea"))
          field.current?.focus();
      }}
    >
      <Tab mark="✎" label="Your turn" />
      <label className="lkx-turn-q" htmlFor="adventure-action">
        <b>{name}</b> {p.question.text}
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
          className="lkx-turn-input"
          rows={1}
          required
          maxLength={6000}
          value={text}
          disabled={p.busy || p.generating || !p.online}
          onChange={(e) => {
            setText(e.target.value);
            // Grow line by line, like ink filling the page.
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
          placeholder={`Write what ${name} does…`}
        />
        <span className="lkx-turn-foot" data-ready={text.trim() ? "yes" : "no"}>
          <small>
            {!p.online
              ? "Offline — your draft is kept"
              : "Ctrl + Enter to send"}
          </small>
          <button
            disabled={p.busy || p.generating || !p.online || !text.trim()}
          >
            {p.busy ? "Writing it in…" : "Write it into the story"}{" "}
            <span aria-hidden="true">✒</span>
          </button>
        </span>
      </form>
    </div>
  );
}
