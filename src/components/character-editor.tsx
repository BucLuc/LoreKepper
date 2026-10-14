"use client";
import { useState } from "react";
import { avatars, type Character } from "@/lib/play";
import { playApi } from "@/lib/play-client";
import { Modal } from "./vault-ui";
export type PlayCollection = { id: string; name: string; owner_id: string };
export function CharacterEditor({
  value,
  collections = [],
  onClose,
  onSaved,
}: {
  value?: Character;
  collections?: PlayCollection[];
  onClose: () => void;
  onSaved: (c: Character) => Promise<void>;
}) {
  const [name, setName] = useState(value?.name || ""),
    [kind, setKind] = useState(value?.kind || "Human"),
    [personality, setPersonality] = useState(value?.personality || ""),
    [avatar, setAvatar] = useState(value?.avatar || avatars[0]),
    [collection, setCollection] = useState(value?.collection_id || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      open
      title={value ? "Edit character" : "Meet your character"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="lk-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const r = await playApi("character", {
              id: value?.id,
              character: {
                name,
                kind,
                personality,
                avatar,
                collection_id: collection || null,
              },
            });
            await onSaved(Array.isArray(r) ? r[0] : r);
            onClose();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not save character.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="lk-form-row">
          <label>
            Name
            <input
              autoFocus
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sir Reginald"
            />
          </label>
          <label>
            Type
            <input
              maxLength={120}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              placeholder="Knight, cat, dragon…"
            />
          </label>
        </div>
        <label>
          Who are they?
          <textarea
            required
            maxLength={6000}
            rows={4}
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            placeholder="A painfully proud knight who would fight a dragon for a stray cat. Describe their personality, history and quirks."
          />
        </label>
        <fieldset className="lk-avatar-picker">
          <legend>Choose a face</legend>
          {avatars.map((a) => (
            <button
              type="button"
              key={a}
              aria-label={`Avatar ${a}`}
              aria-pressed={avatar === a}
              onClick={() => setAvatar(a)}
            >
              {a}
            </button>
          ))}
        </fieldset>
        {collections.length > 0 && (
          <label>
            Save to
            <select
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
            >
              <option value="">My personal characters</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="lk-hint">
          Choose their language and voice when you add them to a story. This
          character can play a different role in every adventure.
        </p>
        {error && (
          <p className="lk-alert" role="alert">
            {error}
          </p>
        )}
        <div className="lk-dialog-actions">
          <button
            className="lk-button"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="lk-button is-primary" disabled={busy}>
            {busy ? "Saving…" : value ? "Save changes" : "Create character"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
