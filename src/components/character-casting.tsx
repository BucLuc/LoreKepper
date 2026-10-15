"use client";
import { type Character, type Voice } from "@/lib/play";
import { VoiceSettings } from "./voice-settings";
import { Icon } from "./icon";
export function CharacterCasting({
  characters,
  selected,
  onSelect,
  inherit,
  onInherit,
  customVoice,
  onVoice,
  storyVoice,
  onCreate,
  disabled = false,
}: {
  characters: Character[];
  selected: string;
  onSelect: (id: string) => void;
  inherit: boolean;
  onInherit: (v: boolean) => void;
  customVoice: Voice;
  onVoice: (v: Voice) => void;
  storyVoice: Voice;
  onCreate: () => void;
  disabled?: boolean;
}) {
  const c = characters.find((c) => c.id === selected);
  return (
    <div className="lk-casting">
      <div className="lk-cast-options">
        <button
          type="button"
          className={`lk-cast-option ${!selected ? "is-selected" : ""}`}
          disabled={disabled}
          onClick={() => onSelect("")}
        >
          <span className="lk-cast-face">✧</span>
          <div>
            <strong>Discover as you go</strong>
            <small>No fixed identity. Become whoever you choose.</small>
          </div>
          <span className="lk-radio" />
        </button>
        {characters.map((c) => (
          <button
            type="button"
            key={c.id}
            disabled={disabled}
            className={`lk-cast-option ${selected === c.id ? "is-selected" : ""}`}
            onClick={() => onSelect(c.id)}
          >
            <span className="lk-cast-face">{c.avatar}</span>
            <div>
              <strong>{c.name}</strong>
              <small>
                {c.kind} · {c.personality}
              </small>
            </div>
            <span className="lk-radio" />
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          className="lk-cast-new"
          onClick={onCreate}
        >
          <Icon name="plus" /> Create a character
        </button>
      </div>
      {c && (
        <section className="lk-cast-voice">
          <h3>{c.name}’s voice in this story</h3>
          <div className="lk-segments" aria-label="Character voice">
            <button
              type="button"
              aria-pressed={inherit}
              onClick={() => onInherit(true)}
              disabled={disabled}
            >
              Use story settings
            </button>
            <button
              type="button"
              aria-pressed={!inherit}
              onClick={() => onInherit(false)}
              disabled={disabled}
            >
              Own voice for this story
            </button>
          </div>
          {inherit ? (
            <p className="lk-hint">
              {storyVoice.language} · {storyVoice.style}. Follows your world’s
              voice.
            </p>
          ) : (
            <VoiceSettings value={customVoice} onChange={onVoice} />
          )}
        </section>
      )}
    </div>
  );
}
