// Browser-measured pagination. No pixels or text lines are cut at page boundaries.
export type PdfUnit = {
  node: HTMLElement;
  wrappers: HTMLElement[];
  keepNext: boolean;
};
export type LaidOutPage = {
  element: HTMLElement;
  flow: HTMLElement;
  body: HTMLElement;
  wrappers: Map<HTMLElement, HTMLElement>;
  units: number;
};
export function contentUnits(root: HTMLElement): PdfUnit[] {
  const units: PdfUnit[] = [];
  function walk(node: HTMLElement, wrappers: HTMLElement[]) {
    const tag = node.tagName;
    if (tag === "THEAD")
      return;
    const label = node.matches(".message-attribution,.captain-entry-label,.edition-message-label,.form-section-bar,.file-evidence-bar,.testimony-heading,.feed-author,.script-scene,.social-post-footer,.message-end,.edition-end");
    if (label) {
      units.push({ node: node.cloneNode(true) as HTMLElement, wrappers, keepNext: !node.matches(".social-post-footer,.message-end,.edition-end") });
      return;
    }
    if (tag === "TABLE") {
      for (const child of Array.from(node.children))
        walk(child as HTMLElement, [...wrappers, node]);
      return;
    }
    const structural = ["DIV", "SECTION", "UL", "OL", "TBODY", "BLOCKQUOTE"].includes(tag) && node.children.length > 0;
    if (structural) {
      for (const child of Array.from(node.children))
        walk(child as HTMLElement, [...wrappers, node]);
      return;
    }
    const copy = node.cloneNode(true) as HTMLElement;
    if (tag === "LI" && node.parentElement?.tagName === "OL")
      copy.setAttribute("value", String(Number(node.parentElement.getAttribute("start") ?? 1) + Array.from(node.parentElement.children).indexOf(node)));
    units.push({ node: copy, wrappers, keepNext: /^H[1-6]$/.test(tag) || node.matches(".message-attribution,.captain-entry-label,.edition-message-label,.complaint-statement-header,.file-evidence-bar") });
  }
  for (const child of Array.from(root.children))
    walk(child as HTMLElement, []);
  return units;
}
export function appendUnit(page: LaidOutPage, unit: PdfUnit, node = unit.node) {
  let parent = page.body;
  const created: HTMLElement[] = [];
  for (const template of unit.wrappers) {
    let wrapper = page.wrappers.get(template);
    if (!wrapper) {
      wrapper = template.cloneNode(false) as HTMLElement;
      if (wrapper.tagName === "TABLE") {
        const head = template.querySelector(":scope > thead");
        if (head)
          wrapper.append(head.cloneNode(true));
      }
      parent.append(wrapper);
      page.wrappers.set(template, wrapper);
      created.push(template);
    }
    parent = wrapper;
  }
  const copy = node.cloneNode(true) as HTMLElement;
  parent.append(copy);
  return { copy, undo() { copy.remove(); for (const template of created.reverse()) {
      page.wrappers.get(template)?.remove();
      page.wrappers.delete(template);
    } } };
}
export function fitsPage(page: LaidOutPage) { return page.flow.scrollHeight <= page.flow.clientHeight + 1; }
export function remainingHeight(page: LaidOutPage) { return page.flow.getBoundingClientRect().bottom - page.body.getBoundingClientRect().bottom; }
function textLength(node: HTMLElement) { return node.tagName === "TR" ? Math.max(0, ...Array.from(node.children).map(c => c.textContent?.length ?? 0)) : node.textContent?.length ?? 0; }
function cutContents(node: HTMLElement, at: number) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let offset = at, text: Node | null = null;
  while (walker.nextNode()) {
    const length = walker.currentNode.textContent?.length ?? 0;
    if (offset <= length) {
      text = walker.currentNode;
      break;
    }
    offset -= length;
  }
  const first = node.cloneNode(false) as HTMLElement, rest = node.cloneNode(false) as HTMLElement;
  if (!text) {
    first.append(...Array.from(node.childNodes).map(n => n.cloneNode(true)));
    return [first, rest] as const;
  }
  const before = document.createRange();
  before.selectNodeContents(node);
  before.setEnd(text, offset);
  const after = document.createRange();
  after.selectNodeContents(node);
  after.setStart(text, offset);
  first.append(before.cloneContents());
  rest.append(after.cloneContents());
  return [first, rest] as const;
}
function safeOffset(text: string, at: number) { if (at >= text.length)
  return text.length; const prefix = text.slice(0, at); const breaks = [...prefix.matchAll(/\s+/gu)]; return breaks.length ? breaks[breaks.length - 1].index! + breaks[breaks.length - 1][0].length : at; }
export function splitBlock(node: HTMLElement, at: number) {
  if (node.tagName !== "TR")
    return cutContents(node, at);
  // Each fragment retains every cell, so a tall row never shifts into other columns.
  const first = node.cloneNode(false) as HTMLElement, rest = node.cloneNode(false) as HTMLElement;
  for (const cell of Array.from(node.children)) {
    const [a, b] = cutContents(cell as HTMLElement, safeOffset(cell.textContent ?? "", at));
    first.append(a);
    rest.append(b);
  }
  return [first, rest] as const;
}
export function splitToFit(page: LaidOutPage, unit: PdfUnit) {
  const node = unit.node, text = node.textContent ?? "", length = textLength(node);
  if (!node.matches("p,li,pre,tr"))
    return null;
  if (node.querySelector("img,svg")) {
    // Inline images can share one Markdown paragraph. Split between child nodes
    // so several tall illustrations still paginate without slicing the artwork.
    const children = Array.from(node.childNodes);
    let best = 0;
    for (let index = 1; index < children.length; index++) {
      const first = node.cloneNode(false) as HTMLElement;
      first.append(...children.slice(0, index).map(child => child.cloneNode(true)));
      const trial = appendUnit(page, unit, first);
      const fits = fitsPage(page);
      trial.undo();
      if (fits)
        best = index;
      else
        break;
    }
    if (!best)
      return null;
    const first = node.cloneNode(false) as HTMLElement, rest = node.cloneNode(false) as HTMLElement;
    first.append(...children.slice(0, best).map(child => child.cloneNode(true)));
    rest.append(...children.slice(best).map(child => child.cloneNode(true)));
    rest.classList.add("pdf-block-continuation");
    return [first, rest] as const;
  }
  if (length < 2)
    return null;
  const breaks = node.tagName === "PRE" ? [...text.matchAll(/\n/g)].map(m => m.index! + 1) : [...text.matchAll(/\s+/gu)].map(m => m.index! + m[0].length);
  const positions = node.tagName === "TR" ? Array.from({ length: Math.ceil(length / 12) }, (_, i) => Math.min(length - 1, (i + 1) * 12)) : breaks.filter(i => i > 0 && i < length);
  // A single unbroken word/Unicode run is split at a Unicode boundary only if necessary.
  if (!positions.length) {
    let offset = 0;
    for (const c of Array.from(text)) {
      offset += c.length;
      if (offset < length)
        positions.push(offset);
    }
  }
  function findFit(candidates: number[]) {
    let low = 0, high = candidates.length - 1, best = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const [first] = splitBlock(node, candidates[mid]);
      const candidate = appendUnit(page, unit, first);
      const fits = fitsPage(page);
      candidate.undo();
      if (fits) {
        best = candidates[mid];
        low = mid + 1;
      }
      else
        high = mid - 1;
    }
    return best;
  }
  let best = findFit(positions);
  // A very long fenced-code line or unbroken word may precede later line/word
  // boundaries. Prefer words, then Unicode boundaries rather than rejecting it.
  if (!best && node.tagName !== "TR") {
    const words = [...text.matchAll(/\s+/gu)].map(m => m.index! + m[0].length).filter(i => i > 0 && i < length);
    if (node.tagName === "PRE")
      best = findFit(words);
    if (!best) {
      const unicode: number[] = [];
      let offset = 0;
      const limit = words[0] ?? length;
      for (const character of Array.from(text.slice(0, limit))) {
        offset += character.length;
        if (offset < length)
          unicode.push(offset);
      }
      best = findFit(unicode);
    }
  }
  if (!best)
    return null;
  const [first, rest] = splitBlock(node, best);
  if (!first.textContent?.trim() || !rest.textContent?.trim())
    return null;
  // Leave room for at least two lines when a paragraph begins at a page foot.
  if (page.units && node.matches("p,pre")) {
    const trial = appendUnit(page, unit, first);
    const line = parseFloat(getComputedStyle(trial.copy).lineHeight);
    const height = trial.copy.getBoundingClientRect().height;
    trial.undo();
    if (Number.isFinite(line) && height < line * 1.8)
      return null;
  }
  for (const initial of rest.querySelectorAll(".pdf-initial"))
    if (!initial.textContent)
      initial.remove();
  rest.classList.add("pdf-block-continuation");
  return [first, rest] as const;
}
export function normalizePdfArtwork(element: HTMLElement) {
  element.querySelectorAll<SVGSVGElement>("svg").forEach(svg => { const ink = getComputedStyle(svg).color; svg.querySelectorAll("[fill='currentColor'],[stroke='currentColor']").forEach(shape => { if (shape.getAttribute("fill") === "currentColor")
    shape.setAttribute("fill", ink); if (shape.getAttribute("stroke") === "currentColor")
    shape.setAttribute("stroke", ink); }); });
  for (const paragraph of element.querySelectorAll<HTMLElement>(".message-prose p")) {
    const appearance = getComputedStyle(paragraph, "::first-letter");
    if (appearance.float !== "left" || parseFloat(appearance.fontSize) < parseFloat(getComputedStyle(paragraph).fontSize) * 1.4)
      continue;
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    let text: Node | null = null;
    while (walker.nextNode()) {
      if (walker.currentNode.textContent?.trim()) {
        text = walker.currentNode;
        break;
      }
    }
    if (!text?.textContent)
      continue;
    const match = text.textContent.match(/^(\s*)([\s\S])/u);
    if (!match)
      continue;
    const initial = document.createElement("span");
    initial.className = "pdf-initial";
    for (const property of ["font-family", "font-size", "font-weight", "line-height", "color", "float", "padding", "margin", "border", "background", "box-shadow", "text-shadow"])
      initial.style.setProperty(property, appearance.getPropertyValue(property));
    initial.textContent = match[2];
    text.textContent = match[1] + text.textContent.slice(match[0].length);
    text.parentNode?.insertBefore(initial, text);
  }
  element.classList.add("pdf-initials-ready");
}
