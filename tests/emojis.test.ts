import assert from "node:assert/strict";
import test from "node:test";
import { withoutEmojis } from "../src/lib/emojis";

test("removes complete emoji sequences without removing numbers or punctuation", () => {
  assert.equal(withoutEmojis("Hello 👨‍👩‍👧‍👦👍🏽🇨🇭1️⃣❤️! 123 # *"), "Hello ! 123 # *");
  assert.equal(withoutEmojis("Plain words\nand spacing stay."), "Plain words\nand spacing stay.");
});
