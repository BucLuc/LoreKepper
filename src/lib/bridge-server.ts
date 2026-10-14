import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Adventure, Player } from "./play";
export const bridgeHeaders = { "Cache-Control": "no-store" };
export class BridgeError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function secret() {
  return randomBytes(32).toString("base64url");
}
export function adminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new BridgeError("Server integration is not configured.", 503);
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export function check<T>(r: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (r.error)
    throw new BridgeError(
      r.error.message.includes("Rate limit")
        ? "Too many requests. Try again shortly."
        : "The story operation could not be completed. Check the session state and installed migrations.",
      r.error.message.includes("Rate limit") ? 429 : 409,
    );
  return r.data as NonNullable<T>;
}
export function bridgeFailure(e: unknown) {
  return Response.json(
    {
      error:
        e instanceof BridgeError
          ? e.message
          : e instanceof SyntaxError
            ? "Invalid JSON request."
            : e instanceof Error
              ? e.message
              : "Request failed",
    },
    {
      status: e instanceof BridgeError ? e.status : 400,
      headers: bridgeHeaders,
    },
  );
}
export async function bridgeUser(req: Request, db: SupabaseClient) {
  const token = req.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!token)
    throw new BridgeError("Connect your LoreKeeper account first.", 401);
  const u = check(await db.rpc("authenticate_gpt", { hash: hash(token) }));
  if (!u)
    throw new BridgeError(
      "Connection expired. Sign in to LoreKeeper again.",
      401,
    );
  return String(u);
}
export async function sessionFor(db: SupabaseClient, id: string, user: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id))
    throw new BridgeError("Session unavailable.", 404);
  const s = await db
    .from("adventures")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user)
    .maybeSingle();
  if (s.error || !s.data) throw new BridgeError("Session unavailable.", 404);
  if (s.data.ai_mode !== "chatgpt")
    throw new BridgeError("Choose ChatGPT mode in the lobby first.", 409);
  const players = check(
    await db.from("adventure_players").select("*").eq("adventure_id", id),
  );
  return { story: s.data as Adventure, players: players as Player[] };
}
export async function readBody(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new BridgeError("Missing request body.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    length += r.value.byteLength;
    if (length > 400000) {
      await reader.cancel();
      throw new BridgeError("Request is too large.", 413);
    }
    chunks.push(r.value);
  }
  const bytes = new Uint8Array(length);
  let i = 0;
  for (const c of chunks) {
    bytes.set(c, i);
    i += c.length;
  }
  const text = new TextDecoder().decode(bytes);
  if (text.length > 98000) throw new BridgeError("Request is too large.", 413);
  return text;
}
export function oauthConfig() {
  const client = process.env.LORE_GPT_CLIENT_ID,
    secret = process.env.LORE_GPT_CLIENT_SECRET,
    redirect = process.env.LORE_GPT_REDIRECT_URI;
  if (!client || !secret || !redirect)
    throw new BridgeError(
      "The app owner must configure the ChatGPT connection first.",
      503,
    );
  if (
    !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\/aip\/g-[A-Za-z0-9_-]+\/oauth\/callback$/.test(
      redirect,
    )
  )
    throw new BridgeError("OAuth callback is not configured correctly.", 503);
  return { client, secret, redirect };
}
export function sameSecret(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
