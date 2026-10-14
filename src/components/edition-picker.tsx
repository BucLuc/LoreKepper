"use client";
import { readerEditions, editionGroups } from "@/lib/reader-editions";
import {
  presetDesign,
  editionPalettes,
  type EditionDesign,
} from "@/lib/edition-design";
import { StoryDocument } from "./story-document";
import { EditionCustomizer } from "./edition-customizer";
import { type Exhibit } from "@/lib/archive";
import { prepareEntries } from "@/lib/archive";
import { useMemo, useState, type CSSProperties } from "react";
const previewText =
  "The throne room fell silent as the doors swung open. Rainwater dripped from your cloak onto the polished marble.\n\n“Thou art late,” said the queen. Her captain reached for his sword.\n\nBehind the throne, something enormous sneezed. The queen closed her eyes. “And the dragon is allergic to visitors.”";
export function EditionPicker({
  edition,
  design,
  onEdition,
  onDesign,
  previewEntry,
  hidePreview = false,
}: {
  previewEntry?: Exhibit;
  hidePreview?: boolean;
  edition: string;
  design: EditionDesign;
  onEdition: (id: string) => void;
  onDesign: (d: EditionDesign) => void;
}) {
  const [group, setGroup] = useState(
    editionGroups.find((g) => g.ids.includes(edition))?.name ||
      editionGroups[0].name,
  );
  const theme =
    readerEditions.find((e) => e.id === edition) || readerEditions[0];
  const entry = useMemo(
    () =>
      prepareEntries([
        {
          id: "preview",
          title: "A most inconvenient audience",
          source: "LoreKeeper",
          type: "story",
          score: 0,
          reason: "",
          messages: [
            {
              id: "preview",
              author: "Your adventure",
              source: "LoreKeeper",
              sourceFormat: "markdown",
              timestamp: "",
              content: previewText,
            },
          ],
        },
      ])[0],
    [],
  );
  const choices =
    editionGroups
      .find((g) => g.name === group)
      ?.ids.map((id) => readerEditions.find((e) => e.id === id))
      .filter((e) => !!e) || [];
  return (
    <div className="lk-edition-layout">
      <div>
        <label className="lk-edition-category">
          Display category
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {editionGroups.map((g) => (
              <option key={g.name}>{g.name}</option>
            ))}
          </select>
        </label>
        <div className="lk-edition-choices">
          {choices.map((e) => {
            const p = editionPalettes[e.id];
            return (
              <button
                type="button"
                key={e.id}
                className={`lk-edition-card ${edition === e.id ? "is-selected" : ""}`}
                style={
                  {
                    "--card-paper": p?.surface,
                    "--card-ink": p?.ink,
                    "--card-accent": p?.accent,
                  } as CSSProperties
                }
                onClick={() => {
                  onEdition(e.id);
                  onDesign({ ...presetDesign(e.id), showCover: false });
                }}
              >
                <span>{e.mark}</span>
                <strong>{e.name}</strong>
                <small>
                  {edition === e.id ? "Selected" : "Choose edition"}
                </small>
              </button>
            );
          })}
        </div>
        <details className="lk-disclosure">
          <summary>Customize this edition</summary>
          <EditionCustomizer
            preset={edition}
            value={design}
            onChange={onDesign}
          />
        </details>
      </div>
      {!hidePreview && (
        <section className="lk-edition-preview" aria-label="Display preview">
          <div className="lk-preview-label">
            <span>LIVE PREVIEW</span>
            <strong>{theme.name}</strong>
          </div>
          <div className="lk-preview-paper">
            <StoryDocument
              entry={previewEntry || entry}
              style={edition}
              theme={theme}
              design={{ ...design, pages: false }}
              size={16}
              ongoing
            />
          </div>
          <small>
            {previewEntry
              ? "Your story in this edition."
              : "A small visual sample. Writing voice is set separately."}
          </small>
        </section>
      )}
    </div>
  );
}
