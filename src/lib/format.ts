import type { Entry } from "./archive";
export function authorName(author: string) {
  if (/liridon|liri/i.test(author)) return "Liri";
  if (/kneubühl|\bluc\b/i.test(author)) return "Luc";
  return author;
}
export function parseTimestamp(value: string) {
  const match = value.match(
    /^(\d{2})\.(\d{2})\.(\d{2}),\s*(\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (match) {
    const [, day, month, year, hour, minute, second = "0"] = match;
    const local = Date.UTC(
      2000 + Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Zurich",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    let candidate = local;
    // Recalculate after applying the offset: a DST transition can put the
    // initial UTC guess and the actual local time in different offsets.
    for (let i = 0; i < 2; i++) {
      const parts = formatter.formatToParts(candidate);
      const get = (name: string) =>
        Number(parts.find((p) => p.type === name)?.value);
      const represented = Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour"),
        get("minute"),
        get("second"),
      );
      candidate = local - (represented - candidate);
    }
    return candidate;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Zurich",
  }).format(parseTimestamp(value));
}
export function displayTime(value: string) {
  if (!value.includes("T"))
    return value.split(",")[1]?.trim().slice(0, 5) ?? "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(parseTimestamp(value));
}
export function storyText(entry: Entry, withAttribution = false) {
  return entry.messages
    .map((m) =>
      withAttribution
        ? `${m.userId ? m.author : authorName(m.author)} · ${dateLabel(m.timestamp)} · ${displayTime(m.timestamp)}\n\n${m.content}`
        : m.content,
    )
    .join("\n\n────────────────────────────\n\n");
}
