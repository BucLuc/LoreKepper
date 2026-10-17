"use client";
import { useEffect, useState } from "react";
import { playApi } from "@/lib/play-client";
import { providerName, providers } from "@/lib/ai-config";
import { ChatGPTConnectionSettings } from "./chatgpt-connection-settings";
import { Icon } from "./icon";
import { SkeletonLines } from "./vault-ui";
export function AISettings() {
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState("groq"),
    [model, setModel] = useState(providers.groq.model),
    [key, setKey] = useState(""),
    [keys, setKeys] = useState<{ provider: string; model: string }[]>([]),
    [shared, setShared] = useState(false),
    [aiLoaded, setAiLoaded] = useState(false),
    [usage, setUsage] = useState(0);
  useEffect(() => {
    let alive = true;
    playApi("aiSettings")
      .then((r) => {
        if (!alive) return;
        setKeys(r.keys);
        setShared(r.shared);
        setUsage(r.usage[0]?.units || 0);
        setAiLoaded(true);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  const saved = keys.some((k) => k.provider === provider);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="ai-access" className="lk-profile-ai">
      <ChatGPTConnectionSettings />
      <h2>AI API access</h2>
      <p>Manage the AI used for API stories and chat voice transformations.</p>
      {error && (
        <p className="lk-alert is-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="lk-alert is-success" role="status">
          {notice}
        </p>
      )}
      <div className="lk-ai-layout">
        <section className="lk-settings-card">
          <div className="lk-ai-status">
            <span
              className={aiLoaded && (keys.length || shared) ? "is-ready" : ""}
            />
            {!aiLoaded && !error ? (
              <SkeletonLines lines={2} label="Checking AI access" />
            ) : (
            <div>
              <strong>
                {!aiLoaded
                  ? "Unable to load AI access"
                  : keys.length
                    ? `${keys.length} personal key${keys.length === 1 ? "" : "s"} connected`
                    : shared
                      ? "Shared AI is ready"
                      : "Connect AI to start a story"}
              </strong>
              <small>
                {keys.length
                  ? "Choose which one writes when you set up a story."
                  : shared
                    ? "You can begin an adventure without a personal key."
                    : "Ordinary chat works without AI."}
              </small>
            </div>
            )}
          </div>
          {keys.length > 0 && (
            <ul className="lk-ai-keys">
              {keys.map((k) => (
                <li key={k.provider}>
                  <span>
                    <strong>{providerName(k.provider)}</strong>
                    <small>{k.model}</small>
                  </span>
                  <button
                    type="button"
                    className="lk-text-button"
                    disabled={busy}
                    onClick={() => {
                      setProvider(k.provider);
                      setModel(k.model);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="lk-text-button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await playApi("saveAI", { remove: true, provider: k.provider });
                        setKeys((all) => all.filter((x) => x.provider !== k.provider));
                        setNotice(`${providerName(k.provider)} key removed.`);
                      })
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="lk-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await playApi("saveAI", { provider, model, key });
                setKey("");
                setKeys((all) => [{ provider, model }, ...all.filter((x) => x.provider !== provider)]);
                setNotice(`${providerName(provider)} key saved.`);
              });
            }}
          >
            <label>
              Provider
              <select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setModel(providers[e.target.value].model);
                }}
              >
                {Object.keys(providers).map((p) => (
                  <option key={p} value={p}>
                    {providerName(p)}
                    {keys.some((k) => k.provider === p) ? " · saved" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {saved ? "Replace API key" : "API key"}
              <input
                type="password"
                autoComplete="new-password"
                value={key}
                maxLength={500}
                required={!saved}
                onChange={(e) => setKey(e.target.value)}
                placeholder={
                  saved
                    ? "Leave blank to keep your saved key"
                    : "Paste your provider’s API key"
                }
              />
            </label>
            <details className="lk-disclosure">
              <summary>
                Model settings <span>{model}</span>
              </summary>
              <label>
                Model ID
                <input
                  value={model}
                  required
                  maxLength={150}
                  onChange={(e) => setModel(e.target.value)}
                />
              </label>
            </details>
            <button
              className="lk-button is-primary"
              disabled={busy || !aiLoaded}
            >
              {busy ? "Saving…" : saved ? `Update ${providerName(provider)} key` : `Add ${providerName(provider)} key`}
            </button>
          </form>
        </section>
        <aside className="lk-ai-help">
          <h2>One key. A whole party.</h2>
          <p>
            The story’s creator picks which AI writes it — the shared one,
            ChatGPT, or any of their keys. Friends only need to join.
          </p>
          <p>
            Personal keys are encrypted and never shared with other players.
          </p>
          <div>
            <span className="lk-kicker">TODAY’S USAGE</span>
            <strong>
              {aiLoaded ? usage : "—"} <small>units</small>
            </strong>
            <p>A story scene uses 6 units. A chat transformation uses 1.</p>
          </div>
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
            className="lk-text-button"
          >
            Get a Groq API key <Icon name="arrow" />
          </a>
        </aside>
      </div>
    </section>
  );
}
