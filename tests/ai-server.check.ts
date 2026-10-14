import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AIError, generateAI } from "../src/lib/ai";
import { encrypt } from "../src/lib/encryption";
test("server AI resolves funding owner, reserves quota and never returns provider errors containing keys", async () => {
  const oldKey = process.env.LORE_ENCRYPTION_KEY;
  process.env.LORE_ENCRYPTION_KEY = "0".repeat(64);
  const owner = "creator",
    billed: unknown[] = [],
    lookedUp: unknown[] = [];
  const settings = {
    provider: "groq",
    model: "fixture-model",
    encrypted_key: encrypt({ key: "fixture-secret" }, "ai", owner),
  };
  const db = {
    from: () => ({
      select: () => ({
        eq: (_column: string, id: string) => {
          lookedUp.push(id);
          return { maybeSingle: async () => ({ data: settings, error: null }) };
        },
      }),
    }),
    rpc: async (_name: string, args: unknown) => {
      billed.push(args);
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;
  const fetchMock = mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) => {
      assert.equal(
        (options.headers as Record<string, string>).Authorization,
        "Bearer fixture-secret",
      );
      assert.equal(JSON.parse(options.body as string).model, "fixture-model");
      return Response.json({
        choices: [{ message: { content: "A legend begins." } }],
      });
    },
  );
  try {
    assert.equal(
      await generateAI(db, owner, "Narrate", "Begin", 6),
      "A legend begins.",
    );
    assert.deepEqual(lookedUp, [owner]);
    assert.deepEqual(billed, [
      { u: owner, cost: 6, daily_limit: 500, global_limit: 0 },
    ]);
    fetchMock.mock.mockImplementation(async () =>
      Response.json({ error: "fixture-secret" }, { status: 401 }),
    );
    await assert.rejects(
      generateAI(db, owner, "Narrate", "Begin", 6),
      (e) =>
        e instanceof Error &&
        e.message.includes("(401)") &&
        !e.message.includes("fixture-secret"),
    );
    fetchMock.mock.mockImplementation(async () =>
      Response.json(
        { error: { message: "fixture-secret", code: "model_not_found" } },
        { status: 404 },
      ),
    );
    await assert.rejects(
      generateAI(db, owner, "Narrate", "Begin", 6),
      (e) =>
        e instanceof AIError &&
        e.publicStatus === 422 &&
        e.message.includes("fixture-model") &&
        e.message.includes("unavailable") &&
        !e.message.includes("fixture-secret"),
    );
    fetchMock.mock.mockImplementation(async () =>
      Response.json({}, { status: 429 }),
    );
    await assert.rejects(
      generateAI(db, owner, "Narrate", "Begin", 6),
      /rate limit/,
    );
  } finally {
    fetchMock.mock.restore();
    if (oldKey === undefined) delete process.env.LORE_ENCRYPTION_KEY;
    else process.env.LORE_ENCRYPTION_KEY = oldKey;
  }
});
test("quota errors prevent provider calls", async () => {
  const oldKey = process.env.LORE_AI_KEY;
  process.env.LORE_AI_KEY = "fixture-shared";
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
    rpc: async () => ({ error: { message: "Daily AI quota reached" } }),
  } as unknown as SupabaseClient;
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw new Error("Provider must not be called");
  });
  try {
    await assert.rejects(
      generateAI(db, "creator", "Narrate", "Begin", 6),
      /quota reached/,
    );
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally {
    fetchMock.mock.restore();
    if (oldKey === undefined) delete process.env.LORE_AI_KEY;
    else process.env.LORE_AI_KEY = oldKey;
  }
});
