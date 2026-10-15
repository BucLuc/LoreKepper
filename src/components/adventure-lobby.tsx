"use client";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useRef,
  type CSSProperties,
} from "react";
import type { Adventure, Player, PlayerVoice, Voice } from "@/lib/play";
import { storyEntry, styles } from "@/lib/play";
import { readerEditions } from "@/lib/reader-editions";
import { EditionPicker } from "./edition-picker";
import { languages } from "./voice-settings";
import { NarratorPicker } from "./narrator-picker";
import { StoryDocument } from "./story-document";
import { UserPicker, type PickedUser } from "./user-picker";
import { ChatGPTHandoff } from "./chatgpt-handoff";
export type LobbySettings = {
  title: string;
  world: string;
  voice: Voice;
  edition: string;
  design: Adventure["design"];
  aiMode: "api" | "chatgpt";
  identities: {
    user: string;
    name: string;
    description: string;
    voice: PlayerVoice | null;
  }[];
};
const LEDGER_KEY = "lorekeeper-lobby-ledger",
  LEDGER_DEFAULT = 440,
  LEDGER_MIN = 320,
  LEDGER_PREVIEW_MIN = 420;
function settings(story: Adventure, players: Player[]): LobbySettings {
  return {
    title: story.title,
    world: story.world,
    voice: story.voice,
    edition: story.edition,
    design: story.design,
    aiMode: story.ai_mode || "api",
    identities: players.map((p) => ({
      user: p.user_id,
      name: p.identity_name || "",
      description: p.description || "",
      voice: p.voice || null,
    })),
  };
}
export function AdventureLobby({
  story,
  players,
  user,
  busy,
  generating,
  error,
  onSave,
  onStart,
  onInvite,
  onInviteUser,
}: {
  story: Adventure;
  players: Player[];
  user: string;
  busy: boolean;
  generating: boolean;
  error: string;
  onSave: (settings: LobbySettings) => Promise<void>;
  onStart: (mode?: "api" | "chatgpt") => Promise<void>;
  onInvite: () => Promise<string>;
  onInviteUser: (id: string) => Promise<void>;
}) {
  const master = story.owner_id === user;
  const [panel, setPanel] = useState("world");
  const [form, setForm] = useState(() => settings(story, players)),
    [dirty, setDirty] = useState(false),
    [link, setLink] = useState(""),
    [people, setPeople] = useState<PickedUser[]>([]),
    [saveError, setSaveError] = useState("");
  // Counts edits, so a finished save knows whether newer edits are still pending.
  // (Comparing form objects fails: React may run state updaters twice.)
  const edits = useRef(0);
  useEffect(() => {
    if (dirty || busy) return;
    const next = settings(story, players),
      seen = edits.current;
    queueMicrotask(() => {
      // An edit made in the meantime wins over the server copy.
      if (edits.current === seen) setForm(next);
    });
  }, [story, players, dirty, busy]);
  const update = (change: Partial<LobbySettings>) => {
    edits.current++;
    setForm((f) => ({ ...f, ...change }));
    setDirty(true);
    setSaveError("");
  };
  useEffect(() => {
    // The database refuses lobby edits while Lorekeeper's narrator story is
    // active or ChatGPT is mid-chapter; wait until that is over.
    if (
      !dirty ||
      busy ||
      generating ||
      !master ||
      saveError ||
      (story.status === "active" && story.ai_mode !== "chatgpt") ||
      !!story.draft?.parts.length
    )
      return;
    const timer = setTimeout(() => {
      const saving = edits.current;
      void onSave(form)
        .then(() => {
          if (edits.current === saving) {
            setDirty(false);
            setSaveError("");
          }
        })
        .catch((e) => setSaveError(e.message));
    }, 750);
    return () => clearTimeout(timer);
  }, [
    form,
    dirty,
    busy,
    generating,
    master,
    onSave,
    saveError,
    story.status,
    story.ai_mode,
    story.draft,
  ]);
  // The settings column can be dragged wider; the preview takes the rest.
  const grid = useRef<HTMLDivElement>(null);
  const [ledger, setLedger] = useState(LEDGER_DEFAULT);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(LEDGER_KEY));
      if (saved) queueMicrotask(() => setLedger(saved));
    } catch {}
  }, []);
  const resizeLedger = (width: number) => {
    const room = (grid.current?.clientWidth ?? 1200) - LEDGER_PREVIEW_MIN;
    const next = Math.round(
      Math.min(Math.max(width, LEDGER_MIN), Math.max(LEDGER_MIN, room)),
    );
    setLedger(next);
    try {
      localStorage.setItem(LEDGER_KEY, String(next));
    } catch {}
  };
  const visible = master ? form : settings(story, players),
    theme =
      readerEditions.find((e) => e.id === visible.edition) || readerEditions[0];
  const preview = useMemo(
    () => {
      const entry = storyEntry({ ...story, title: visible.title || "Your next adventure" }, players, false);
      if (!story.segments.length) {
        const sample = "## Chapter I: An Unwritten Beginning\n\n*Somewhere beyond the familiar*\n\nThe doors open slowly. Candlelight spills across the stone floor, and somewhere in the distance a bell begins to toll. A stranger looks up from the hearth.\n\n‘We were wondering when thou wouldst arrive.’\n\nYour own world will appear here when the adventure begins.";
        entry.messages[0].content = sample;
        entry.messages[0].presentation = sample;
      }
      return entry;
    },
    [story, players, visible.title],
  );
  const titleWords = (visible.title || "Your next adventure").trim().split(/\s+/),
    titleHead = titleWords.slice(0, -1).join(" "),
    titleTail = titleWords.at(-1),
    scenes = story.segments.length,
    done = story.status === "completed",
    begin = async () => {
      try {
        await onSave(form);
        setDirty(false);
        await onStart(form.aiMode);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Could not start");
      }
    };
  return (
    <section className="lkx-lobby">
      <header className="lkx-lobby-hero">
        <div className="lkx-hero-arch" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <Link href="/interactive" className="lkx-lobby-back">
          ← Adventure library
        </Link>
        <div className="lkx-hero-copy">
          <span className="lkx-eyebrow">
            {scenes ? "Return to your world" : "The story lobby"}
          </span>
          <h1>
            {titleHead && <>{titleHead} </>}
            <em>{titleTail}</em>
          </h1>
          <p className="lkx-hero-lede">
            {visible.world.trim()
              ? visible.world.trim().slice(0, 220) +
                (visible.world.trim().length > 220 ? "…" : "")
              : master
                ? "Set the scene, gather your party, and turn the first page when you are ready."
                : "The creator is preparing your adventure. Settings appear here as they change."}
          </p>
          <ul className="lkx-hero-facts" aria-label="Story details">
            {done && <li>Complete</li>}
            <li>
              {scenes
                ? `${scenes} scene${scenes === 1 ? "" : "s"} written`
                : "An unwritten beginning"}
            </li>
            <li>{theme.name}</li>
            <li>{visible.voice.language}</li>
            {visible.voice.persona && (
              <li>
                {visible.voice.narrator === "custom"
                  ? "Own voice"
                  : visible.voice.narratorName}
              </li>
            )}
            <li>{visible.aiMode === "chatgpt" ? "Written by ChatGPT" : "Lorekeeper AI"}</li>
          </ul>
          <div className="lkx-hero-actions">
            {done ? (
              <button
                className="gold-button lkx-begin"
                disabled={busy}
                onClick={() => void (master ? begin() : onStart())}
              >
                Read the story <span aria-hidden="true">→</span>
              </button>
            ) : master ? (
              <button
                className="gold-button lkx-begin"
                disabled={busy || generating}
                onClick={() => void begin()}
              >
                {generating
                  ? "The narrator is writing…"
                  : scenes
                    ? "Continue the tale"
                    : visible.aiMode === "chatgpt"
                      ? "Begin with ChatGPT"
                      : "Turn the first page"}
                <span aria-hidden="true">→</span>
              </button>
            ) : story.status === "active" ? (
              <button
                className="gold-button lkx-begin"
                onClick={() => void onStart()}
              >
                Join the story <span aria-hidden="true">→</span>
              </button>
            ) : (
              <span className="lkx-hero-wait">
                Waiting for the creator to begin
              </span>
            )}
            <span className="lkx-save-state" role="status">
              {generating
                ? "Writing the opening…"
                : dirty
                  ? "Saving changes…"
                  : master
                    ? "All changes saved"
                    : ""}
            </span>
          </div>
        </div>
        <aside className="lkx-party" aria-label="Your party">
          <span className="lkx-eyebrow">The party</span>
          <ul>
            {players.map((player) => (
              <li key={player.user_id}>
                <span className="lkx-seal" aria-hidden="true">
                  {(player.identity_name || player.name).slice(0, 1)}
                </span>
                <span>
                  <strong>{player.identity_name || player.name}</strong>
                  <small>
                    {player.identity_name ? `${player.name} · ` : ""}
                    {player.user_id === story.owner_id ? "Creator" : "Player"}
                  </small>
                </span>
              </li>
            ))}
          </ul>
          {master && (
            <button
              type="button"
              className="lkx-party-invite"
              onClick={() => setPanel("players")}
            >
              + Invite a companion
            </button>
          )}
        </aside>
      </header>
      {(error || saveError) && (
        <p className="lkx-lobby-alert" role="alert">
          {error || saveError}
        </p>
      )}
      <div
        className="lkx-lobby-grid"
        ref={grid}
        style={{ "--ledger": `${ledger}px` } as CSSProperties}
      >
        <div className="lkx-ledger lk-lobby-settings">
          <nav className="lkx-ledger-tabs" aria-label="Lobby settings">
            {[
              ["world", "World"],
              ["players", "Players"],
              ["pages", "Display"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={panel === id}
                onClick={() => setPanel(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <fieldset
            className="lkx-sheet"
            aria-label="World"
            hidden={panel !== "world"}
            disabled={!master || generating}
          >
            <label className="lkx-field">
              <span>Title</span>
              <input
                className="lkx-title-input"
                maxLength={120}
                value={visible.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Untitled — the narrator names it"
              />
            </label>
            <label className="lkx-field">
              <span>
                Setting <small>optional</small>
              </span>
              <textarea
                className="lkx-parchment"
                rows={6}
                maxLength={6000}
                value={visible.world}
                onChange={(e) => update({ world: e.target.value })}
                placeholder="A place, an era, a situation — or nothing at all, and let the story surprise you…"
              />
            </label>
            <label className="lkx-field">
              <span>Language</span>
              <input
                list="lkx-story-languages"
                maxLength={60}
                value={visible.voice.language}
                onChange={(e) =>
                  update({
                    voice: { ...visible.voice, language: e.target.value },
                  })
                }
              />
              <datalist id="lkx-story-languages">
                {languages.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </datalist>
            </label>
            <div className="lkx-field" role="group" aria-label="Writing voice">
              <span>
                Writing voice <small>how the story sounds</small>
              </span>
              <NarratorPicker
                value={visible.voice}
                onChange={(voice) => update({ voice })}
              />
            </div>
            <div className="lkx-field" role="group" aria-label="Written by">
              <span>Written by</span>
              <div className="lkx-choices">
                {(
                  [
                    ["api", "Lorekeeper AI", "Writes each chapter by itself"],
                    ["chatgpt", "ChatGPT", "Start and Continue in ChatGPT"],
                  ] as const
                ).map(([mode, label, hint]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={visible.aiMode === mode}
                    onClick={() => update({ aiMode: mode })}
                  >
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </button>
                ))}
              </div>
            </div>
          </fieldset>
          <fieldset
            className="lkx-sheet"
            aria-label="Players"
            hidden={panel !== "players"}
            disabled={!master || generating}
          >
            <p className="lkx-sheet-hint">
              Everything is optional. Leave a character blank to discover it
              through the story.
            </p>
            {players.map((player) => {
              const identity = visible.identities.find(
                (i) => i.user === player.user_id,
              ) || {
                user: player.user_id,
                name: "",
                description: "",
                voice: null,
              };
              const change = (value: Partial<typeof identity>) =>
                update({
                  identities: [
                    ...form.identities.filter((i) => i.user !== player.user_id),
                    { ...identity, ...value },
                  ],
                });
              // Empty choices mean "same as story", so they are dropped.
              const setVoice = (value: PlayerVoice) => {
                const next: PlayerVoice = { ...identity.voice, ...value };
                if (!next.language) delete next.language;
                if (!next.style) delete next.style;
                change({ voice: Object.keys(next).length ? next : null });
              };
              const language = identity.voice?.language || "";
              return (
                <article className="lkx-player" key={player.user_id}>
                  <header>
                    <span className="lkx-seal" aria-hidden="true">
                      {(identity.name || player.name).slice(0, 1)}
                    </span>
                    <span>
                      <strong>{identity.name || player.name}</strong>
                      <small>
                        {player.name}
                        {player.user_id === story.owner_id ? " · Creator" : ""}
                        {player.user_id === user ? " · You" : ""}
                      </small>
                    </span>
                  </header>
                  <label className="lkx-field">
                    <span>Character name</span>
                    <input
                      maxLength={100}
                      value={identity.name}
                      onChange={(e) => change({ name: e.target.value })}
                      placeholder="Found in the story"
                    />
                  </label>
                  <label className="lkx-field">
                    <span>Who are they?</span>
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={identity.description}
                      onChange={(e) => change({ description: e.target.value })}
                      placeholder="Looks, past, quirks — anything the narrator should know…"
                    />
                  </label>
                  <div className="lkx-field-row">
                    <label className="lkx-field">
                      <span>Language</span>
                      <select
                        value={language}
                        onChange={(e) => setVoice({ language: e.target.value })}
                      >
                        <option value="">
                          Same as story ({visible.voice.language || "English"})
                        </option>
                        {[
                          ...languages,
                          ...(language && !languages.includes(language)
                            ? [language]
                            : []),
                        ].map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </label>
                    <label className="lkx-field">
                      <span>How they speak</span>
                      <select
                        value={identity.voice?.style || ""}
                        onChange={(e) => setVoice({ style: e.target.value })}
                      >
                        <option value="">Normally</option>
                        {styles
                          .filter((s) => s !== "Modern")
                          .map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </article>
              );
            })}
          </fieldset>
          <fieldset
            className="lkx-sheet"
            aria-label="Display format"
            hidden={panel !== "pages"}
            disabled={!master || generating}
          >
            <EditionPicker
              hidePreview
              previewEntry={story.segments.length ? preview : undefined}
              edition={visible.edition}
              design={visible.design}
              onEdition={(edition) => update({ edition })}
              onDesign={(design) => update({ design })}
            />
          </fieldset>
          <section
            hidden={panel !== "players" || !master || done}
            className="lkx-sheet lkx-invite"
          >
            <h2>Invite companions</h2>
            {master && (
              <>
                <UserPicker
                  selected={people}
                  onChange={setPeople}
                  excluded={players.map((p) => p.user_id)}
                />
                <button
                  className="lk-button"
                  disabled={busy || generating || !people.length}
                  onClick={async () => {
                    try {
                      for (const person of people)
                        await onInviteUser(person.id);
                      setPeople([]);
                    } catch (e) {
                      setSaveError(
                        e instanceof Error ? e.message : "Invitation failed",
                      );
                    }
                  }}
                >
                  Invite selected users
                </button>
                <button
                  className="lk-text-button"
                  disabled={generating}
                  onClick={async () => {
                    try {
                      setLink(await onInvite());
                    } catch (e) {
                      setSaveError(
                        e instanceof Error ? e.message : "Invitation failed",
                      );
                    }
                  }}
                >
                  Create invitation link
                </button>
                {link && (
                  <label className="lk-form">
                    Share this link
                    <input
                      readOnly
                      value={link}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                )}
                <p className="lk-hint">
                  Inviting another user makes this a shared session. Invite
                  again whenever the story is paused.
                </p>
              </>
            )}
          </section>
        </div>
        <div
          className="lkx-splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize settings and preview"
          aria-valuenow={ledger}
          aria-valuemin={LEDGER_MIN}
          tabIndex={0}
          title="Drag to resize · double-click to reset"
          onPointerDown={(e) => {
            const start = e.clientX,
              width = ledger,
              handle = e.currentTarget;
            handle.setPointerCapture(e.pointerId);
            const move = (ev: PointerEvent) =>
              resizeLedger(width + ev.clientX - start);
            const stop = () => {
              handle.removeEventListener("pointermove", move);
              handle.removeEventListener("pointerup", stop);
              handle.removeEventListener("pointercancel", stop);
            };
            handle.addEventListener("pointermove", move);
            handle.addEventListener("pointerup", stop);
            handle.addEventListener("pointercancel", stop);
          }}
          onDoubleClick={() => resizeLedger(LEDGER_DEFAULT)}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 80 : 24;
            if (e.key === "ArrowLeft") resizeLedger(ledger - step);
            else if (e.key === "ArrowRight") resizeLedger(ledger + step);
            else return;
            e.preventDefault();
          }}
        />
        <aside className="lkx-lectern">
          {visible.aiMode === "chatgpt" && (
            <ChatGPTHandoff
              story={{ ...story, ai_mode: "chatgpt" }}
              players={players}
              compact
              pending={dirty || busy}
            />
          )}
          <section className="lkx-lectern-frame" aria-label="Story preview">
            <header>
              <span>{scenes ? "Your story so far" : "A glimpse of the book"}</span>
              <span>
                {theme.mark} {theme.name}
              </span>
            </header>
            <div className="lkx-lectern-page" tabIndex={0}>
              <StoryDocument
                entry={preview}
                style={visible.edition}
                theme={theme}
                design={{ ...visible.design, pages: false }}
                ongoing={story.status !== "completed"}
              />
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
