"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
type Grant = { client: { id: string; name: string }; granted_at: string };
export const mcpServerUrl = () =>
  `${(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/lorekeeper-mcp`;
export function ChatGPTConnectionSettings() {
  const [grants, setGrants] = useState<Grant[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let alive = true;
    supabase()
      .auth.oauth.listGrants()
      .then((r) => {
        if (!alive) return;
        // Fails when the OAuth server is not enabled yet; the setup guide covers that.
        if (r.error) setError("Connected apps are unavailable until the Supabase OAuth server is enabled.");
        else setGrants(r.data);
        setLoaded(true);
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
      <h2>ChatGPT</h2>
      <p>
        Add Lorekeeper to ChatGPT as an app (MCP connector), then choose
        ChatGPT in a story lobby and send <code>Start: session-id</code> and{" "}
        <code>Continue</code> there. No AI provider key is needed.
      </p>
      <label>
        MCP server URL
        <input
          value={mcpServerUrl()}
          readOnly
          onFocus={(e) => e.target.select()}
        />
      </label>
      <strong>
        {!loaded
          ? "Checking connections…"
          : grants.length
            ? `Connected: ${grants.map((g) => g.client.name || "ChatGPT").join(", ")}`
            : "Not connected yet"}
      </strong>
      <div className="lk-handoff-actions">
        <Link href="/chatgpt-setup.md" target="_blank">
          Step-by-step setup guide
        </Link>
        {grants.map((g) => (
          <button
            key={g.client.id}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await supabase().auth.oauth.revokeGrant({
                clientId: g.client.id,
              });
              if (r.error) setError(r.error.message);
              else {
                setGrants((all) => all.filter((x) => x !== g));
                setNotice(
                  "Disconnected. ChatGPT asks you to sign in again next time.",
                );
              }
              setBusy(false);
            }}
          >
            Disconnect {g.client.name || "ChatGPT"}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
