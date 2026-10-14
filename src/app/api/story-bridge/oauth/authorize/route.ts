import { createClient } from "@supabase/supabase-js";
import {
  adminClient,
  oauthConfig,
  secret,
  hash,
  check,
  bridgeFailure,
  bridgeHeaders,
  readBody,
  BridgeError,
} from "@/lib/bridge-server";
export async function POST(req: Request) {
  try {
    const b = JSON.parse(await readBody(req)),
      config = oauthConfig();
    if (
      b.client_id !== config.client ||
      b.redirect_uri !== config.redirect ||
      b.response_type !== "code" ||
      typeof b.state !== "string" ||
      !b.state ||
      b.state.length > 2000
    )
      throw new BridgeError("Invalid connection request.");
    const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new BridgeError("Sign in to LoreKeeper first.", 401);
    const auth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data.user)
      throw new BridgeError("Sign in to LoreKeeper first.", 401);
    const code = secret(),
      db = adminClient();
    check(
      await db.from("gpt_oauth_codes").insert({
        user_id: data.user.id,
        code_hash: hash(code),
        redirect_uri: config.redirect,
      }),
    );
    const url = new URL(config.redirect);
    url.searchParams.set("code", code);
    url.searchParams.set("state", b.state);
    return Response.json(
      { redirect: url.toString() },
      { headers: bridgeHeaders },
    );
  } catch (e) {
    return bridgeFailure(e);
  }
}
