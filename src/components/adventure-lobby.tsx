"use client";
import { useMemo, useState } from "react";
import type { Adventure, Player } from "@/lib/play";
import { storyEntry } from "@/lib/play";
import { themeOf } from "@/lib/story-themes";
import { useNarratorPresets } from "./narrator-picker";
import { Feedback } from "./feedback";
import { DisplayGallery } from "./display-gallery";
import { PartyChips } from "./story-party";
import { aiLabel } from "./story-setup";
import { useAIOptions, useStoryForm, type PlayerCast, type StorySettings } from "./story-form";
import { providerName } from "@/lib/ai-config";
import { Crumbs } from "./crumbs";
// The lobby after the setup: a short header to begin, the party beside the display.
// The story, its voice and its AI were chosen in the setup and stay as they are; the
// display can always change.
export function AdventureLobby({
  story,
  players,
  user,
  busy,
  generating,
  error,
  onSave,
  onPlayer,
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
  onSave: (settings: StorySettings) => Promise<void>;
  onPlayer: (player: string, cast: PlayerCast) => Promise<void>;
  onStart: (mode?: "api" | "chatgpt") => Promise<void>;
  onInvite: () => Promise<string>;
  onInviteUser: (id: string) => Promise<void>;
}) {
  const master = story.owner_id === user;
  const { presets, loaded: presetsLoaded } = useNarratorPresets();
  const { form, update, dirty, saveError, setSaveError, flush } = useStoryForm({
    story,
    master,
    busy,
    generating,
    onSave,
  });
  const [notice, setNotice] = useState("");
  const scenes = story.segments.length,
    done = story.status === "completed",
    theme = themeOf(story.setup?.theme),
    canInvite = master && ["lobby", "paused"].includes(story.status),
    // The AI can change until the first chapter exists (the database agrees).
    quillOpen = master && !scenes && !story.draft?.parts.length && story.status === "lobby";
  const { options: ai } = useAIOptions(quillOpen);
  const quill = form.aiMode === "chatgpt" ? "chatgpt" : form.aiProvider || "";
  const preview = useMemo(() => {
    const entry = storyEntry({ ...story, title: story.title || "Your next adventure" }, players, false);
    if (!scenes) {
      const sample = `## Chapter I: An Unwritten Beginning\n\n*${story.title || "Somewhere beyond the familiar"}*\n\nThe doors open slowly. Candlelight spills across the stone floor, and somewhere in the distance a bell begins to toll. A stranger looks up from the hearth.\n\n‘We were wondering when thou wouldst arrive.’\n\nYour own tale will appear here when the adventure begins.`;
      entry.messages[0].content = sample;
      entry.messages[0].presentation = sample;
    }
    return entry;
  }, [story, players, scenes]);
  const titleWords = (story.title || "An untold adventure").trim().split(/\s+/);
  const begin = async () => {
    try {
      if (dirty) await flush();
      await onStart(story.ai_mode);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not start");
    }
  };
  return (
    <section className="lkx-lobby">
      <header className="lkx-lobby-head">
        <Crumbs
          items={[
            { label: "Interactive Stories", href: "/interactive" },
            { label: story.title || "An untold adventure" },
            { label: "Lobby" },
          ]}
        />
        <div className="lkx-lobby-head-copy">
          <span className="lkx-eyebrow">{scenes ? "Return to your world" : "The story lobby"}</span>
          <h1>
            {titleWords.slice(0, -1).join(" ")} <em>{titleWords.at(-1)}</em>
          </h1>
          <p>
            {story.world.trim() ||
              `${theme ? `${theme.tagline} ` : ""}The narrator chooses the world on the very first page.`}
          </p>
          <ul className="lkx-hero-facts" aria-label="Story details">
            {done && <li>Complete</li>}
            <li>{scenes ? `${scenes} scene${scenes === 1 ? "" : "s"} written` : "An unwritten beginning"}</li>
            {theme && (
              <li>
                {theme.sigil} {theme.name}
              </li>
            )}
            {story.voice.persona && (
              <li>{story.voice.narrator === "custom" ? "Own voice" : story.voice.narratorName}</li>
            )}
            <li>{story.voice.language}</li>
            {!quillOpen && <li>{aiLabel(story)}</li>}
          </ul>
          <div className="lkx-lobby-head-row">
            <PartyChips
              players={players}
              owner={story.owner_id}
              user={user}
              canEdit={(p) => master || p.user_id === user}
              canInvite={canInvite}
              presets={presets}
              presetsLoaded={presetsLoaded}
              storyLanguage={story.voice.language}
              busy={busy || generating}
              onPlayer={onPlayer}
              onInvite={onInvite}
              onInviteUser={onInviteUser}
              onError={setSaveError}
              onSaved={setNotice}
            />
            {quillOpen && (
              <label className="lkx-quill-select" title="Who writes the chapters">
                <span aria-hidden="true">✒</span>
                <span className="sr-only">Who writes the chapters</span>
                <select
                  value={quill}
                  disabled={!ai || busy}
                  onChange={(e) =>
                    update(
                      e.target.value === "chatgpt"
                        ? { aiMode: "chatgpt", aiProvider: null }
                        : { aiMode: "api", aiProvider: e.target.value },
                    )
                  }
                >
                  {!quill && <option value="">Choose who writes…</option>}
                  {(ai?.shared || quill === "shared") && <option value="shared">Lorekeeper&apos;s free AI</option>}
                  <option value="chatgpt">ChatGPT</option>
                  {(ai?.keys || []).map((k) => (
                    <option key={k.provider} value={k.provider}>
                      {providerName(k.provider)} · your key
                    </option>
                  ))}
                  {quill && !["shared", "chatgpt"].includes(quill) && !ai?.keys.some((k) => k.provider === quill) && (
                    <option value={quill}>{providerName(quill)} · your key</option>
                  )}
                </select>
              </label>
            )}
          </div>
        </div>
        <div className="lkx-lobby-head-actions">
          {done ? (
            <button className="gold-button lkx-begin" disabled={busy} onClick={() => void onStart()}>
              Read the story <span aria-hidden="true">→</span>
            </button>
          ) : master ? (
            <button className="gold-button lkx-begin" disabled={busy || generating} onClick={() => void begin()}>
              {generating
                ? "The narrator is writing…"
                : scenes
                  ? "Continue the tale"
                  : story.ai_mode === "chatgpt"
                    ? "Begin with ChatGPT"
                    : "Turn the first page"}
              <span aria-hidden="true">→</span>
            </button>
          ) : story.status === "active" ? (
            <button className="gold-button lkx-begin" onClick={() => void onStart()}>
              Join the story <span aria-hidden="true">→</span>
            </button>
          ) : (
            <span className="lkx-hero-wait">Waiting for the Session Master to begin</span>
          )}
          {master && !scenes && story.status === "lobby" && (
            <button
              type="button"
              className="lk-text-button"
              disabled={busy}
              onClick={() =>
                void flush({ setup: story.setup ? { ...story.setup, done: false } : { step: 1 } }).catch((e) =>
                  setSaveError(e.message),
                )
              }
            >
              ← {story.setup ? "Revise the forging" : "Forge the tale"}
            </button>
          )}
          {dirty && (
            <span className="lkx-save-state" role="status">
              Saving changes…
            </span>
          )}
        </div>
      </header>
      {(error || saveError) && (
        <Feedback error onDismiss={() => setSaveError("")}>
          {error || saveError}
        </Feedback>
      )}
      {notice && <Feedback onDismiss={() => setNotice("")}>{notice}</Feedback>}

      <div className="lkx-lobby-body">
        <section className="lkx-lobby-display" aria-labelledby="lkx-display">
          <span className="lkx-eyebrow">The display</span>
          <h2 id="lkx-display">How the tale is bound</h2>
          <DisplayGallery
            edition={form.edition}
            design={form.design}
            entry={preview}
            ongoing={!done}
            disabled={!master || generating}
            onChange={(edition, design) => update({ edition, design })}
          />
        </section>
      </div>
    </section>
  );
}
