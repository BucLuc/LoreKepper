import type { Entry } from "./archive";
export function validateEntries(value: unknown): Entry[] {
  if (!value || typeof value !== "object")
    throw new Error('Choose a JSON archive with an "items" array (or legacy "entries" array).');
  const curated = "items" in value;
  const entries = curated ? value.items : "entries" in value ? value.entries : undefined;
  if (!Array.isArray(entries))
    throw new Error('Choose a JSON archive with an "items" array (or legacy "entries" array).');
  if (entries.length === 0 || entries.length > 500)
    throw new Error(`This archive contains ${entries.length} entries. Choose 1–500 entries per batch.`);
  return entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error(`Entry ${index + 1} must be an object.`);
    const reason = curated ? entry.description : entry.reason;
    // Curated archives have no ranking. Use a neutral internal default when no score is supplied.
    const score = curated && entry.score === undefined ? 0 : entry.score;
    if (
      typeof entry.title !== "string" || !entry.title.trim() || entry.title.length > 500 ||
      typeof entry.type !== "string" || typeof entry.source !== "string" ||
      typeof reason !== "string" || !Number.isFinite(score) || score < 0 || score > 10 ||
      (curated && entry.timestamp !== undefined && typeof entry.timestamp !== "string") ||
      !Array.isArray(entry.messages) || !entry.messages.length
    )
      throw new Error(curated
        ? `Entry ${index + 1} needs title, type, source, description, and messages. Optional score must be 0–10.`
        : `Entry ${index + 1} needs title, type, source, reason, score (0–10), and messages.`);
    for (const m of entry.messages)
      if (
        !m || typeof m !== "object" || Array.isArray(m) ||
        ["timestamp", "content", "source", "sourceFormat"].some(k => typeof m[k] !== "string") ||
        (!m.userId && (typeof m.author !== "string" || !m.author.trim())) ||
        (m.userId !== undefined && (typeof m.userId !== "string" || !/^[0-9a-f-]{36}$/i.test(m.userId))) ||
        !m.content.trim() || (m.original !== undefined && typeof m.original !== "string")
      )
        throw new Error(`Entry ${index + 1}: messages require author, timestamp, content, source and sourceFormat strings.`);
    return { ...entry, reason, score };
  });
}
