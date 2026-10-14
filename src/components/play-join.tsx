"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { playApi } from "@/lib/play-client";
import { supabase } from "@/lib/supabase";
import { Icon } from "./icon";
export function PlayJoin({ token }: { token: string }) {
  const router = useRouter(),
    [signedIn, setSignedIn] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (alive) setSignedIn(!!data.session);
      });
    const {
      data: { subscription },
    } = supabase().auth.onAuthStateChange((_event, session) => {
      if (alive) setSignedIn(!!session);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  return (
    <main id="main" className="lk-page lk-join">
      <section className="lk-settings-card">
        <span className="lk-join-icon">
          <Icon name="users" />
        </span>
        <span className="lk-kicker">THERE’S A PLACE FOR YOU</span>
        <h1>Join your companions.</h1>
        <p className="lk-hint">
          You’ve been invited to a private adventure or conversation. You don’t
          need an AI key to play with friends.
        </p>
        {error && (
          <p className="lk-alert" role="alert">
            {error}
          </p>
        )}
        {signedIn === null ? (
          <p className="lk-hint">Checking your sign-in…</p>
        ) : signedIn ? (
          <button
            className="lk-button is-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await playApi("join", { token });
                router.push(
                  `/${r.kind === "chat" ? "chat" : "interactive"}/${r.id}`,
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not join.");
                setBusy(false);
              }
            }}
          >
            {busy ? "Joining…" : "Accept invitation"}
            <Icon name="arrow" />
          </button>
        ) : (
          <>
            <Link
              className="lk-button is-primary"
              href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}
            >
              Sign in to join <Icon name="arrow" />
            </Link>
            <small className="lk-hint">
              You’ll return here after signing in.
            </small>
          </>
        )}
        <Link href="/interactive" className="lk-text-button">
          Back to your adventures
        </Link>
      </section>
    </main>
  );
}
