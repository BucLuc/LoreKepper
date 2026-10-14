"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { playApi } from "@/lib/play-client";
export function ChatGPTConnectionSettings() {
  const [connected, setConnected] = useState(false),
    [configured, setConfigured] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let alive = true;
    playApi("chatGPTConnection")
      .then((r) => {
        if (alive) {
          setConnected(r.connected);
          setConfigured(r.configured);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <section
      id="chatgpt-connection"
      className="lk-settings-card lk-gpt-settings"
    >
      <h2>ChatGPT web chat</h2>
      <p>
        Use a connected Custom GPT as your narrator. No AI provider key is
        needed for this mode.
      </p>
      <strong>
        {!loaded
          ? "Checking connection…"
          : connected
            ? "Your ChatGPT connection is active"
            : configured
              ? "Ready to connect from your GPT"
              : "App owner setup required"}
      </strong>
      <p>
        Choose ChatGPT web chat in a story lobby, then use{" "}
        <code>start: session-id</code> and <code>continue</code> in your GPT.
      </p>
      <div className="lk-handoff-actions">
        <Link href="/chatgpt-setup.md" target="_blank">
          Step-by-step setup guide
        </Link>
        <Link href="/api/story-bridge/openapi" target="_blank">
          Action schema
        </Link>
        <Link href="/chatgpt-gpt-instructions.md" target="_blank">
          GPT instructions
        </Link>
        {connected && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await playApi("disconnectChatGPT");
                setConnected(false);
                setNotice(
                  "Disconnected. Connect again from ChatGPT when you want to return.",
                );
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not disconnect",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Disconnect ChatGPT
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
