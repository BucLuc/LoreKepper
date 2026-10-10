import type { Entry } from "./archive";
export function validateEntries(value: unknown): Entry[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("entries" in value) ||
    !Array.isArray(value.entries) ||
    value.entries.length === 0 ||
    value.entries.length > 500
  )
    throw new Error(
      "Choose JSON with 1–500 entries. Split larger archives into batches.",
    );
  for (const entry of value.entries) {
    if (
      !entry ||
      typeof entry.title !== "string" ||
      !entry.title.trim() ||
      entry.title.length > 500 ||
      typeof entry.type !== "string" ||
      typeof entry.source !== "string" ||
      typeof entry.reason !== "string" ||
      !Number.isFinite(entry.score) ||
      entry.score < 0 ||
      entry.score > 10 ||
      !Array.isArray(entry.messages) ||
      !entry.messages.length
    )
      throw new Error(
        "Each entry needs title, type, source, reason, score (0–10), and messages.",
      );
    for (const m of entry.messages)
      if (
        !m ||
        ["timestamp", "content", "source", "sourceFormat"].some(
          (k) => typeof m[k] !== "string",
        ) ||
        (!m.userId && (typeof m.author !== "string" || !m.author.trim())) ||
        (m.userId !== undefined && (typeof m.userId !== "string" || !/^[0-9a-f-]{36}$/i.test(m.userId))) ||
        !m.content.trim() ||
        (m.original !== undefined && typeof m.original !== "string")
      )
        throw new Error(
          "Messages require author, timestamp, content, source and sourceFormat strings.",
        );
  }
  return value.entries;
}
