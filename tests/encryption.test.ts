import test from "node:test";
import assert from "node:assert/strict";
import { encrypt, decrypt } from "../src/lib/encryption";
import { validateEntries } from "../src/lib/validation";
process.env.LORE_ENCRYPTION_KEY = "ab".repeat(32);
test("encrypted records round trip without exposing plaintext and use unique nonces", () => {
  const data = {
    title: "A secret chronicle",
    messages: [{ content: "⚜ encrypted wisdom" }],
  };
  const x = encrypt(data, "collection", "entry");
  assert.ok(!x.includes(data.title));
  assert.deepEqual(decrypt(x, "collection", "entry"), data);
  assert.notEqual(x, encrypt(data, "collection", "entry"));
});
test("authenticated encryption rejects tampering and swaps between entries or collections", () => {
  const x = encrypt({ content: "secret" }, "a", "1");
  assert.throws(() => decrypt(x, "a", "2"));
  assert.throws(() => decrypt(x, "b", "1"));
  const parts = x.split(".");
  parts[2] = Buffer.alloc(16).toString("base64");
  assert.throws(() => decrypt(parts.join("."), "a", "1"));
});
test("key configuration fails closed", () => {
  const previous = process.env.LORE_ENCRYPTION_KEY;
  process.env.LORE_ENCRYPTION_KEY = "";
  assert.throws(() => encrypt({}, "a", "b"));
  process.env.LORE_ENCRYPTION_KEY = previous;
});
test("JSON imports reject malformed entries before persistence", () => {
  assert.throws(() => validateEntries({ entries: [] }));
  assert.throws(() =>
    validateEntries({
      entries: [{ title: "Bad", messages: [{ content: "Text" }] }],
    }),
  );
  const entry = {
    title: "Legend",
    type: "single",
    source: "archive",
    reason: "",
    score: 8,
    messages: [
      {
        author: "Chronicler",
        timestamp: "2026-10-10",
        content: "A tale",
        source: "archive",
        sourceFormat: "markdown",
      },
    ],
  };
  assert.equal(validateEntries({ entries: [entry] }).length, 1);
  assert.throws(() => validateEntries({ entries: [{ ...entry, score: NaN }] }));
});
