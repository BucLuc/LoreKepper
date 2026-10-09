// Render one page at a time to avoid browser canvas limits on long stories.
export async function exportStoryPdf(
  element: HTMLElement,
  title: string,
  edition: string,
) {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:absolute;left:-10000px;top:0;width:900px;pointer-events:none;background:#11110f;";
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
    return await renderPdf(clone, title, edition);
  } finally {
    host.remove();
  }
}

async function renderPdf(element: HTMLElement, title: string, edition: string) {
  const [{ default: capture }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  await document.fonts.ready;
  const bounds = element.getBoundingClientRect();
  const width = Math.ceil(bounds.width);
  const height = Math.ceil(bounds.height);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  pdf.setProperties({
    title,
    subject: `${edition} edition`,
    creator: "LoreKeeper",
  });
  const margin = 8;
  const pageWidth = 210 - margin * 2;
  const pageHeight = 297 - margin * 2;
  const maxHeight = Math.floor((pageHeight * width) / pageWidth);
  // Avoid cutting through rendered text lines, including Markdown and ASCII art.
  const lines: { top: number; bottom: number }[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (rect.height)
        lines.push({
          top: rect.top - bounds.top,
          bottom: rect.bottom - bounds.top,
        });
    }
  }
  let offset = 0;
  let page = 0;
  while (offset < height) {
    let end = Math.min(height, offset + maxHeight);
    if (end < height) {
      let overlaps = lines.filter(
        (line) => line.top < end && line.bottom > end,
      );
      while (overlaps.length) {
        const next = Math.floor(
          Math.min(...overlaps.map((line) => line.top)) - 2,
        );
        if (next <= offset || next === end) break;
        end = next;
        overlaps = lines.filter((line) => line.top < end && line.bottom > end);
      }
    }
    const sliceHeight = end - offset;
    const canvas = await capture(element, {
      scale: 2,
      backgroundColor: "#11110f",
      useCORS: true,
      logging: false,
      y: offset,
      width,
      height: sliceHeight,
    });
    if (page++) pdf.addPage();
    pdf.addImage(
      canvas,
      "PNG",
      margin,
      margin,
      pageWidth,
      (sliceHeight * pageWidth) / width,
      undefined,
      "FAST",
    );
    offset = end;
  }
  const filename =
    title
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
      .trim()
      .slice(0, 100) || "LoreKeeper";
  pdf.save(`${filename} — ${edition}.pdf`);
  return {
    url: pdf.output("datauristring"),
    filename: `${filename} — ${edition}.pdf`,
  };
}
