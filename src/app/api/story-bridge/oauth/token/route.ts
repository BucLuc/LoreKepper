import {
  adminClient,
  oauthConfig,
  sameSecret,
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
    const raw = await readBody(req),
      b = req.headers.get("content-type")?.includes("application/json")
        ? JSON.parse(raw)
        : Object.fromEntries(new URLSearchParams(raw)),
      config = oauthConfig();
    let client = b.client_id,
      password = b.client_secret;
    const basic = req.headers.get("authorization");
    if (basic?.startsWith("Basic ")) {
      const decoded = Buffer.from(basic.slice(6), "base64").toString();
      const at = decoded.indexOf(":");
      client = decoded.slice(0, at);
      password = decoded.slice(at + 1);
    }
    if (
      client !== config.client ||
      typeof password !== "string" ||
      !sameSecret(password, config.secret)
    )
      throw new BridgeError("Invalid OAuth client.", 401);
    const db = adminClient(),
      access = secret(),
      refresh = secret();
    let user;
    if (b.grant_type === "authorization_code") {
      if (b.redirect_uri !== config.redirect || typeof b.code !== "string")
        throw new BridgeError("Invalid authorization grant.");
      user = check(
        await db.rpc("exchange_gpt_code", {
          hash: hash(b.code),
          redirect: config.redirect,
        }),
      );
      if (!user)
        throw new BridgeError(
          "Authorization code expired or already used.",
          401,
        );
      check(
        await db.from("gpt_connections").insert({
          user_id: user,
          access_hash: hash(access),
          refresh_hash: hash(refresh),
          access_expires: new Date(Date.now() + 3600000).toISOString(),
          refresh_expires: new Date(Date.now() + 2592000000).toISOString(),
        }),
      );
    } else if (
      b.grant_type === "refresh_token" &&
      typeof b.refresh_token === "string"
    ) {
      user = check(
        await db.rpc("rotate_gpt_refresh", {
          hash: hash(b.refresh_token),
          access: hash(access),
          refresh: hash(refresh),
        }),
      );
      if (!user)
        throw new BridgeError("Connection expired. Sign in again.", 401);
    } else throw new BridgeError("Unsupported OAuth grant.");
    return Response.json(
      {
        access_token: access,
        refresh_token: refresh,
        token_type: "Bearer",
        expires_in: 3600,
        scope: "stories:read stories:write",
      },
      { headers: bridgeHeaders },
    );
  } catch (e) {
    return bridgeFailure(e);
  }
}
