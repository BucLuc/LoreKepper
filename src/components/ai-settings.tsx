"use client";
import { useEffect, useState } from "react";
import { playApi } from "@/lib/play-client";
import { providers } from "@/lib/ai-config";
import { ChatGPTConnectionSettings } from "./chatgpt-connection-settings";
import { Icon } from "./icon";
export function AISettings() {
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState("groq"),
    [model, setModel] = useState(providers.groq.model),
    [key, setKey] = useState(""),
    [settings, setSettings] = useState<{
      provider: string;
      model: string;
    } | null>(null),
    [shared, setShared] = useState(false),
    [aiLoaded, setAiLoaded] = useState(false),
    [usage, setUsage] = useState(0);
  useEffect(() => {
    let alive = true;
    playApi("aiSettings")
      .then((r) => {
        if (!alive) return;
        setSettings(r.settings);
        setShared(r.shared);
        setUsage(r.usage[0]?.units || 0);
        if (r.settings) {
          setProvider(r.settings.provider);
          setModel(r.settings.model);
        }
        setAiLoaded(true);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
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
              className={aiLoaded && (settings || shared) ? "is-ready" : ""}
            />
            <div>
              <strong>
                {!aiLoaded
                  ? error
                    ? "Unable to load AI access"
                    : "Checking AI access…"
                  : settings
                    ? "Your personal key is connected"
                    : shared
                      ? "Shared AI is ready"
                      : "Connect AI to start a story"}
              </strong>
              <small>
                {settings
                  ? `${settings.provider} · ${settings.model}`
                  : shared
                    ? "You can begin an adventure without a personal key."
                    : "Ordinary chat works without AI."}
              </small>
            </div>
          </div>
          <form
            className="lk-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await playApi("saveAI", { provider, model, key });
                setKey("");
                setSettings({ provider, model });
                setNotice("AI settings saved.");
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
                    {p === "groq"
                      ? "Groq"
                      : p === "gemini"
                        ? "Google Gemini"
                        : p === "openai"
                          ? "OpenAI"
                          : p === "anthropic"
                            ? "Anthropic"
                            : "OpenRouter"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {settings ? "Replace API key" : "API key"}
              <input
                type="password"
                autoComplete="new-password"
                value={key}
                maxLength={500}
                required={!settings || settings.provider !== provider}
                onChange={(e) => setKey(e.target.value)}
                placeholder={
                  settings
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
              {busy ? "Saving…" : "Save AI settings"}
            </button>
            {settings && (
              <button
                type="button"
                className="lk-text-button"
                disabled={busy || !aiLoaded}
                onClick={() =>
                  void run(async () => {
                    await playApi("saveAI", { remove: true });
                    setSettings(null);
                    setNotice(
                      "Personal key removed. Shared AI will be used when available.",
                    );
                  })
                }
              >
                Remove personal key
              </button>
            )}
          </form>
        </section>
        <aside className="lk-ai-help">
          <h2>One key. A whole party.</h2>
          <p>
            The story’s creator provides AI access for the adventure. Friends
            only need to join.
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
