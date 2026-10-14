"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Modal } from "./vault-ui";
import { Icon } from "./icon";
import type { Exhibit } from "@/lib/archive";
import type { EditionDesign } from "@/lib/edition-design";
import { readerEditions } from "@/lib/reader-editions";
import { playApi } from "@/lib/play-client";
import { exportFilename } from "@/lib/export-name";
import { StoryDocument } from "./story-document";
export function PlayExport({
  id,
  title,
  entry,
  edition,
  design,
  content,
  interactions,
  onInteractions,
  onClose,
  kind = "adventure",
  messageIds,
  hiddenDecisions,
  initialFormat,
}: {
  id: string;
  title: string;
  entry: Exhibit;
  edition: string;
  design: EditionDesign;
  content: string;
  interactions: boolean;
  onInteractions: (v: boolean) => void;
  onClose: () => void;
  kind?: string;
  messageIds?: string[];
  hiddenDecisions?: string[];
  initialFormat?: string;
}) {
  const [format, setFormat] = useState(initialFormat || "md"),
    [collections, setCollections] = useState<{ id: string; name: string }[]>(
      [],
    ),
    [collection, setCollection] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [savedId, setSavedId] = useState("");
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState("");
  useEffect(() => {
    let alive = true;
    playApi("home")
      .then((r) => {
        if (alive) {
          setCollections(r.collections);
          setCollection(r.collections[0]?.id || "");
        }
      })
      .catch((e) => {
        if (alive) setMessage(e.message);
      });
    return () => {
      alive = false;
      controller.current?.abort();
    };
  }, []);
  const theme =
    readerEditions.find((e) => e.id === edition) || readerEditions[0];
  async function save() {
    setBusy(true);
    setMessage("");
    setProgress("");
    try {
      if (format === "collection") {
        const r = await playApi("exportCollection", {
          id,
          kind,
          messageIds,
          hiddenDecisions,
          collection,
          interactions,
        });
        setSavedId(r.id);
        setMessage("Saved to your collection.");
      } else {
        let blob: Blob, filename: string;
        if (format === "pdf") {
          controller.current = new AbortController();
          const { exportCollectionPdf } = await import(
            "@/lib/export-collection-pdf"
          );
          const result = await exportCollectionPdf({
            signal: controller.current.signal,
            onProgress: (r) => setProgress(`${r.pages} pages prepared`),
            name: title,
            entries: [entry],
            edition,
            font: design.font,
            design: {
              ...design,
              pages: true,
              cover: edition,
              endPage: edition,
              showCover: false,
            },
          });
          blob = result.blob;
          filename = exportFilename(title, "pdf", edition);
        } else {
          blob = new Blob([`# ${title}\n\n${content}\n`], {
            type: "text/markdown;charset=utf-8",
          });
          filename = exportFilename(title, "md");
        }
        const url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        setMessage("Export downloaded.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title={kind === "chat" ? "Keep this conversation" : "Keep this story"}
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="lk-form lk-export-form">
        <p className="lk-hint">
          Choose a destination and what to include. Your original{" "}
          {kind === "chat" ? "conversation" : "adventure"} stays saved.
        </p>
        <fieldset className="lk-export-destinations">
          <legend>Destination</legend>
          {[
            ["md", "scroll", "Markdown", "A readable .md file"],
            ["pdf", "book", "PDF", "Your chosen edition"],
            ["collection", "grid", "Collection", "Save in LoreKeeper"],
          ].map(([id, icon, label, description]) => (
            <button
              type="button"
              key={id}
              disabled={busy}
              aria-pressed={format === id}
              onClick={() => setFormat(id)}
            >
              <Icon name={icon as "scroll" | "book" | "grid"} />
              <strong>{label}</strong>
              <small>{description}</small>
            </button>
          ))}
        </fieldset>
        <label className="lk-check">
          <input
            type="checkbox"
            checked={interactions}
            disabled={busy}
            onChange={(e) => onInteractions(e.target.checked)}
          />
          {kind === "chat"
            ? "Include original messages"
            : "Include questions and player decisions"}
        </label>
        {format === "collection" && (
          <label>
            Save into
            <select
              value={collection}
              disabled={busy}
              onChange={(e) => setCollection(e.target.value)}
            >
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {!collections.length && (
              <small>Create a collection before saving a copy here.</small>
            )}
          </label>
        )}
        {format === "pdf" && (
          <>
            <div className="lk-export-edition">
              <span>{theme.mark}</span>
              <div>
                <strong>{theme.name}</strong>
                <small>
                  Your story’s display and customization are used in this PDF.
                </small>
              </div>
            </div>
            <div className="lk-export-preview">
              <StoryDocument
                entry={entry}
                style={edition}
                theme={theme}
                design={{ ...design, pages: false }}
                size={16}
              />
            </div>
          </>
        )}
        {message && (
          <p className="lk-notice" role="status">
            {message}
          </p>
        )}
        {savedId && (
          <Link className="lk-text-button" href={`/stories/${savedId}`}>
            Open saved story <Icon name="arrow" />
          </Link>
        )}
        <div className="lk-dialog-actions">
          {busy && (
            <>
              <span className="lk-hint" role="status">
                {progress || "Preparing your export…"}
              </span>
              <button
                className="lk-button"
                onClick={() => controller.current?.abort()}
                disabled={format !== "pdf"}
              >
                Cancel
              </button>
            </>
          )}
          <button
            className="lk-button is-primary"
            disabled={
              busy || !content || (format === "collection" && !collection)
            }
            onClick={() => void save()}
          >
            {busy
              ? "Preparing…"
              : format === "collection"
                ? "Save to collection"
                : "Download"}
            <Icon name="export" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
