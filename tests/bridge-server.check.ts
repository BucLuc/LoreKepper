import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/story-bridge/sessions/[id]/route";
import { POST as save } from "../src/app/api/story-bridge/sessions/[id]/turns/route";
import { POST as token } from "../src/app/api/story-bridge/oauth/token/route";
import { hash } from "../src/lib/bridge-server";
const owner = "11111111-1111-4111-8111-111111111111",
  id = "44444444-4444-4444-8444-444444444444",
  access = "z".repeat(43);
test("HTTP bridge authenticates hashed OAuth tokens, filters ownership and saves a validated scene without an AI call", async () => {
  const original = globalThis.fetch,
    old = { ...process.env };
  let foreign = false;
  const trace: { committed: Record<string, unknown> | null } = {
    committed: null,
  };
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-server",
  });
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    let result: unknown = [];
    if (url.pathname.endsWith("/rpc/authenticate_gpt")) {
      assert.equal(body.hash, hash(access));
      result = owner;
    } else if (url.pathname.endsWith("/adventures")) {
      assert.equal(url.searchParams.get("owner_id"), `eq.${owner}`);
      result = foreign
        ? []
        : [
            {
              id,
              owner_id: owner,
              title: "",
              world: "",
              voice: {
                language: "English",
                style: "Medieval",
                tone: "Default",
                scope: "entire",
              },
              ai_mode: "chatgpt",
              status: "active",
              revision: 0,
              summary: "",
              segments: [],
            },
          ];
    } else if (url.pathname.endsWith("/adventure_players"))
      result = [
        { user_id: owner, name: "Visitor", description: "", character: null },
      ];
    else if (url.pathname.endsWith("/gpt_turn_receipts")) result = [];
    else if (url.pathname.endsWith("/rpc/commit_gpt_turn")) {
      trace.committed = body;
      result = { revision: 1, duplicate: false };
    } else assert.fail(`Unexpected network call: ${url.pathname}`);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const unauthorized = await GET(
      new Request(`https://fixture.test/api/story-bridge/sessions/${id}`),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(unauthorized.status, 401);
    const headers = {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    };
    const read = await GET(
      new Request(`https://fixture.test/api/story-bridge/sessions/${id}`, {
        headers,
      }),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(read.status, 200);
    const context = await read.json();
    assert.equal(context.ready, true);
    assert.equal(context.sessionId, id);
    assert.ok(!JSON.stringify(context).includes("fixture-server"));
    foreign = true;
    const denied = await GET(
      new Request(`https://fixture.test/api/story-bridge/sessions/${id}`, {
        headers,
      }),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(denied.status, 404);
    foreign = false;
    const response = await save(
      new Request(
        `https://fixture.test/api/story-bridge/sessions/${id}/turns`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            requestId: "opening",
            revision: 0,
            title: "At the gate",
            world: "Thornwick",
            narrative:
              "## Chapter I: The gate\n\nA guard waits in the doorway.",
            summary: "A guard awaits the visitor.",
            questions: [{ player: owner, text: "What do you do?" }],
            resolvedActions: [],
          }),
        },
      ),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(response.status, 200);
    assert.ok(trace.committed);
    assert.equal(trace.committed.u, owner);
    assert.equal(trace.committed.story_title, "At the gate");
  } finally {
    globalThis.fetch = original;
    for (const k of Object.keys(process.env))
      if (!(k in old)) delete process.env[k];
    Object.assign(process.env, old);
  }
});
test("OAuth rejects the wrong client and malformed JSON without echoing secrets", async () => {
  const old = { ...process.env };
  Object.assign(process.env, {
    LORE_GPT_CLIENT_ID: "fixture-client",
    LORE_GPT_CLIENT_SECRET: "secret-not-for-output",
    LORE_GPT_REDIRECT_URI: "https://chatgpt.com/aip/g-fixture/oauth/callback",
  });
  try {
    const wrong = await token(
      new Request("https://fixture.test/api/story-bridge/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: "fixture-client",
          client_secret: "wrong-private-secret",
          grant_type: "authorization_code",
          code: "private-code",
        }),
      }),
    );
    assert.equal(wrong.status, 401);
    assert.ok(!(await wrong.text()).includes("private-secret"));
    const malformed = await token(
      new Request("https://fixture.test/api/story-bridge/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"client_secret":"do-not-echo-this"',
      }),
    );
    assert.equal(malformed.status, 400);
    assert.ok(!(await malformed.text()).includes("do-not-echo"));
  } finally {
    for (const k of Object.keys(process.env))
      if (!(k in old)) delete process.env[k];
    Object.assign(process.env, old);
  }
});
