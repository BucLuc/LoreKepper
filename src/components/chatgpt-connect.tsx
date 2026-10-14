"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
export function ChatGPTConnect({
  request,
}: {
  request: {
    client_id: string;
    redirect_uri: string;
    state: string;
    response_type: string;
  };
}) {
  const [user, setUser] = useState(false),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    supabase()
      .auth.getSession()
      .then((r) => {
        if (alive) {
          setUser(!!r.data.session);
          setLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  const next = "/connect/chatgpt?" + new URLSearchParams(request).toString();
  return (
    <main id="main" className="lk-page">
      <section className="lk-settings-card lk-connect-card">
        <span className="lk-kicker">CHATGPT CONNECTION</span>
        <h1>Connect your story worlds</h1>
        <p>
          Your GPT can read settings and answers in stories you own, save the
          next scene, and import a complete story into your account.
        </p>
        <p>
          Your Supabase credentials and AI provider keys stay on the server.
          Disconnect anytime in Profile → Account settings.
        </p>
        {error && (
          <p role="alert" className="lk-alert">
            {error}
          </p>
        )}
        {!request.client_id || !request.state ? (
          <p>
            Open your Custom GPT and use an action to start the connection. See{" "}
            <Link href="/profile?tab=settings#chatgpt-connection">
              profile settings
            </Link>{" "}
            for setup.
          </p>
        ) : !loaded ? (
          <p>Checking your account…</p>
        ) : !user ? (
          <Link
            className="lk-button is-primary"
            href={`/login?next=${encodeURIComponent(next)}`}
          >
            Sign in to LoreKeeper
          </Link>
        ) : (
          <button
            className="lk-button is-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const { data } = await supabase().auth.getSession();
                const r = await fetch("/api/story-bridge/oauth/authorize", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${data.session?.access_token}`,
                  },
                  body: JSON.stringify(request),
                });
                const b = await r.json();
                if (!r.ok) throw new Error(b.error);
                window.location.assign(b.redirect);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not connect");
                setBusy(false);
              }
            }}
          >
            Connect this account
          </button>
        )}
      </section>
    </main>
  );
}
