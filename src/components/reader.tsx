"use client";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { readerFonts } from "@/lib/reader-fonts";
import { storyPdfFilename } from "@/lib/export-pdf";
import type { Exhibit } from "@/lib/archive";
import { storyText } from "@/lib/format";
import { Feedback } from "./feedback";
import { Modal } from "./vault-ui";
import { ExportOptions } from "./export-options";
import { exportFilename } from "@/lib/export-name";
import { api } from "@/lib/supabase";
import { Icon } from "./icon";

import { readerEditions as styles, editionGroups } from "@/lib/reader-editions";
import { StoryDocument } from "./story-document";
function EditionMark({ id, mark }: { id: string; mark: string }) {
  return id === "ancientcodex" ? <Icon name="book" /> : id === "captain" ? <Icon name="anchor" /> : <>{mark}</>;
}
function readPreferences() {
  try {
    return localStorage.getItem("lorekeeper-reader") ?? "";
  } catch {
    return "";
  }
}
function subscribeToPreferences(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("lorekeeper-preferences", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("lorekeeper-preferences", callback);
  };
}
export function Reader({
  entry,
  previous,
  collectionId,
  collectionName,
  next,
  favoriteControl,
  titleActions,
}: {
  entry: Exhibit;
  collectionId?: string;
  collectionName?: string;
  favoriteControl?: React.ReactNode;
  titleActions?: React.ReactNode;
  previous: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
}) {
  const saved = useSyncExternalStore(
    subscribeToPreferences,
    readPreferences,
    () => "",
  );
  const stored = useMemo(() => {
    try {
      const value = JSON.parse(saved || "{}");
      return {
        style: ["transcript", "monastic", "gothic", "charter"].includes(
          value.style,
        )
          ? "manuscript"
          : value.style === "pirate"
            ? "captain"
            : styles.some((s) => s.id === value.style)
              ? (value.style as string)
              : "glorious",
        size: [16, 18, 20, 22].includes(value.size)
          ? (value.size as number)
          : 18,
        plain: value.plain === true,
        showEmojis: value.showEmojis !== false,
        fonts:
          value.fonts && typeof value.fonts === "object"
            ? (value.fonts as Record<string, string>)
            : {},
      };
    } catch {
      return {
        style: "glorious",
        size: 18,
        plain: false,
        showEmojis: true,
        fonts: {} as Record<string, string>,
      };
    }
  }, [saved]);
  const [override, setOverride] = useState<typeof stored | null>(null);
  const { style, size, plain, showEmojis, fonts } = override ?? stored;
  const fontOptions = readerFonts(style);
  const selectedFont =
    fontOptions.find((font) => font.id === fonts[style]) ?? fontOptions[0];
  const [openMenu, setOpenMenu] = useState<"format" | "export" | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [copyingImage, setCopyingImage] = useState(false);
  const [imageDownload, setImageDownload] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (imageDownload) URL.revokeObjectURL(imageDownload);
    },
    [imageDownload],
  );
  useEffect(() => {
    if (!openMenu) return;
    const closeOutside = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node))
        setOpenMenu(null);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [openMenu]);
  const [expandedGroup, setExpandedGroup] = useState<string | null | undefined>(
    undefined,
  );
  const activeGroup = editionGroups.find((group) =>
    group.ids.includes(style),
  )!.name;
  const openGroup = expandedGroup === undefined ? activeGroup : expandedGroup;
  const [copyStatus, setCopyStatus] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [textDownload, setTextDownload] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pdfDownload, setPdfDownload] = useState<{
    url: string;
    filename: string;
    blob: Blob;
  } | null>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const maximizeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!maximized) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMaximized(false);
        maximizeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", escape);
    };
  }, [maximized]);
  async function exportPdf() {
    if (!documentRef.current || exporting) return;
    setExporting(true);
    setPdfDownload(null);
    setCopyStatus("Preparing your export…");
    try {
      const pickerWindow = window as typeof window & {
        showSaveFilePicker?: (options: {
          suggestedName: string;
          types: { description: string; accept: Record<string, string[]> }[];
        }) => Promise<{
          createWritable: () => Promise<{
            write: (data: Blob) => Promise<void>;
            close: () => Promise<void>;
          }>;
        }>;
      };
      const handle = pickerWindow.showSaveFilePicker
        ? await pickerWindow.showSaveFilePicker({
            suggestedName: storyPdfFilename(entry.title, theme.name),
            types: [
              {
                description: "PDF document",
                accept: { "application/pdf": [".pdf"] },
              },
            ],
          })
        : null;
      setCopyStatus("Preparing your PDF…");
      const { exportStoryPdf } = await import("@/lib/export-pdf");
      const download = await exportStoryPdf(
        documentRef.current,
        entry.title,
        theme.name,
      );
      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(download.blob);
        await writable.close();
        setCopyStatus("PDF saved.");
      } else {
        setPdfDownload(download);
        setCopyStatus(
          "Your browser does not support Save As. Your PDF is ready below.",
        );
      }
    } catch (error) {
      setCopyStatus(
        error instanceof DOMException && error.name === "AbortError"
          ? "PDF export cancelled."
          : "PDF export failed. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  }
  async function exportText() {
    if (!collectionId || exporting) return;
    setExporting(true);
    setTextDownload(null);
    try {
      const filename = exportFilename(entry.title, exportFormat);
      const picker = (
        window as typeof window & {
          showSaveFilePicker?: (opts: unknown) => Promise<{
            createWritable: () => Promise<{
              write: (blob: Blob) => Promise<void>;
              close: () => Promise<void>;
            }>;
          }>;
        }
      ).showSaveFilePicker;
      const handle = picker
        ? await picker.call(window, {
            suggestedName: filename,
            types: [
              {
                description:
                  exportFormat === "json"
                    ? "JSON archive"
                    : "Markdown document",
                accept: {
                  [exportFormat === "json"
                    ? "application/json"
                    : "text/markdown"]: ["." + exportFormat],
                },
              },
            ],
          })
        : null;
      const r = await api("export", {
        collection: collectionId,
        entry: entry.id,
        format: exportFormat,
      });
      const blob = new Blob([r.content], {
        type: exportFormat === "json" ? "application/json" : "text/markdown",
      });
      if (handle) {
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        setExportOpen(false);
        setCopyStatus("Story saved.");
      } else
        setTextDownload({ url: URL.createObjectURL(blob), name: filename });
    } catch (error) {
      setCopyStatus(
        error instanceof DOMException && error.name === "AbortError"
          ? "Export cancelled."
          : "Export failed. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  }
  useEffect(
    () => () => {
      if (textDownload) URL.revokeObjectURL(textDownload.url);
    },
    [textDownload],
  );
  async function copyImage() {
    if (!documentRef.current || copyingImage) return;
    const element = documentRef.current;
    setCopyingImage(true);
    setImageDownload(null);
    setCopyStatus("Preparing image…");
    const rendering = import("@/lib/export-pdf")
      .then((module) => module.exportStoryImage(element))
      .then((result) => result.blob);
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
        throw new Error("Image clipboard unavailable");
      // Register the promise while the click still provides user activation.
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": rendering }),
      ]);
      setCopyStatus("Entry copied as an image.");
    } catch {
      try {
        setImageDownload(URL.createObjectURL(await rendering));
        setCopyStatus(
          "Your browser could not copy the image. Download it below instead.",
        );
      } catch {
        setCopyStatus("Image rendering failed. Please try again.");
      }
    } finally {
      setCopyingImage(false);
    }
  }
  function preferences(
    newStyle: string,
    newSize = size,
    newPlain = plain,
    newShowEmojis = showEmojis,
    newFonts = fonts,
  ) {
    setPdfDownload(null);
    setImageDownload(null);
    const value = {
      style: newStyle,
      size: newSize,
      plain: newPlain,
      showEmojis: newShowEmojis,
      fonts: newFonts,
    };
    setOverride(value);
    try {
      localStorage.setItem("lorekeeper-reader", JSON.stringify(value));
      window.dispatchEvent(new Event("lorekeeper-preferences"));
    } catch {
      /* Preferences still work when storage is disabled. */
    }
  }
  useEffect(() => {
    if (!copyStatus || /PDF/i.test(copyStatus)) return;
    const timeout = setTimeout(() => setCopyStatus(""), 4000);
    return () => clearTimeout(timeout);
  }, [copyStatus]);
  async function copy(attributed = false) {
    const text = storyText(entry, attributed);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(
        attributed
          ? "Conversation copied with author and date."
          : "Original message text copied.",
      );
    } catch {
      setFallback(text);
      setCopyStatus("Select the text below and copy it manually.");
    }
  }
  async function shareLink() {
    const url = `${window.location.origin}/stories/${entry.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("Story link copied.");
    } catch {
      setFallback(url);
      setCopyStatus("Copy the story link below.");
    }
  }
  const reference = String(entry.number).padStart(3, "0");
  const theme = styles.find((s) => s.id === style)!;
  const recommended =
    styles.find((s) => s.id === entry.recommended) ??
    styles.find((s) => s.id === "glorious")!;
  return (
    <main
      id="main"
      className={`reader-page ${maximized ? "reader-maximized" : ""}`}
    >
      <header className="reader-heading">
        <nav className="eyebrow entry-breadcrumb" aria-label="Breadcrumb">
          <Link
            href={
              collectionId ? `/collections/${collectionId}#collection` : "/"
            }
          >
            {collectionName || "THE COLLECTION"}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">EXHIBIT {reference}</span>
        </nav>
        <div className="v-reader-title">
          <h1>{entry.title}</h1>
          {titleActions}
        </div>
        <div className="reader-meta">
          <span className="avatar-pair">
            {entry.authors.map((a) => (
              <span key={a} className={`avatar ${a === "Liri" ? "liri" : ""}`}>
                {a[0]}
              </span>
            ))}
          </span>
          <span>{entry.authors.join(" & ")}</span>
          <span>·</span>
          <span>{entry.date}</span>
          <span>·</span>
          <span>{entry.minutes} min read</span>
          <span>·</span>
          <span>
            {entry.source === "whatsapp"
              ? "WhatsApp"
              : entry.source === "teams"
                ? "Microsoft Teams"
                : entry.source}
          </span>
          {favoriteControl}
        </div>
      </header>
      <div className="reader-layout">
        <aside className="reader-sidebar">
          <div className="eyebrow">DRESS THE LEGEND</div>
          <h2>
            A change of <em>atmosphere.</em>
          </h2>
          <p>Same words. Different worlds.</p>
          <div
            className="style-picker"
            role="group"
            aria-label="Story presentation"
          >
            <div className="selected-edition">
              <EditionMark id={theme.id} mark={theme.mark} /> {theme.name}
            </div>
            {editionGroups.map((group, groupIndex) => (
              <div className="edition-group" key={group.name}>
                <button
                  className="edition-group-toggle"
                  aria-expanded={openGroup === group.name}
                  aria-controls={`edition-group-${groupIndex}`}
                  onClick={() =>
                    setExpandedGroup(
                      openGroup === group.name ? null : group.name,
                    )
                  }
                >
                  <span>{group.name}</span>
                  <span aria-hidden="true">
                    {openGroup === group.name ? "−" : "+"}
                  </span>
                </button>
                <div
                  id={`edition-group-${groupIndex}`}
                  hidden={openGroup !== group.name}
                >
                  {styles
                    .filter((s) => group.ids.includes(s.id))
                    .sort(
                      (a, b) =>
                        group.ids.indexOf(a.id) - group.ids.indexOf(b.id),
                    )
                    .map((s) => (
                      <button
                        key={s.id}
                        aria-pressed={style === s.id}
                        className={style === s.id ? "active" : ""}
                        onClick={() => preferences(s.id)}
                      >
                        <span className="style-mark" aria-hidden="true">
                          <EditionMark id={s.id} mark={s.mark} />
                        </span>
                        <span>{s.name}</span>
                        {style === s.id && (
                          <span className="style-active-dot" />
                        )}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
          <div className="recommended">
            <span className="eyebrow">CURATOR’S SUGGESTION</span>
            <button onClick={() => preferences(recommended.id)}>
              <EditionMark id={recommended.id} mark={recommended.mark} />{" "}
              {recommended.name} <span>↗</span>
            </button>
          </div>
        </aside>
        <div className="reader-main">
          <div className="reader-toolbar" ref={toolbarRef}>
            <div>
              <span aria-hidden="true">
                <EditionMark id={theme.id} mark={theme.mark} />
              </span>{" "}
              {theme.name}
            </div>
            <div className="copy-actions">
              {maximized && (
                <Link
                  href={
                    collectionId
                      ? `/collections/${collectionId}#collection`
                      : "/"
                  }
                  className="maximized-hall-link"
                >
                  ← Back to the Hall
                </Link>
              )}
              <button
                ref={maximizeRef}
                onClick={() => setMaximized((value) => !value)}
                aria-pressed={maximized}
              >
                {maximized ? "↙ Restore" : "↗ Maximize"}
              </button>
              <div className="toolbar-menu">
                <button
                  aria-expanded={openMenu === "format"}
                  aria-controls="format-panel"
                  onClick={() =>
                    setOpenMenu(openMenu === "format" ? null : "format")
                  }
                >
                  <Icon name="format" />
                  Format
                </button>
                {openMenu === "format" && (
                  <div
                    id="format-panel"
                    className="toolbar-panel"
                    role="group"
                    aria-label="Formatting options"
                  >
                    <label className="format-check">
                      <span>Show emojis</span>
                      <input
                        type="checkbox"
                        checked={showEmojis}
                        onChange={(e) =>
                          preferences(style, size, plain, e.target.checked)
                        }
                      />
                    </label>
                    <label className="format-check">
                      <span>Show formatted text</span>
                      <input
                        type="checkbox"
                        checked={!plain}
                        onChange={(e) =>
                          preferences(style, size, !e.target.checked)
                        }
                      />
                    </label>
                    <div className="format-size">
                      <span>Font size</span>
                      <div className="size-controls">
                        <button
                          aria-label="Decrease text size"
                          disabled={size === 16}
                          onClick={() => preferences(style, size - 2)}
                        >
                          A−
                        </button>
                        <span>{size}px</span>
                        <button
                          aria-label="Increase text size"
                          disabled={size === 22}
                          onClick={() => preferences(style, size + 2)}
                        >
                          A+
                        </button>
                      </div>
                    </div>
                    <label className="format-font" htmlFor="reader-font">
                      Font
                      <select
                        id="reader-font"
                        value={selectedFont.id}
                        onChange={(e) =>
                          preferences(style, size, plain, showEmojis, {
                            ...fonts,
                            [style]: e.target.value,
                          })
                        }
                      >
                        {fontOptions.map((font) => (
                          <option key={font.id} value={font.id}>
                            {font.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
              <div className="toolbar-menu">
                <button
                  onClick={() => {
                    setOpenMenu(null);
                    setExportOpen(true);
                    setPdfDownload(null);
                    setTextDownload(null);
                  }}
                >
                  <Icon name="export" />
                  Export
                </button>
              </div>
            </div>
          </div>
          {copyStatus ? (
            <Feedback
              onDismiss={() => {
                setCopyStatus("");
                setImageDownload(null);
              }}
            >
              {copyStatus}
              {imageDownload && (
                <a
                  className="pdf-download"
                  href={imageDownload}
                  download={exportFilename(entry.title, "png", theme.name)}
                >
                  Save image
                </a>
              )}
            </Feedback>
          ) : (
            <p className="copy-status">{theme.description}</p>
          )}
          <Modal
            open={exportOpen}
            title="Take the legend with you"
            onClose={() => {
              if (!exporting) setExportOpen(false);
            }}
          >
            <p className="v-muted">
              Choose your edition. This story is included.
            </p>
            {copyStatus && (
              <Feedback onDismiss={() => setCopyStatus("")}>
                {copyStatus}
              </Feedback>
            )}
            <ExportOptions
              formats={collectionId ? ["pdf", "json", "md"] : ["pdf"]}
              format={exportFormat}
              onFormat={(f) => {
                setExportFormat(f);
                setPdfDownload(null);
                setTextDownload(null);
              }}
              busy={exporting}
              onExport={() =>
                void (exportFormat === "pdf" ? exportPdf() : exportText())
              }
              onCancel={() => setExportOpen(false)}
              download={
                exportFormat === "pdf" && pdfDownload
                  ? { url: pdfDownload.url, name: pdfDownload.filename }
                  : textDownload
              }
            />
            <div className="v-export-extras">
              <button className="v-button" onClick={() => void copy()}>
                <Icon name="copy" />
                Copy text
              </button>
              <button
                className="v-button"
                onClick={() => void copyImage()}
                disabled={copyingImage}
              >
                {copyingImage ? "Preparing image…" : "Copy image"}
              </button>
              {entry.messages.length > 1 && (
                <button className="v-button" onClick={() => void copy(true)}>
                  Copy transcript
                </button>
              )}
              <button className="v-button" onClick={() => void shareLink()}>
                <Icon name="link" />
                Copy link
              </button>
            </div>
          </Modal>
          {fallback !== null && (
            <div className="copy-fallback">
              <label htmlFor="manual-copy">Copy manually (Ctrl+C)</label>
              <textarea
                id="manual-copy"
                value={fallback}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <button onClick={() => setFallback(null)}>Close</button>
            </div>
          )}
          <div ref={documentRef} className={`edition-stage stage-${style}`}>
            {style === "scroll" && (
              <>
                <span
                  className="scroll-spindle spindle-top"
                  aria-hidden="true"
                />
                <span
                  className="scroll-spindle spindle-bottom"
                  aria-hidden="true"
                />
              </>
            )}
            <StoryDocument
              entry={entry}
              style={style}
              theme={theme}
              size={size}
              plain={plain}
              showEmojis={showEmojis}
              font={selectedFont.id}
            />
          </div>
          <details className="curator-note">
            <summary>
              Why this made the hall <span>+</span>
            </summary>
            <p>{entry.reason}</p>
            <span>Archive rating: {entry.score.toFixed(1)} / 10</span>
          </details>
          <nav className="reader-pagination" aria-label="Adjacent stories">
            {previous ? (
              <Link href={`/stories/${previous.id}`} prefetch={false}>
                <small>← PREVIOUS LEGEND</small>
                <span>{previous.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/stories/${next.id}`} prefetch={false}>
                <small>NEXT LEGEND →</small>
                <span>{next.title}</span>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </div>
      </div>
    </main>
  );
}
