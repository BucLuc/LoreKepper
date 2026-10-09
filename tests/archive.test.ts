import assert from "node:assert/strict";
import test from "node:test";
import source from "../data/data.json";
import { exhibits, archiveStats } from "../src/lib/archive";
import {
  authorName,
  dateLabel,
  displayTime,
  parseTimestamp,
  storyText,
} from "../src/lib/format";

test("every source entry and message survives archive preparation", () => {
  assert.equal(exhibits.length, source.entries.length);
  assert.equal(new Set(exhibits.map((e) => e.id)).size, source.entries.length);
  assert.equal(
    archiveStats.messages,
    source.entries.reduce((n, e) => n + e.messages.length, 0),
  );
  for (const [i, entry] of exhibits.entries()) {
    assert.equal(entry.id, source.entries[i].id);
    assert.equal(entry.messages.length, source.entries[i].messages.length);
    assert.ok(entry.time > 0, entry.id);
    for (const [j, message] of entry.messages.entries()) {
      assert.equal(message.original, source.entries[i].messages[j].original);
      if (
        !/<(?:p|div|ul|ol|li|br|strong|span|table|blockquote|h[1-6])(?:\s|>)/i.test(
          source.entries[i].messages[j].content,
        )
      )
        assert.equal(message.content, source.entries[i].messages[j].content);
      assert.ok(message.presentation?.trim(), message.id);
    }
  }
});
test("Teams and WhatsApp authors converge to the two actual friends", () => {
  assert.deepEqual(archiveStats.authors, ["Liri", "Luc"]);
  assert.equal(authorName("Rexhaj Liridon, BKW Energie AG"), "Liri");
  assert.equal(authorName("Kneubühl Luc, BKW Energie AG"), "Luc");
});
test("WhatsApp late-night dates stay on the original Zurich day", () => {
  assert.equal(dateLabel("21.05.24, 23:48:48"), "21 May 2024");
  assert.equal(
    new Date(parseTimestamp("21.05.24, 23:48:48")).toISOString(),
    "2024-05-21T21:48:48.000Z",
  );
  assert.equal(
    new Date(parseTimestamp("15.02.24, 14:01:57")).toISOString(),
    "2024-02-15T13:01:57.000Z",
  );
  assert.equal(displayTime("2024-05-21T21:48:48.000Z"), "23:48");
});
test("daylight-saving transition uses the offset at the actual local time", () => {
  assert.equal(
    new Date(parseTimestamp("27.10.24, 01:59:59")).toISOString(),
    "2024-10-26T23:59:59.000Z",
  );
  assert.equal(
    new Date(parseTimestamp("31.03.24, 01:30:00")).toISOString(),
    "2024-03-31T00:30:00.000Z",
  );
});
test("raw HTML inside a text entry becomes a readable complete list", () => {
  const entry = exhibits.find((e) => e.id === "hof-c61ecaab7d65")!;
  const original = source.entries.find((e) => e.id === entry.id)!.messages[0]
    .content;
  assert.equal(
    entry.messages[0].content
      .split("\n")
      .filter((line) => line.startsWith("- ")).length,
    (original.match(/<li>/g) || []).length,
  );
  assert.ok(entry.messages[0].content.includes("remaining stubbornly human"));
  assert.ok(!entry.preview.includes("<li>"));
});
test("copying a conversation preserves all messages and attribution in order", () => {
  const entry = exhibits.find((e) => e.id === "hof-4fafe032f313")!;
  assert.deepEqual(entry.authors.sort(), ["Liri", "Luc"]);
  const raw = storyText(entry);
  const attributed = storyText(entry, true);
  for (const m of entry.messages) {
    assert.ok(raw.includes(m.content));
    assert.ok(
      attributed.includes(
        `${authorName(m.author)} · ${dateLabel(m.timestamp)} · ${displayTime(m.timestamp)}`,
      ),
    );
  }
  assert.equal(
    raw,
    entry.messages
      .map((m) => m.content)
      .join("\n\n────────────────────────────\n\n"),
  );
});
