// Render one page at a time to avoid browser canvas limits on long stories.
async function withStoryClone<T>(
  element: HTMLElement,
  render: (clone: HTMLElement) => Promise<T>,
) {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:absolute;left:-10000px;top:0;width:900px;pointer-events:none;";
  const clone = element.cloneNode(true) as HTMLElement;
  host.append(clone);
  document.body.append(host);
  try {
    await document.fonts.ready;
    // Standalone SVG images need explicit ink colours; inherited currentColor
    // and CSS drop-shadow filters can disappear during canvas serialization.
    clone.querySelectorAll<SVGSVGElement>("svg").forEach((svg) => {
      const ink = getComputedStyle(svg).color;
      svg.style.color = ink;
      svg
        .querySelectorAll("[fill='currentColor'], [stroke='currentColor']")
        .forEach((shape) => {
          if (shape.getAttribute("fill") === "currentColor")
            shape.setAttribute("fill", ink);
          if (shape.getAttribute("stroke") === "currentColor")
            shape.setAttribute("stroke", ink);
        });
    });
    clone
      .querySelectorAll<HTMLElement>(".document-ornament")
      .forEach((ornament) => {
        ornament.style.filter = "none";
      });
    // Canvas renderers do not reliably paint ::first-letter decorations.
    // Materialize the illuminated initial in this temporary export only.
    if (
      clone.querySelector(
        ".theme-manuscript, .theme-scroll, .theme-decree, .theme-glorious",
      )
    ) {
      clone
        .querySelectorAll<HTMLElement>(".message-prose > p:first-child")
        .forEach((paragraph) => {
          const walker = document.createTreeWalker(
            paragraph,
            NodeFilter.SHOW_TEXT,
          );
          const first = walker.nextNode();
          if (!first?.textContent?.trim()) return;
          const letter = document.createElement("span");
          const appearance = getComputedStyle(paragraph, "::first-letter");
          for (const property of [
            "font-family",
            "font-size",
            "font-weight",
            "font-style",
            "line-height",
            "color",
            "float",
            "padding",
            "margin",
            "border",
            "background",
            "box-shadow",
            "text-shadow",
          ]) {
            letter.style.setProperty(
              property,
              appearance.getPropertyValue(property),
            );
          }
          letter.textContent = first.textContent.slice(0, 1);
          first.textContent = first.textContent.slice(1);
          first.parentNode?.insertBefore(letter, first);
        });
      host.classList.add("pdf-export");
    }
    // Preserve wide ASCII art without exporting only its visible scroll area.
    clone.querySelectorAll<HTMLElement>(".message-text").forEach((text) => {
      let size = parseFloat(getComputedStyle(text).fontSize);
      while (text.scrollWidth > text.clientWidth + 1 && size > 5) {
        text.style.fontSize = `${--size}px`;
      }
    });
    return await render(clone);
  } finally {
    host.remove();
  }
}

type StoryPage = { image: Uint8Array; width: number; height: number };

function backdrop(element: HTMLElement) {
  const article = element.querySelector(".story-document") ?? element;
  const color = getComputedStyle(article).backgroundColor;
  if (color !== "rgba(0, 0, 0, 0)") return color;
  return article.matches(".theme-manuscript,.theme-scroll,.theme-decree,.theme-poetry,.theme-captain,.theme-tavern,.theme-wanted") ? "#d4c49d" : "#171c15";
}

async function captureStory(element: HTMLElement, y = 0, height = Math.ceil(element.getBoundingClientRect().height)) {
  const { default: capture } = await import("html2canvas-pro");
  const width = Math.ceil(element.getBoundingClientRect().width);
  const scale = Math.min(2, 16000 / height, 16000 / width, Math.sqrt(40_000_000 / (width * height)));
  return capture(element, { scale, backgroundColor: backdrop(element), useCORS: true, logging: false, y, width, height });
}

export async function exportStoryImage(element: HTMLElement) {
  return withStoryClone(element, async clone => {
    const canvas = await captureStory(clone);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image encoding failed")), "image/png"));
    return { blob, width: canvas.width, height: canvas.height };
  });
}

export function storyPdfFilename(title: string, edition: string) {
  const filename = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim().slice(0, 100) || "LoreKeeper";
  return `${filename} — ${edition}.pdf`;
}

export async function createStoryPdf(pages: StoryPage[], title: string, edition: string) {
  const { jsPDF } = await import("jspdf");
  const dimensions = (page: StoryPage): [number, number] => [210, page.height * 210 / page.width];
  const pdf = new jsPDF({ unit: "mm", format: dimensions(pages[0]), orientation: pages[0].height < pages[0].width ? "landscape" : "portrait", compress: true });
  pdf.setProperties({ title, subject: `${edition} edition`, creator: "LoreKeeper" });
  pages.forEach((page, index) => {
    const size = dimensions(page);
    if (index) pdf.addPage(size, page.height < page.width ? "landscape" : "portrait");
    pdf.addImage(page.image, "PNG", 0, 0, size[0], size[1], undefined, "FAST");
  });
  return { blob: pdf.output("blob"), url: pdf.output("datauristring"), filename: storyPdfFilename(title, edition) };
}

export async function exportStoryPdf(element: HTMLElement, title: string, edition: string) {
  return withStoryClone(element, async clone => {
    const bounds = clone.getBoundingClientRect();
    const width = Math.ceil(bounds.width);
    const height = Math.ceil(bounds.height);
    // Short stories stay intact; long stories are split into balanced pages.
    const pageCount = height <= 1800 ? 1 : Math.ceil(height / 1273);
    const targetHeight = Math.ceil(height / pageCount);
    const protectedRanges: { top: number; bottom: number }[] = [];
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(walker.currentNode);
      for (const rect of range.getClientRects()) if (rect.height) protectedRanges.push({ top: rect.top - bounds.top, bottom: rect.bottom - bounds.top });
    }
    clone.querySelectorAll(".document-footer,.message-attribution,.captain-entry-label").forEach(element => {
      const rect = element.getBoundingClientRect();
      if (rect.height < targetHeight / 2) protectedRanges.push({ top: rect.top - bounds.top, bottom: rect.bottom - bounds.top });
    });
    const pages: StoryPage[] = [];
    for (let offset = 0; offset < height;) {
      const remainingPages = Math.max(1, pageCount - pages.length);
      let end = remainingPages === 1 ? height : Math.min(height, offset + Math.ceil((height - offset) / remainingPages));
      if (end < height) {
        for (;;) {
          const overlaps = protectedRanges.filter(line => line.top < end && line.bottom > end);
          if (!overlaps.length) break;
          const next = Math.floor(Math.min(...overlaps.map(line => line.top)) - 2);
          if (next <= offset || next === end) break;
          end = next;
        }
      }
      const canvas = await captureStory(clone, offset, end - offset);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("PDF image encoding failed")), "image/png"));
      pages.push({ image: new Uint8Array(await blob.arrayBuffer()), width, height: end - offset });
      offset = end;
    }
    return createStoryPdf(pages, title, edition);
  });
}
