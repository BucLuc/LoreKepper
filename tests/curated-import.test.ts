import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { validateEntries } from "../src/lib/validation";
import { collectionJson } from "../src/lib/export-collection";
const archive = JSON.parse(readFileSync("data/lorekeeper_curated_strict.json", "utf8"));

test("the actual curated archive imports completely without rewriting the file", () => {
  const before = JSON.stringify(archive);
  const entries = validateEntries(archive);
  assert.equal(entries.length, archive.items.length);
  assert.ok(entries.length > 0 && entries.length <= 500);
  for (const [index, entry] of entries.entries()) {
    assert.equal(entry.reason, archive.items[index].description);
    assert.equal(entry.score, 0);
    assert.deepEqual(entry.messages, archive.items[index].messages);
    assert.equal(entry.id, archive.items[index].id);
  }
  assert.equal(JSON.stringify(archive), before);
});

test("curated JSON exports use items and description and round-trip all content", () => {
  const entries = validateEntries(archive);
  const exported = collectionJson(entries);
  assert.ok(!("entries" in exported));
  assert.equal(exported.items[0].description, archive.items[0].description);
  const imported = validateEntries(exported);
  assert.equal(imported.length, entries.length);
  for (const [index, entry] of imported.entries()) {
    assert.equal(entry.reason, entries[index].reason);
    assert.equal(entry.score, entries[index].score);
    assert.equal(entry.messages.length, entries[index].messages.length);
    assert.deepEqual(entry.messages.map(m => m.content), entries[index].messages.map(m => m.content));
  }
});

test("shape, count, and item validation errors are distinct", () => {
  assert.throws(() => validateEntries({ data: [] }), /items.*array/);
  assert.throws(() => validateEntries({ items: [] }), /contains 0 entries/);
  assert.throws(() => validateEntries({ items: Array(501).fill(archive.items[0]) }), /contains 501 entries/);
  assert.equal(validateEntries({ items: Array(228).fill(archive.items[0]) }).length, 228);
  assert.throws(() => validateEntries({ items: [{ ...archive.items[0], description: undefined }] }), /description/);
  assert.throws(() => validateEntries({ items: [{ ...archive.items[0], score: 11 }] }), /score/);
  assert.throws(() => validateEntries({ items: [{ ...archive.items[0], messages: [null] }] }), /messages require/);
});
