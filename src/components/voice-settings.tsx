"use client";
import { useId } from "react";
import { styles, tones, type Voice } from "@/lib/play";
export function VoiceSettings({
  value,
  onChange,
  scope = true,
}: {
  value: Voice;
  onChange: (v: Voice) => void;
  scope?: boolean;
}) {
  const id = useId();
  return (
    <div className="play-voice lk-voice">
      <label>
        Language
        <input
          value={value.language}
          maxLength={60}
          onChange={(e) => onChange({ ...value, language: e.target.value })}
          list={id}
        />
        <datalist id={id}>
          {[
            "English",
            "German",
            "French",
            "Italian",
            "Spanish",
            "Portuguese",
            "Japanese",
          ].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </datalist>
      </label>
      <label>
        Writing style
        <select
          value={value.style}
          onChange={(e) => onChange({ ...value, style: e.target.value })}
        >
          {styles.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Tone
        <select
          value={value.tone}
          onChange={(e) => onChange({ ...value, tone: e.target.value })}
        >
          {tones.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <small>Default follows the scene naturally.</small>
      </label>
      {scope && (
        <label>
          Style applies to
          <select
            value={value.scope}
            onChange={(e) =>
              onChange({ ...value, scope: e.target.value as Voice["scope"] })
            }
          >
            <option value="dialogue">Dialogue only</option>
            <option value="entire">Entire story</option>
          </select>
        </label>
      )}
    </div>
  );
}
