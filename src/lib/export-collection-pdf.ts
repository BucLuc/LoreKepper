import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { Exhibit } from "./archive";
import { StoryDocument } from "../components/story-document";
import { CollectionBookend } from "../components/collection-bookend";
import { readerEditions } from "./reader-editions";
import { readerFonts, editionTitleFonts } from "./reader-fonts";
import { pdfEditions, A4_MM } from "./pdf-editions";
import { contentUnits, appendUnit, fitsPage, remainingHeight, splitToFit, normalizePdfArtwork, type PdfUnit, type LaidOutPage } from "./pdf-pagination";
import { exportFilename } from "./export-name";
export type CollectionPdfOptions = {
  name: string;
  entries: Exhibit[];
  edition: string;
  font: string;
  signal?: AbortSignal;
  onProgress?: (progress: {
    story: number;
    total: number;
    pages: number;
    label: string;
  }) => void;
};
const paperColors: Record<string, string> = { ancientcodex: "#ddc69a", manuscript: "#eadbb4", scroll: "#d9c89f", decree: "#e6d5af", glorious: "#19231d", poetry: "#e8dcc2", prophecy: "#242438", captain: "#d9c59b", tavern: "#d9c49a", wanted: "#dfcba4", light: "#ffffff", dark: "#171c23", newspaper: "#e8e5d4", social: "#f1f4f8", news: "#f5f5f2", incident: "#fafbf9", card: "#24272d", terminal: "#0c1712", space: "#0b2029", bug: "#202535", screenplay: "#fcfcf8", dossier: "#ddd8bb", museum: "#dbdccf", court: "#fafaf6", academic: "#fffefb", letter: "#faf8ef", lyrics: "#e8ddc3" };
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function checkAbort(signal?: AbortSignal) { if (signal?.aborted)
  throw new DOMException("Export cancelled", "AbortError"); }
async function ready(element: HTMLElement, signal?: AbortSignal) {
  checkAbort(signal);
  await document.fonts.ready;
  await Promise.all(Array.from(element.querySelectorAll("img")).map(async (image) => { try {
    const url = new URL(image.src, location.href);
    if (/^https?:$/.test(url.protocol) && url.origin !== location.origin)
      image.crossOrigin = "anonymous";
    await image.decode();
  }
  catch {
    const note = document.createElement("span");
    note.className = "pdf-image-unavailable";
    note.textContent = `Image unavailable: ${image.alt || "illustration"}`;
    image.replaceWith(note);
  } }));
  checkAbort(signal);
}
function setPaper(root: HTMLElement, style: string) { root.style.setProperty("--pdf-page-bg", paperColors[style]); root.style.backgroundColor = paperColors[style]; }
function makePage(source: HTMLElement, slot: HTMLElement, title: string, continuation: boolean, pageNumber: number): LaidOutPage {
  const element = source.cloneNode(false) as HTMLElement;
  element.classList.remove("pdf-source");
  element.classList.add("pdf-sheet", "pdf-initials-ready");
  element.removeAttribute("id");
  const flow = document.createElement("div");
  flow.className = "pdf-flow";
  if (continuation) {
    const running = document.createElement("div");
    running.className = "pdf-continuation-head";
    const name = document.createElement("span");
    name.textContent = title;
    const suffix = document.createElement("i");
    suffix.textContent = "continued";
    running.append(name, suffix);
    flow.append(running);
  }
  const body = document.createElement("div");
  body.className = "document-body pdf-body";
  flow.append(body);
  element.append(flow);
  const footer = document.createElement("div");
  footer.className = "pdf-page-number";
  footer.textContent = String(pageNumber);
  element.append(footer);
  slot.append(element);
  return { element, flow, body, wrappers: new Map(), units: 0 };
}
function fitWidePre(element: HTMLElement) { for (const pre of element.querySelectorAll<HTMLElement>("pre")) {
  if (!pre.matches(".ascii-art"))
    continue;
  const width = pre.clientWidth;
  const content = pre.scrollWidth;
  if (content > width && width > 0) {
    pre.style.fontSize = `${parseFloat(getComputedStyle(pre).fontSize) * width / content}px`;
  }
} }
function fitTitle(element: HTMLElement, fits: () => boolean) { const title = element.querySelector<HTMLElement>(".document-header h2"); if (!title)
  return; let size = parseFloat(getComputedStyle(title).fontSize); while (!fits() && size > 18) {
  size -= 2;
  title.style.setProperty("font-size", `${size}px`, "important");
} }
export async function paginateStory(source: HTMLElement, slot: HTMLElement, startPage: number, onPage: (page: HTMLElement) => Promise<void>, signal?: AbortSignal) {
  const originalBody = source.querySelector<HTMLElement>(":scope > .document-body");
  if (!originalBody)
    throw new Error("Story body is missing.");
  const children = Array.from(source.children) as HTMLElement[], bodyIndex = children.indexOf(originalBody);
  const decoration = children.slice(0, bodyIndex).filter(n => getComputedStyle(n).position === "absolute");
  const opening = children.slice(0, bodyIndex).filter(n => !decoration.includes(n));
  const ending = children.slice(bodyIndex + 1).filter(n => getComputedStyle(n).display !== "none");
  const bodyUnits = contentUnits(originalBody);
  if (ending.length && bodyUnits.length)
    bodyUnits[bodyUnits.length - 1].keepNext = true;
  const queue: PdfUnit[] = [...bodyUnits, ...ending.map(node => ({ node, wrappers: [], keepNext: false }))];
  let count = 0;
  let page = makePage(source, slot, source.querySelector(".document-header h2")?.textContent ?? "Story", false, startPage);
  for (const art of decoration)
    page.element.prepend(art.cloneNode(true));
  for (const header of opening)
    page.flow.insertBefore(header.cloneNode(true), page.body);
  fitTitle(page.element, () => remainingHeight(page) >= 190);
  async function nextPage() { checkAbort(signal); await onPage(page.element); page.element.remove(); count++; page = makePage(source, slot, source.querySelector(".document-header h2")?.textContent ?? "Story", true, startPage + count); for (const art of decoration)
    page.element.prepend(art.cloneNode(true)); await pause(); }
  if (!fitsPage(page))
    throw new Error("The story opening exceeds A4. Choose a different edition or shorten the story title.");
  for (let i = 0; i < queue.length; i++) {
    checkAbort(signal);
    let unit = queue[i];
    if (unit.keepNext && page.units && remainingHeight(page) < 95)
      await nextPage();
    let candidate = appendUnit(page, unit);
    fitWidePre(candidate.copy);
    if (fitsPage(page)) {
      // Measure the following block too, so headings and closing signatures cannot
      // be stranded on their own. A long paragraph only needs its opening lines.
      const following = queue[i + 1];
      if (unit.keepNext && following && page.units) {
        let preview = following.node;
        if (preview.matches("p,li,pre")) {
          const fragment = preview.cloneNode(true) as HTMLElement;
          fragment.style.maxHeight = "3.3em";
          fragment.style.overflow = "hidden";
          preview = fragment;
        }
        const next = appendUnit(page, following, preview);
        const together = fitsPage(page);
        next.undo();
        if (!together) {
          candidate.undo();
          await nextPage();
          candidate = appendUnit(page, unit);
        }
      }
      if (fitsPage(page)) {
        page.units++;
        continue;
      }
    }
    candidate.undo();
    const split = splitToFit(page, unit);
    if (split) {
      appendUnit(page, unit, split[0]);
      page.units++;
      await nextPage();
      unit = { ...unit, node: split[1], keepNext: false };
      queue.splice(i + 1, 0, unit);
      continue;
    }
    if (page.units || page.flow.children.length > 1) {
      await nextPage();
      candidate = appendUnit(page, unit);
      fitWidePre(candidate.copy);
      if (fitsPage(page)) {
        page.units++;
        continue;
      }
      candidate.undo();
      const freshSplit = splitToFit(page, unit);
      if (freshSplit) {
        appendUnit(page, unit, freshSplit[0]);
        page.units++;
        await nextPage();
        queue.splice(i + 1, 0, { ...unit, node: freshSplit[1], keepNext: false });
        continue;
      }
    }
    // Tall images are scaled proportionally; large artwork is never cropped between pages.
    candidate = appendUnit(page, unit);
    const images = candidate.copy.matches("img,svg") ? [candidate.copy] : Array.from(candidate.copy.querySelectorAll<HTMLElement>("img,svg"));
    for (const image of images) {
      image.style.maxHeight = "190mm";
      image.style.maxWidth = "100%";
      image.style.objectFit = "contain";
    }
    if (!fitsPage(page)) {
      candidate.undo();
      throw new Error(`A block in “${source.querySelector("h2")?.textContent ?? "this story"}” is too large for A4.`);
    }
    page.units++;
  }
  await onPage(page.element);
  page.element.remove();
  return count + 1;
}
export async function exportCollectionPdf(options: CollectionPdfOptions) {
  const { name, entries, edition, font, signal, onProgress } = options;
  if (!entries.length)
    throw new Error("This collection has no stories to export.");
  const theme = readerEditions.find(e => e.id === edition);
  if (!theme || !pdfEditions[edition])
    throw new Error("Choose a valid display edition.");
  const chosenFace = readerFonts(edition).find(f => f.id === font);
  if (!chosenFace)
    throw new Error("Choose a font for this display edition.");
  const face = chosenFace;
  checkAbort(signal);
  const { jsPDF } = await import("jspdf");
  const { default: capture } = await import("html2canvas-pro");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  pdf.setProperties({ title: name, subject: `Complete collection · ${theme.name} · ${face.name}`, creator: "LoreKeeper" });
  const host = document.createElement("div");
  host.className = "collection-pdf-host";
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("inert", "");
  host.style.cssText = "position:absolute;left:-12000px;top:0;width:210mm;pointer-events:none;";
  const sourceSlot = document.createElement("div"), pageSlot = document.createElement("div");
  host.append(sourceSlot, pageSlot);
  document.body.append(host);
  const root = createRoot(sourceSlot);
  let pages = 0;
  const report = (story: number, label: string) => onProgress?.({ story, total: entries.length, pages, label });
  async function addPage(element: HTMLElement, existing?: number) {
    checkAbort(signal);
    await ready(element, signal);
    normalizeSvg(element);
    if (element.scrollHeight > element.clientHeight + 1)
      throw new Error("A PDF page exceeds A4 height.");
    const width = Math.ceil(element.getBoundingClientRect().width), height = Math.ceil(element.getBoundingClientRect().height);
    const canvas = await capture(element, { scale: 2, width, height, backgroundColor: paperColors[edition], useCORS: true, logging: false, scrollX: 0, scrollY: 0 });
    checkAbort(signal);
    if (existing)
      pdf.setPage(existing);
    else {
      if (pages)
        pdf.addPage("a4", "portrait");
      pages++;
    }
    pdf.setFillColor(paperColors[edition]);
    pdf.rect(0, 0, A4_MM.width, A4_MM.height, "F");
    pdf.addImage(canvas.toDataURL("image/jpeg", .96), "JPEG", 0, 0, A4_MM.width, A4_MM.height, undefined, "FAST");
    canvas.width = 0;
    canvas.height = 0;
  }
  function mount(node: ReturnType<typeof createElement>) { flushSync(() => root.render(node)); const article = sourceSlot.querySelector<HTMLElement>(".story-document")!; setPaper(article, edition); return article; }
  async function bookend(end: boolean) { const article = mount(createElement(CollectionBookend, { name, count: entries.length, style: edition, font, end })); await ready(article, signal); const copy = article.cloneNode(true) as HTMLElement; copy.classList.add("pdf-sheet"); pageSlot.append(copy); fitTitle(copy, () => copy.scrollHeight <= copy.clientHeight + 1); await addPage(copy); copy.remove(); }
  try {
    report(0, "Preparing cover");
    await bookend(false);
    // Reserve contents pages, then fill their page references after story pagination.
    const contents: HTMLElement[] = [];
    let toc = contentsPage();
    contents.push(toc);
    const rows: {
      node: HTMLElement;
      entry: Exhibit;
      start?: number;
    }[] = [];
    function contentsPage() { const article = document.createElement("article"); article.className = `story-document theme-${edition} pdf-print-document pdf-sheet pdf-contents`; article.dataset.font = font; article.style.setProperty("--reader-font", face.family); article.style.setProperty("--edition-title-font", editionTitleFonts[edition]); setPaper(article, edition); article.innerHTML = '<div class="pdf-flow"><div class="document-header"><h2>Contents</h2></div><ol class="pdf-contents-list"></ol></div>'; pageSlot.append(article); return article; }
    for (const entry of entries) {
      const row = document.createElement("li");
      const title = document.createElement("span");
      title.textContent = entry.title;
      const number = document.createElement("b");
      number.textContent = "0000";
      row.append(title, number);
      toc.querySelector("ol")!.append(row);
      const flow = toc.querySelector<HTMLElement>(".pdf-flow")!;
      if (flow.scrollHeight > flow.clientHeight) {
        row.remove();
        toc = contentsPage();
        contents.push(toc);
        toc.querySelector("ol")!.append(row);
      }
      rows.push({ node: row, entry });
    }
    for (let i = 0; i < contents.length; i++) {
      pdf.addPage("a4", "portrait");
      pages++;
    }
    for (let index = 0; index < entries.length; index++) {
      checkAbort(signal);
      const entry = entries[index];
      report(index + 1, entry.title);
      rows[index].start = pages + 1;
      const article = mount(createElement(StoryDocument, { entry, style: edition, theme, font, size: 16 }));
      article.classList.add("pdf-print-document", "pdf-source");
      await ready(article, signal);
      normalizePdfArtwork(article);
      fitWidePre(article);
      await paginateStory(article, pageSlot, pages + 1, async (page) => { await addPage(page); report(index + 1, entry.title); await pause(); }, signal);
      pdf.outline.add(null, entry.title, { pageNumber: rows[index].start! });
    }
    report(entries.length, "Preparing end page");
    await bookend(true);
    for (let i = 0; i < contents.length; i++) {
      const page = contents[i];
      for (const row of rows.filter(r => r.node.closest(".pdf-contents") === page))
        row.node.querySelector("b")!.textContent = String(row.start);
      await addPage(page, i + 2);
      const pageBounds = page.getBoundingClientRect();
      for (const row of rows.filter(r => r.node.closest(".pdf-contents") === page)) {
        const rect = row.node.getBoundingClientRect();
        pdf.link((rect.left - pageBounds.left) * 210 / pageBounds.width, (rect.top - pageBounds.top) * 297 / pageBounds.height, rect.width * 210 / pageBounds.width, rect.height * 297 / pageBounds.height, { pageNumber: row.start! });
      }
      page.remove();
    }
    checkAbort(signal);
    return { blob: pdf.output("blob"), filename: exportFilename(name, "pdf", theme.name), pages, storyPages: rows.map(r => ({ title: r.entry.title, page: r.start! })) };
  }
  finally {
    root.unmount();
    host.remove();
  }
}
function normalizeSvg(element: HTMLElement) { element.querySelectorAll<SVGSVGElement>("svg").forEach(svg => { const ink = getComputedStyle(svg).color; svg.querySelectorAll("[fill='currentColor'],[stroke='currentColor']").forEach(shape => { if (shape.getAttribute("fill") === "currentColor")
  shape.setAttribute("fill", ink); if (shape.getAttribute("stroke") === "currentColor")
  shape.setAttribute("stroke", ink); }); }); }
