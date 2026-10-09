import { authorName, parseTimestamp, dateLabel } from "./format";
import archive from "../../data/data.json";
import TurndownService from "turndown";

export type Message = {
  id: string;
  source: string;
  author: string;
  timestamp: string;
  content: string;
  original?: string;
  sourceFormat: string;
  presentation?: string;
};
export type Entry = {
  id: string;
  type: string;
  title: string;
  score: number;
  reason: string;
  source: string;
  messages: Message[];
};
export type Exhibit = Entry & {
  number: number;
  authors: string[];
  date: string;
  time: number;
  minutes: number;
  preview: string;
  category: string;
  recommended: string;
};

export function classify(entry: Entry) {
  const text = entry.title.toLowerCase();
  if (/royal|decree|majesty/.test(text))
    return { category: "Royal proclamations", recommended: "decree" };
  if (/ancient|prophecy|sacred/.test(text))
    return { category: "Myths & legends", recommended: "scroll" };
  if (/classified|dossier|spy|stealth|mission:/.test(text))
    return { category: "Dubious intelligence", recommended: "dossier" };
  if (
    /medieval|knight|shakespeare|jester|incantation|ballad|oath|legend|saga|chronicle|folktale|poem/.test(
      text,
    )
  )
    return { category: "Myths & legends", recommended: "manuscript" };
  if (/incident|corporate|meeting|office|workplace|teams|account/.test(text))
    return { category: "Office folklore", recommended: "incident" };
  if (/letter|bewerbung|application|widerspruch|refund|einladung/.test(text))
    return { category: "Official nonsense", recommended: "letter" };
  if (/jojo|goku|stand|battle|fight|showdown|breaking bad/.test(text))
    return { category: "Epic encounters", recommended: "screenplay" };
  if (entry.type === "discussion")
    return { category: "Conversations", recommended: "social" };
  if (/git|coding|react|saas|command|json|app|malware/.test(text))
    return { category: "Technical tragedies", recommended: "terminal" };
  return { category: "Uncategorised genius", recommended: "glorious" };
}
const htmlToMarkdown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});
htmlToMarkdown.remove(["script", "style", "iframe", "img"]);
export const exhibits: Exhibit[] = (archive.entries as Entry[]).map(
  (entry, index) => {
    const messages = entry.messages.map((message) => {
      const isHtmlContent =
        /<(?:p|div|ul|ol|li|br|strong|span|table|blockquote|h[1-6])(?:\s|>)/i.test(
          message.content,
        );
      const content = isHtmlContent
        ? htmlToMarkdown.turndown(message.content)
        : message.content;
      const presentation =
        message.sourceFormat === "html" && message.original
          ? htmlToMarkdown.turndown(message.original)
          : content;
      return { ...message, content, presentation };
    });
    const text = messages.map((m) => m.content).join("\n\n");
    const time = entry.messages.length
      ? parseTimestamp(entry.messages[0].timestamp)
      : 0;
    return {
      ...entry,
      messages,
      number: index + 1,
      authors: [...new Set(entry.messages.map((m) => authorName(m.author)))],
      time,
      date: entry.messages.length
        ? dateLabel(entry.messages[0].timestamp)
        : "Undated",
      minutes: Math.max(1, Math.ceil(text.split(/\s+/).length / 220)),
      preview: text
        .replace(/[#*_`>]/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 190),
      ...classify(entry),
    };
  },
);
export const archiveStats = {
  stories: exhibits.length,
  messages: exhibits.reduce((n, e) => n + e.messages.length, 0),
  authors: [...new Set(exhibits.flatMap((e) => e.authors))].sort(),
  years: [
    ...new Set(exhibits.map((e) => new Date(e.time).getUTCFullYear())),
  ].sort(),
};
