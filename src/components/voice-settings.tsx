"use client";
import { useId } from "react";
import { styles, type Voice } from "@/lib/play";
export const languages = [
  "English",
  "German",
  "French",
  "Italian",
  "Spanish",
  "Portuguese",
  "Japanese",
];
export function VoiceSettings({
  value,
  onChange,
}: {
  value: Voice;
  onChange: (v: Voice) => void;
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
          {languages.map((l) => (
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
    </div>
  );
}
