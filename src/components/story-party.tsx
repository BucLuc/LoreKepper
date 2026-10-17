"use client";
import { useState } from "react";
import type { NarratorPreset, Player, PlayerVoice } from "@/lib/play";
import { storyThemes } from "@/lib/story-themes";
import { Modal, SkeletonCards } from "./vault-ui";
import { Icon } from "./icon";
import { Feedback } from "./feedback";
import { UserPicker, type PickedUser } from "./user-picker";
import { languages } from "./voice-settings";
import type { PlayerCast } from "./story-form";
export const castOf = (p: Player): PlayerCast => ({
  name: p.identity_name || "",
  description: p.description || "",
  voice: p.voice || null,
});
export function Seal({ player }: { player: Player }) {
  return (
    <span className="lkx-seal" aria-hidden="true">
      {(player.identity_name || player.name).slice(0, 1)}
    </span>
  );
}
// The party as a list: each hero's name can be changed in place, everything else in
// the character sheet. Voice and language default to the story's.
export function FellowshipList({
  players,
  owner,
  user,
  canEdit,
  presets,
  presetsLoaded,
  storyLanguage,
  onPlayer,
  onError,
  onSaved,
}: {
  players: Player[];
  owner: string;
  user: string;
  canEdit: (p: Player) => boolean;
  presets: NarratorPreset[];
  presetsLoaded: boolean;
  storyLanguage: string;
  onPlayer: (player: string, cast: PlayerCast) => Promise<void>;
  onError: (message: string) => void;
  onSaved?: (message: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const editingPlayer = players.find((p) => p.user_id === editing);
  return (
    <>
      <ul className="lkx-roster">
        {players.map((p) => {
          const editable = canEdit(p),
            speech = presets.find((n) => n.id === p.voice?.narrator)?.name,
            traits = [
              p.description && p.description.slice(0, 70) + (p.description.length > 70 ? "…" : ""),
              speech && `talks like ${speech}`,
              p.voice?.language && `speaks ${p.voice.language}`,
            ].filter(Boolean);
          return (
            <li key={p.user_id} data-mine={p.user_id === user || undefined}>
              <Seal player={p} />
              <label>
                <small>
                  {p.name}
                  {p.user_id === owner ? " · Session Master" : ""}
                  {p.user_id === user ? " · You" : ""}
                </small>
                <input
                  key={p.identity_name || ""}
                  defaultValue={p.identity_name || ""}
                  maxLength={100}
                  readOnly={!editable}
                  placeholder="Nameless, for now"
                  aria-label={`Character name for ${p.name}`}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (editable && name !== (p.identity_name || ""))
                      onPlayer(p.user_id, { ...castOf(p), name }).catch((err) => onError(err.message));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
                <span className="lkx-roster-traits">{traits.length ? traits.join(" · ") : "Same voice as the story"}</span>
              </label>
              {editable && (
                <button
                  type="button"
                  className="lkx-roster-edit"
                  aria-label={`Character sheet for ${p.identity_name || p.name}`}
                  title="Character sheet"
                  onClick={() => setEditing(p.user_id)}
                >
                  <Icon name="edit" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {editingPlayer && (
        <PlayerModal
          player={editingPlayer}
          storyLanguage={storyLanguage}
          presets={presets}
          presetsLoaded={presetsLoaded}
          onClose={() => setEditing(null)}
          onSave={async (cast) => {
            await onPlayer(editingPlayer.user_id, cast);
            onSaved?.(`${cast.name || "The hero"}'s character sheet is sealed.`);
          }}
        />
      )}
    </>
  );
}
// Invite by name or by link. Only the creator sees this.
export function InvitePanel({
  players,
  disabled,
  onInvite,
  onInviteUser,
  onError,
}: {
  players: Player[];
  disabled?: boolean;
  onInvite: () => Promise<string>;
  onInviteUser: (id: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [people, setPeople] = useState<PickedUser[]>([]),
    [link, setLink] = useState(""),
    [copied, setCopied] = useState(false);
  const fail = (e: unknown) =>
    onError(e instanceof Error ? e.message : "Invitation failed");
  return (
    <div className="lkx-invite-panel">
      <UserPicker
        selected={people}
        onChange={setPeople}
        excluded={players.map((p) => p.user_id)}
      />
      <div className="lkx-invite-actions">
        <button
          type="button"
          className="lk-button is-primary"
          disabled={disabled || !people.length}
          onClick={async () => {
            try {
              for (const person of people) await onInviteUser(person.id);
              setPeople([]);
            } catch (e) {
              fail(e);
            }
          }}
        >
          Summon {people.length > 1 ? `${people.length} companions` : "companion"}
        </button>
        <button
          type="button"
          className="lk-text-button"
          disabled={disabled}
          onClick={async () => {
            try {
              const url = link || (await onInvite());
              setLink(url);
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch (e) {
              if (!link) fail(e);
            }
          }}
        >
          {copied ? "Link copied ✓" : link ? "Copy invitation link" : "Create invitation link"}
        </button>
      </div>
      {link && (
        <input
          className="lkx-invite-link"
          readOnly
          value={link}
          aria-label="Invitation link"
          onFocus={(e) => e.target.select()}
        />
      )}
    </div>
  );
}
// A player's character for this story: name, who they are, language and how they speak.
export function PlayerModal({
  player,
  storyLanguage,
  presets,
  presetsLoaded = true,
  onSave,
  onClose,
}: {
  player: Player;
  storyLanguage: string;
  presets: NarratorPreset[];
  presetsLoaded?: boolean;
  onSave: (cast: PlayerCast) => Promise<void>;
  onClose: () => void;
}) {
  const [cast, setCast] = useState(() => castOf(player)),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  // Empty choices mean "same as story", so they are dropped.
  const setVoice = (value: PlayerVoice) => {
    const next: PlayerVoice = { ...cast.voice, ...value };
    for (const key of Object.keys(next) as (keyof PlayerVoice)[])
      if (!next[key]) delete next[key];
    setCast({ ...cast, voice: Object.keys(next).length ? next : null });
  };
  const theme = presets.find((p) => p.id === player.voice?.narrator)?.mood || "";
  const language = cast.voice?.language || "",
    speech = cast.voice?.narrator || "";
  return (
    <Modal open wide title={`${cast.name || player.name} — character sheet`} onClose={onClose}>
      <form
        className="lkx-character-sheet lkx-sheet"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          try {
            await onSave(cast);
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save");
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="lkx-sheet-columns">
          <div className="lkx-sheet-identity">
            <label className="lkx-field">
              <span>Character name</span>
              <input
                className="lkx-title-input"
                maxLength={100}
                value={cast.name}
                onChange={(e) => setCast({ ...cast, name: e.target.value })}
                placeholder="Leave empty to be found in the story"
              />
            </label>
            <label className="lkx-field">
              <span>
                Who are they? <small>optional</small>
              </span>
              <textarea
                className="lkx-parchment"
                rows={9}
                maxLength={2000}
                value={cast.description}
                onChange={(e) => setCast({ ...cast, description: e.target.value })}
                placeholder="Looks, past, quirks, a dark secret, an unreasonable fear of geese…"
              />
            </label>
            <label className="lkx-field">
              <span>Language</span>
              <select value={language} onChange={(e) => setVoice({ language: e.target.value })}>
                <option value="">Same as the story ({storyLanguage || "English"})</option>
                {[...languages, ...(language && !languages.includes(language) ? [language] : [])].map(
                  (l) => (
                    <option key={l}>{l}</option>
                  ),
                )}
              </select>
            </label>
          </div>
          <div className="lkx-field" role="group" aria-label="How they speak">
            <span>
              How they speak <small>their dialogue only</small>
            </span>
            <VoiceGrid
              presets={presets}
              loaded={presetsLoaded}
              value={speech}
              onChange={(id) => setVoice({ narrator: id, style: undefined, speech: undefined })}
              initialTheme={theme}
              plain={{ name: "Same as the story", hint: "They sound like the rest of the tale." }}
            />
          </div>
        </div>
        {error && (
          <Feedback error onDismiss={() => setError("")}>
            {error}
          </Feedback>
        )}
        <div className="lkx-sheet-actions">
          <button type="button" className="lk-text-button" onClick={onClose}>
            Cancel
          </button>
          <button className="gold-button lkx-begin" disabled={saving}>
            {saving ? "Sealing…" : "Seal the character sheet"} <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Every writing voice, filterable by theme: the name first, then how it sounds.
// The first card stands for "no special voice".
export function VoiceGrid({
  presets,
  loaded,
  value,
  onChange,
  plain,
  initialTheme = "",
  compact = true,
}: {
  presets: NarratorPreset[];
  loaded: boolean;
  value: string;
  onChange: (id: string) => void;
  plain: { name: string; hint: string };
  initialTheme?: string;
  compact?: boolean;
}) {
  const [theme, setTheme] = useState(initialTheme);
  return (
    <>
      <div className="lkx-teller-moods" role="group" aria-label="Theme">
        <button type="button" aria-pressed={!theme} onClick={() => setTheme("")}>
          All
        </button>
        {storyThemes.map((t) => (
          <button key={t.id} type="button" aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}>
            {t.sigil} {t.name}
          </button>
        ))}
      </div>
      <div className={`lkx-teller-grid ${compact ? "is-compact" : ""}`}>
        <button type="button" className="lkx-teller" aria-pressed={!value} onClick={() => onChange("")}>
          <strong>{plain.name}</strong>
          <small>{plain.hint}</small>
        </button>
        {!loaded && <SkeletonCards count={5} seal={false} label="Gathering the voices" />}
        {presets
          .filter((p) => !theme || p.mood === theme)
          .map((p) => (
            <button
              key={p.id}
              type="button"
              className="lkx-teller"
              aria-pressed={value === p.id}
              onClick={() => onChange(p.id)}
            >
              <strong>{p.name}</strong>
              <q>{p.sample}</q>
            </button>
          ))}
      </div>
    </>
  );
}
// The party as small seals with names, for the lobby header. A click opens the
// character sheet (yours, or anyone's for the Session Master); + invites.
export function PartyChips({
  players,
  owner,
  user,
  canEdit,
  canInvite,
  presets,
  presetsLoaded,
  storyLanguage,
  busy,
  onPlayer,
  onInvite,
  onInviteUser,
  onError,
  onSaved,
}: {
  players: Player[];
  owner: string;
  user: string;
  canEdit: (p: Player) => boolean;
  canInvite: boolean;
  presets: NarratorPreset[];
  presetsLoaded: boolean;
  storyLanguage: string;
  busy?: boolean;
  onPlayer: (player: string, cast: PlayerCast) => Promise<void>;
  onInvite: () => Promise<string>;
  onInviteUser: (id: string) => Promise<void>;
  onError: (message: string) => void;
  onSaved?: (message: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null),
    [inviting, setInviting] = useState(false);
  const editingPlayer = players.find((p) => p.user_id === editing);
  return (
    <div className="lkx-party-chips" role="group" aria-label="The party">
      {players.map((p) => {
        const label = p.identity_name || p.name;
        const role = `${p.name}${p.user_id === owner ? " · Session Master" : ""}${p.user_id === user ? " · You" : ""}`;
        return canEdit(p) ? (
          <button
            key={p.user_id}
            type="button"
            className="lkx-party-chip"
            title={`${role} — open the character sheet`}
            onClick={() => setEditing(p.user_id)}
          >
            <Seal player={p} />
            <span>{label}</span>
          </button>
        ) : (
          <span key={p.user_id} className="lkx-party-chip" title={role}>
            <Seal player={p} />
            <span>{label}</span>
          </span>
        );
      })}
      {canInvite && (
        <button
          type="button"
          className="lkx-party-chip is-invite"
          title="Summon a companion"
          aria-label="Summon a companion"
          onClick={() => setInviting(true)}
        >
          <span className="lkx-seal" aria-hidden="true">
            +
          </span>
        </button>
      )}
      {editingPlayer && (
        <PlayerModal
          player={editingPlayer}
          storyLanguage={storyLanguage}
          presets={presets}
          presetsLoaded={presetsLoaded}
          onClose={() => setEditing(null)}
          onSave={async (cast) => {
            await onPlayer(editingPlayer.user_id, cast);
            onSaved?.(`${cast.name || "The hero"}'s character sheet is sealed.`);
          }}
        />
      )}
      {inviting && (
        <Modal open title="Summon a companion" onClose={() => setInviting(false)}>
          <p className="lk-hint">
            Chosen companions join right away and get the invitation in your chat with them.
          </p>
          <InvitePanel
            players={players}
            disabled={busy}
            onInvite={onInvite}
            onInviteUser={async (id) => {
              await onInviteUser(id);
              onSaved?.("A new companion joins the fellowship. The invitation waits in your chat.");
            }}
            onError={onError}
          />
        </Modal>
      )}
    </div>
  );
}
