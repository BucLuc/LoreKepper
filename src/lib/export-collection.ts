import type { Entry } from "./archive";
export function collectionJson(entries: Entry[]) {
  return {
    items: entries.map((e) => ({
      type: e.type,
      title: e.title,
      score: e.score,
      description: e.reason,
      timestamp: e.messages[0]?.timestamp ?? "",
      source: e.source,
      messages: e.messages.map((m) => ({
        source: m.source,
        author: m.author,
        timestamp: m.timestamp,
        content: m.content,
        ...(m.original !== undefined ? { original: m.original } : {}),
        sourceFormat: m.sourceFormat,
      })),
    })),
  };
}
const heading = (s: string) =>
  s.replace(/[\r\n]+/g, " ").replace(/([\\`*_{}\[\]<>#|])/g, "\\$1");
export function collectionMarkdown(name: string, entries: Entry[]) {
  return (
    `# ${heading(name)}\n\n` +
    entries
      .map(
        (e) =>
          `## ${heading(e.title)}\n\n` +
          e.messages
            .map(
              (m) =>
                `### ${heading(m.author)} · ${heading(m.timestamp)}\n\n${m.content}\n`,
            )
            .join("\n") +
          "\n---\n",
      )
      .join("\n")
  );
}
