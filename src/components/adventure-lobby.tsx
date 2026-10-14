"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import type { Adventure, Player, Voice } from "@/lib/play";
import { storyEntry } from "@/lib/play";
import { readerEditions } from "@/lib/reader-editions";
import { EditionPicker } from "./edition-picker";
import { VoiceSettings } from "./voice-settings";
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
  identities: { user: string; name: string; description: string }[];
};
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
  const latest = useRef(form);
  useEffect(() => {
    if (dirty || busy) return;
    const next = settings(story, players);
    queueMicrotask(() => {
      latest.current = next;
      setForm(next);
    });
  }, [story, players, dirty, busy]);
  const update = (change: Partial<LobbySettings>) => {
    setForm((f) => {
      const next = { ...f, ...change };
      latest.current = next;
      return next;
    });
    setDirty(true);
    setSaveError("");
  };
  useEffect(() => {
    if (!dirty || busy || generating || !master || saveError) return;
    const timer = setTimeout(() => {
      void onSave(form)
        .then(() => {
          if (latest.current === form) {
            setDirty(false);
            setSaveError("");
          }
        })
        .catch((e) => setSaveError(e.message));
    }, 750);
    return () => clearTimeout(timer);
  }, [form, dirty, busy, generating, master, onSave, saveError]);
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
            <li>
              {scenes
                ? `${scenes} scene${scenes === 1 ? "" : "s"} written`
                : "An unwritten beginning"}
            </li>
            <li>{theme.name}</li>
            <li>{visible.voice.language}</li>
            <li>{visible.aiMode === "chatgpt" ? "ChatGPT narrator" : "AI narrator"}</li>
          </ul>
          <div className="lkx-hero-actions">
            {master ? (
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
      <div className="lkx-lobby-grid">
        <div className="lkx-ledger lk-lobby-settings">
          <nav className="lkx-ledger-tabs" aria-label="Lobby settings">
            {[
              ["world", "The story"],
              ["players", "The party"],
              ["pages", "The book"],
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
          <fieldset hidden={panel !== "world"} disabled={!master || generating}>
            <legend>Story settings</legend>
            <div className="lk-form">
              <label>
                Story title <small>Optional — the narrator can choose</small>
                <input
                  maxLength={120}
                  value={visible.title}
                  onChange={(e) => update({ title: e.target.value })}
                  placeholder="Leave blank for the narrator"
                />
              </label>
              <label>
                World setting{" "}
                <small>Optional — write as much or as little as you like</small>
                <textarea
                  rows={4}
                  maxLength={6000}
                  value={visible.world}
                  onChange={(e) => update({ world: e.target.value })}
                  placeholder="A place, an era, a situation, or something completely unexpected…"
                />
              </label>
              <details className="lk-disclosure">
                <summary>Story language and writing voice</summary>
                <VoiceSettings
                  value={visible.voice}
                  onChange={(voice) => update({ voice })}
                />
              </details>
            </div>
          </fieldset>
          <fieldset hidden={panel !== "players"} disabled={!master || generating}>
            <legend>Player identities</legend>
            <p className="lk-hint">
              A name and a description are enough. Leave them blank to discover
              your identity through the story.
            </p>
            {players.map((player) => {
              const identity = visible.identities.find(
                (i) => i.user === player.user_id,
              ) || {
                user: player.user_id,
                name: player.name,
                description: player.description || "",
              };
              const change = (value: Partial<typeof identity>) =>
                update({
                  identities: [
                    ...form.identities.filter((i) => i.user !== player.user_id),
                    { ...identity, ...value },
                  ],
                });
              return (
                <details
                  className="lk-lobby-player"
                  key={player.user_id}
                  open={players.length === 1}
                >
                  <summary>{player.name}</summary>
                  <div className="lk-form">
                    <label>
                      Name <small>Optional</small>
                      <input
                        maxLength={100}
                        value={identity.name}
                        onChange={(e) => change({ name: e.target.value })}
                      />
                    </label>
                    <label>
                      Description <small>Optional</small>
                      <textarea
                        rows={3}
                        maxLength={2000}
                        value={identity.description}
                        onChange={(e) =>
                          change({ description: e.target.value })
                        }
                        placeholder="Anything the narrator should know about you…"
                      />
                    </label>
                  </div>
                </details>
              );
            })}
          </fieldset>
          <fieldset hidden={panel !== "world"} disabled={!master || generating}>
            <legend>Narrator</legend>
            <div className="lk-narrator-modes">
              <button
                type="button"
                aria-pressed={visible.aiMode === "api"}
                onClick={() => update({ aiMode: "api" })}
              >
                <strong>AI API</strong>
                <small>
                  The app writes each scene automatically using your configured
                  AI access.
                </small>
              </button>
              <button
                type="button"
                aria-pressed={visible.aiMode === "chatgpt"}
                onClick={() => update({ aiMode: "chatgpt" })}
              >
                <strong>ChatGPT web chat</strong>
                <small>
                  Use your connected GPT. Send start and continue there; scenes
                  appear here live.
                </small>
              </button>
            </div>
          </fieldset>
          <fieldset hidden={panel !== "pages"} disabled={!master || generating}>
            <legend>Display format</legend>
            <EditionPicker
              hidePreview
              previewEntry={story.segments.length ? preview : undefined}
              edition={visible.edition}
              design={visible.design}
              onEdition={(edition) => update({ edition })}
              onDesign={(design) => update({ design })}
            />
          </fieldset>
          <section hidden={panel !== "players" || !master} className="lk-settings-card lkx-invite">
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
        <aside className="lkx-lectern">
          {visible.aiMode === "chatgpt" && (
            <ChatGPTHandoff
              story={{ ...story, ai_mode: "chatgpt" }}
              players={players}
              compact
              canSave={master}
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
