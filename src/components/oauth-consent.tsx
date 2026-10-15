"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
type Details = {
  client: { name: string; uri: string };
  user: { email: string };
  scope: string;
};
// Consent screen for Supabase Auth's OAuth 2.1 server (Authentication → OAuth Server →
// Authorization path). ChatGPT lands here when a user connects the Lorekeeper app.
export function OAuthConsent({ authorizationId }: { authorizationId: string }) {
  const [state, setState] = useState<
    "loading" | "signin" | "consent" | "error"
  >("loading");
  const [details, setDetails] = useState<Details>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!authorizationId) {
        setError("This page opens when you connect Lorekeeper from ChatGPT.");
        return setState("error");
      }
      const { data } = await supabase().auth.getSession();
      if (!alive) return;
      if (!data.session) return setState("signin");
      const r = await supabase().auth.oauth.getAuthorizationDetails(
        authorizationId,
      );
      if (!alive) return;
      if (r.error) {
        setError(r.error.message);
        setState("error");
      } else if ("redirect_url" in r.data) {
        // Already approved earlier: go straight back to ChatGPT.
        window.location.assign(r.data.redirect_url);
      } else {
        setDetails(r.data);
        setState("consent");
      }
    })();
    return () => {
      alive = false;
    };
  }, [authorizationId]);
  const decide = async (approve: boolean) => {
    setBusy(true);
    setError("");
    const oauth = supabase().auth.oauth;
    const r = approve
      ? await oauth.approveAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        })
      : await oauth.denyAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        });
    if (r.error) {
      setError(r.error.message);
      setBusy(false);
    } else window.location.assign(r.data.redirect_url);
  };
  const next = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
  return (
    <main id="main" className="lk-page">
      <section className="lk-settings-card lk-connect-card">
        <span className="lk-kicker">CONNECT AN APP</span>
        <h1>
          {details
            ? `Allow ${details.client.name || "ChatGPT"} to use Lorekeeper?`
            : "Connect to Lorekeeper"}
        </h1>
        {error && (
          <p role="alert" className="lk-alert">
            {error}
          </p>
        )}
        {state === "loading" && <p>Checking your account…</p>}
        {state === "signin" && (
          <Link
            className="lk-button is-primary"
            href={`/login?next=${encodeURIComponent(next)}`}
          >
            Sign in to Lorekeeper
          </Link>
        )}
        {state === "consent" && details && (
          <>
            <p>
              It will be able to read the settings and history of stories owned
              by <strong>{details.user.email}</strong>, save new chapters to
              them, and add new stories to your library.
            </p>
            <p>
              Story data it reads is processed by OpenAI under its own privacy
              policy. Only connect stories whose other players are aware of
              this. See our{" "}
              <Link href="/privacy#chatgpt" target="_blank">
                Privacy Policy
              </Link>
              .
            </p>
            <p>You can disconnect anytime in Profile → Account settings.</p>
            <div className="lk-handoff-actions">
              <button
                className="lk-button is-primary"
                disabled={busy}
                onClick={() => void decide(true)}
              >
                Allow
              </button>
              <button
                className="lk-button"
                disabled={busy}
                onClick={() => void decide(false)}
              >
                Deny
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
