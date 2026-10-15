import "server-only";
import { createClient } from "@supabase/supabase-js";
import { legal } from "@/lib/legal";

// Public sign-up is disabled: the only way to create an account is a valid
// collection invitation, redeemed here with the server-only service role.
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      throw new Error(
        "Configure the server-only SUPABASE_SERVICE_ROLE_KEY to enable invitations.",
      );
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 10_000)
      return Response.json(
        { error: "Request too large." },
        { status: 413, headers },
      );
    const b = JSON.parse(raw);
    if (typeof b.token !== "string" || !/^[a-f0-9]{64}$/.test(b.token))
      throw new Error("This invitation link is invalid.");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const preview = await admin.rpc("invite_preview", { token: b.token });
    if (preview.error) {
      console.error("Invitation check failed:", preview.error.message);
      throw new Error("This invitation could not be checked right now.");
    }
    if (!preview.data)
      throw new Error("This invitation is invalid, revoked or expired.");
    if (b.action === "check")
      return Response.json({ collection: preview.data }, { headers });
    if (b.action !== "register") throw new Error("Unknown invitation action.");
    const email = typeof b.email === "string" ? b.email.trim() : "";
    const password = typeof b.password === "string" ? b.password : "";
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new Error("Enter a valid email address.");
    if (password.length < 8 || password.length > 128)
      throw new Error("Choose a password of 8–128 characters.");
    if (!name || name.length > 100)
      throw new Error("Enter a name of 1–100 characters.");
    if (b.accepted !== true)
      throw new Error(
        "Accept the Terms of Service and Privacy Policy to create an account.",
      );
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      // Records which Terms and Privacy Policy version the user accepted, and when.
      user_metadata: {
        name,
        terms_version: legal.version,
        terms_accepted_at: new Date().toISOString(),
      },
    });
    if (created.error || !created.data.user)
      throw new Error(
        /already|exists|registered/i.test(created.error?.message || "")
          ? "An account with this email already exists. Sign in to accept the invitation."
          : created.error?.message || "Could not create your account.",
      );
    const joined = await admin.rpc("redeem_invite", {
      token: b.token,
      u: created.data.user.id,
    });
    if (joined.error) {
      // Never leave an account behind that no invitation admitted.
      await admin.auth.admin.deleteUser(created.data.user.id);
      throw new Error(joined.error.message);
    }
    return Response.json({ id: joined.data }, { headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Invitation request failed.",
      },
      { status: 400, headers },
    );
  }
}
