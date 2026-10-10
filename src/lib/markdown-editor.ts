import TurndownService from "turndown";

export type MarkdownAction = "bold" | "italic" | "strike" | "heading" | "bullet" | "number" | "task" | "quote" | "code" | "link" | "table";
export function formatMarkdown(value: string, start: number, end: number, action: MarkdownAction) {
  const selected = value.slice(start, end);
  let text: string, selectionStart = start, selectionEnd: number;
  const wrappers = {bold: ["**", "**"], italic: ["*", "*"], strike: ["~~", "~~"], link: ["[", "](https://example.com)"]};
  if (action in wrappers) {
    const [before, after] = wrappers[action as keyof typeof wrappers];
    const content = selected || (action === "link" ? "link text" : "text");
    text = before + content + after;
    selectionStart += before.length;
    selectionEnd = selectionStart + content.length;
  } else if (action === "code" || action === "table") {
    const before = start && value[start - 1] !== "\n" ? "\n\n" : "";
    text = before + (action === "code" ? `\`\`\`\n${selected || "code"}\n\`\`\`\n` : "| Heading | Heading |\n| --- | --- |\n| Text | Text |\n");
    selectionStart += before.length + (action === "code" ? 4 : 2);
    selectionEnd = selectionStart + (action === "code" ? (selected || "code").length : 7);
  } else {
    start = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
    const next = value.indexOf("\n", end);
    end = next === -1 ? value.length : next;
    const lines = value.slice(start, end).split("\n");
    const prefix = action === "heading" ? "## " : action === "bullet" ? "- " : action === "task" ? "- [ ] " : "> ";
    text = lines.map((line, i) => `${action === "number" ? `${i + 1}. ` : prefix}${line || "text"}`).join("\n");
    selectionStart = start;
    selectionEnd = start + text.length;
  }
  return {value: value.slice(0, start) + text + value.slice(end), start: selectionStart, end: selectionEnd};
}

// Teams and Office clipboard HTML carries inline styles, not just semantic tags.
// Convert to Markdown; HTML is never injected into the editor or its preview.
export function clipboardMarkdown(html: string) {
  const converter = new TurndownService({headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced"});
  converter.remove(node => ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "IMG", "SVG", "NOSCRIPT"].includes(node.nodeName.toUpperCase()));
  converter.addRule("officeFormatting", {
    filter: node => ["SPAN", "P", "DIV"].includes(node.nodeName) && /font-weight\s*:|font-style\s*:|text-decoration[^:]*\s*:/i.test(node.getAttribute("style") || ""),
    replacement: (content, node) => {
      const style = (node as HTMLElement).getAttribute("style") || "";
      const trimmed = content.trim();
      if (!trimmed) return content;
      let text = trimmed;
      if (/font-weight\s*:\s*(?:bold|[6-9]00)/i.test(style) && !/^\*\*/.test(text)) text = `**${text}**`;
      if (/font-style\s*:\s*italic/i.test(style)) text = `*${text}*`;
      if (/text-decoration[^:]*\s*:[^;]*line-through/i.test(style)) text = `~~${text}~~`;
      const whitespace = content.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
      return node.nodeName === "SPAN" ? whitespace[1] + text + whitespace[3] : `\n\n${text}\n\n`;
    },
  });
  converter.addRule("officeInlineCode", {
    filter: node => ["SPAN", "CODE", "KBD", "SAMP"].includes(node.nodeName) && (node.nodeName !== "SPAN" || /font-family\s*:[^;]*(?:monospace|consolas|courier|menlo|monaco)/i.test(node.getAttribute("style") || "")) && node.parentNode?.nodeName !== "PRE",
    replacement: (_content, node) => {
      const text = (node.textContent || "").replace(/\r?\n/g, " ");
      if (!text.trim()) return text;
      const longest = Math.max(0, ...(text.match(/`+/g) || []).map(run => run.length));
      const fence = "`".repeat(longest + 1);
      const pad = text.includes("`") || /^ | $/.test(text) ? " " : "";
      return fence + pad + text + pad + fence;
    },
  });
  converter.addRule("strikethrough", {filter:node => ["DEL","S","STRIKE"].includes(node.nodeName), replacement:content=>"~~"+content+"~~"});
  converter.addRule("safeLinks", {
    filter: "a",
    replacement: (content, node) => {
      const href = (node as HTMLElement).getAttribute("href") || "";
      return /^(?:https?:\/\/|mailto:|\/(?!\/)|#)/i.test(href) ? `[${content}](${href.replace(/[()\s]/g, c => encodeURIComponent(c))})` : content;
    },
  });
  converter.addRule("tables", {
    filter: "table",
    replacement: (_content, node) => {
      const rows = Array.from((node as HTMLElement).querySelectorAll("tr")).map(row => Array.from(row.children)
        .filter(cell => ["TD", "TH"].includes(cell.tagName))
        .map(cell => converter.turndown(cell.innerHTML).trim().replace(/\|/g, "\\|").replace(/\n+/g, " / ")));
      const width = Math.max(0, ...rows.map(row => row.length));
      if (!width) return "";
      const line = (cells: string[]) => `| ${Array.from({length: width}, (_, i) => cells[i] || "").join(" | ")} |`;
      return `\n\n${line(rows[0])}\n${line(Array(width).fill("---"))}\n${rows.slice(1).map(line).join("\n")}\n\n`;
    },
  });
  const fragment = html.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i)?.[1] || html;
  return converter.turndown(fragment).trim();
}

