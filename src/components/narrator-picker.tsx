"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { NarratorPreset, Voice } from "@/lib/play";
import { Modal } from "./vault-ui";
const moods = [
  ["", "All"],
  ["pirate", "Pirates"],
  ["medieval", "Medieval"],
  ["comedic", "Comedic"],
  ["atmospheric", "Atmospheric"],
  ["wildcard", "Wildcards"],
] as const;
const plain = {
  id: "",
  name: "Plain",
  blurb: "Natural storytelling, no special voice.",
  sample: "The rain had not stopped for three days when the stranger arrived.",
};
const custom = {
  id: "custom",
  name: "Your own voice",
  blurb: "Describe how the story should sound.",
  sample: "Anything you like — gothic romance, a cooking show, legal paperwork.",
};
// How the story sounds. The lobby shows the current choice; the dialog lists the
// presets (rows of the narrators table, editable in Supabase) by mood. The server
// copies the chosen voice into the story when the lobby saves.
export function NarratorPicker({
  value,
  onChange,
}: {
  value: Voice;
  onChange: (v: Voice) => void;
}) {
  const [presets, setPresets] = useState<NarratorPreset[]>([]),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [mood, setMood] = useState("");
  useEffect(() => {
    let alive = true;
    supabase()
      .from("narrators")
      .select("id,name,mood,blurb,sample")
      .order("sort")
      .then((r) => {
        if (!alive) return;
        if (r.error)
          setError(
            "Writing voices appear once the narrators migration is applied in Supabase.",
          );
        else setPresets(r.data as NarratorPreset[]);
      });
    return () => {
      alive = false;
    };
  }, []);
  const selected = value.narrator || "";
  const current =
    selected === "custom"
      ? custom
      : presets.find((p) => p.id === selected) ||
        (selected
          ? { ...plain, id: selected, name: value.narratorName || "…" }
          : plain);
  const pick = (id: string) => {
    onChange({
      ...value,
      narrator: id || undefined,
      narratorName: undefined,
      persona: id === "custom" ? value.persona : undefined,
    });
    setOpen(false);
  };
  const shown = presets.filter((p) => !mood || p.mood === mood);
  const card = (n: { id: string; name: string; blurb: string; sample: string }) => (
    <button
      key={n.id || "plain"}
      type="button"
      className="lkx-teller"
      aria-pressed={selected === n.id}
      onClick={() => pick(n.id)}
    >
      <q>{n.sample}</q>
      <strong>{n.name}</strong>
      <small>{n.blurb}</small>
    </button>
  );
  return (
    <>
      <div className="lkx-storyteller">
        <div>
          <strong>{current.name}</strong>
          <q>{current.sample}</q>
        </div>
        <button type="button" onClick={() => setOpen(true)}>
          Change
        </button>
      </div>
      {selected === "custom" && (
        <textarea
          className="lkx-narrator-custom"
          rows={3}
          maxLength={600}
          value={value.persona || ""}
          onChange={(e) =>
            onChange({ ...value, narrator: "custom", persona: e.target.value })
          }
          placeholder="How should the story sound? e.g. Gothic romance prose: candlelight, longing glances and very dramatic weather."
        />
      )}
      {open && (
        <Modal open wide title="How should the story sound?" onClose={() => setOpen(false)}>
          <div className="lkx-teller-moods" role="group" aria-label="Mood">
            {moods.map(([id, label]) => (
              <button
                key={id || "all"}
                type="button"
                aria-pressed={mood === id}
                onClick={() => setMood(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="lkx-teller-grid">
            {!mood && card(plain)}
            {shown.map(card)}
            {!mood && card(custom)}
          </div>
          {error && <p className="lk-hint">{error}</p>}
        </Modal>
      )}
    </>
  );
}
