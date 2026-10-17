"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Exhibit } from "@/lib/archive";
import { editionGroups, readerEditions } from "@/lib/reader-editions";
import { editionPalettes, switchEditionDesign, type EditionDesign } from "@/lib/edition-design";
import { StoryDocument } from "./story-document";
import { EditionCustomizer } from "./edition-customizer";
const SPLIT_KEY = "lorekeeper-display-split",
  SPLIT_DEFAULT = 0.52,
  SPLIT_MIN = 0.25,
  SPLIT_MAX = 0.75;
// Every display format at a glance, grouped like the edition picker, with the story
// itself in the chosen format beside it. The only setting that stays open for good.
export function DisplayGallery({
  edition,
  design,
  entry,
  ongoing,
  disabled,
  onChange,
}: {
  edition: string;
  design: EditionDesign;
  entry: Exhibit;
  ongoing: boolean;
  disabled: boolean;
  onChange: (edition: string, design: EditionDesign) => void;
}) {
  const [group, setGroup] = useState("");
  // The catalogue and the preview share the width; drag the handle to change it.
  const grid = useRef<HTMLDivElement>(null),
    [split, setSplit] = useState(SPLIT_DEFAULT);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(SPLIT_KEY));
      if (saved) queueMicrotask(() => setSplit(saved));
    } catch {}
  }, []);
  const resize = (fraction: number) => {
    const next = Math.round(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, fraction)) * 1000) / 1000;
    setSplit(next);
    try {
      localStorage.setItem(SPLIT_KEY, String(next));
    } catch {}
  };
  const theme = readerEditions.find((e) => e.id === edition) || readerEditions[0];
  const shown = editionGroups.filter((g) => !group || g.name === group);
  return (
    <div
      className="lkx-display"
      ref={grid}
      style={{ "--catalogue": `${split * 100}%` } as CSSProperties}
    >
      <div className="lkx-display-catalogue">
        <div className="lkx-teller-moods" role="group" aria-label="Display category">
          <button type="button" aria-pressed={!group} onClick={() => setGroup("")}>
            Every format
          </button>
          {editionGroups.map((g) => (
            <button key={g.name} type="button" aria-pressed={group === g.name} onClick={() => setGroup(g.name)}>
              {g.name}
            </button>
          ))}
        </div>
        {shown.map((g) => (
          <section key={g.name} className="lkx-display-group" aria-label={g.name}>
            {!group && <h3>{g.name}</h3>}
            <div className="lkx-formats">
              {g.ids.map((id) => {
                const e = readerEditions.find((x) => x.id === id);
                if (!e) return null;
                const p = editionPalettes[id];
                return (
                  <button
                    key={id}
                    type="button"
                    className="lkx-format"
                    aria-pressed={edition === id}
                    disabled={disabled}
                    style={
                      {
                        "--card-paper": p?.surface,
                        "--card-ink": p?.ink,
                        "--card-accent": p?.accent,
                        "--card-panel": p?.panel,
                      } as CSSProperties
                    }
                    onClick={() => onChange(id, switchEditionDesign(design, id))}
                  >
                    <span className="lkx-format-page" aria-hidden="true">
                      <b>{e.mark}</b>
                      <i />
                      <i />
                      <i />
                    </span>
                    <strong>{e.name}</strong>
                    <small>{e.description}</small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div
        className="lkx-display-split"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the formats and the preview"
        aria-valuenow={Math.round(split * 100)}
        aria-valuemin={SPLIT_MIN * 100}
        aria-valuemax={SPLIT_MAX * 100}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={(e) => {
          const box = grid.current?.getBoundingClientRect();
          if (!box) return;
          const handle = e.currentTarget;
          handle.setPointerCapture(e.pointerId);
          const move = (ev: PointerEvent) => resize((ev.clientX - box.left) / box.width);
          const stop = () => {
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", stop);
            handle.removeEventListener("pointercancel", stop);
          };
          handle.addEventListener("pointermove", move);
          handle.addEventListener("pointerup", stop);
          handle.addEventListener("pointercancel", stop);
        }}
        onDoubleClick={() => resize(SPLIT_DEFAULT)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.08 : 0.03;
          if (e.key === "ArrowLeft") resize(split - step);
          else if (e.key === "ArrowRight") resize(split + step);
          else return;
          e.preventDefault();
        }}
      />
      <aside className="lkx-display-preview">
        <header>
          <span className="lkx-eyebrow">Your story in this format</span>
          <strong>
            {theme.mark} {theme.name}
          </strong>
        </header>
        <div className="lkx-lectern-page" tabIndex={0}>
          <StoryDocument
            entry={entry}
            style={edition}
            theme={theme}
            design={{ ...design, pages: false }}
            ongoing={ongoing}
          />
        </div>
        {!disabled && (
          <details className="lk-disclosure">
            <summary>Customize this format</summary>
            <EditionCustomizer preset={edition} value={design} onChange={(d) => onChange(edition, d)} />
          </details>
        )}
      </aside>
    </div>
  );
}
