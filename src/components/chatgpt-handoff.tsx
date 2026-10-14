"use client";
import { useState } from "react";
import Link from "next/link";
import { playApi } from "@/lib/play-client";
import { storyMarkdown, type Adventure, type Player } from "@/lib/play";
export function ChatGPTHandoff({
  story,
  players,
  compact = false,
  canSave = false,
  pending = false,
}: {
  story: Adventure;
  players: Player[];
  compact?: boolean;
  canSave?: boolean;
  pending?: boolean;
}) {
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [paste, setPaste] = useState(false),
    [output, setOutput] = useState("");
  const waiting =
      story.segments.at(-1)?.questions.filter((q) => !q.answer) || [],
    ready = story.status === "active" && !waiting.length,
    master = players.find((p) => p.user_id === story.owner_id);
  const copy = async (kind: string) => {
    setBusy(true);
    try {
      let value = story.id;
      if (kind === "command") value = `start: ${story.id}`;
      else if (kind === "turn" || kind === "all") {
        const context = await playApi("handoffContext", { id: story.id });
        value = JSON.stringify(
          {
            ...context,
            ...(kind === "all"
              ? { completeStory: storyMarkdown(story, players, true) }
              : {}),
          },
          null,
          2,
        );
      }
      await navigator.clipboard.writeText(value);
      setNotice("Copied.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setBusy(false);
    }
  };
  const content = (
    <div className="lk-handoff-content">
      <p>
        {story.status === "completed"
          ? "This story is saved."
          : !story.segments.length
            ? "In your connected GPT, send start with this session ID."
            : waiting.length
              ? `Waiting for ${waiting.map((q) => players.find((p) => p.user_id === q.player)?.name || "a player").join(", ")} to answer.`
              : "All answers are ready. Write continue in your connected GPT."}
      </p>
      <label>
        Session ID
        <input value={story.id} readOnly onFocus={(e) => e.target.select()} />
      </label>
      <div className="lk-handoff-actions">
        <button disabled={busy || pending} onClick={() => void copy("id")}>
          Copy ID
        </button>
        <button disabled={busy || pending} onClick={() => void copy("command")}>
          Copy start command
        </button>
        <button disabled={busy || pending} onClick={() => void copy("turn")}>
          Copy current turn
        </button>
        <button disabled={busy || pending} onClick={() => void copy("all")}>
          Copy all information
        </button>
      </div>
      <small>
        Scenes appear here automatically when your GPT saves them. No OpenAI API
        key is used.{" "}
        <Link href="/profile?tab=settings#chatgpt-connection">
          Connection setup
        </Link>
      </small>
      {notice && <p role="status">{notice}</p>}
      {ready && canSave && (
        <button className="lk-text-button" onClick={() => setPaste((p) => !p)}>
          Paste a narrator response instead
        </button>
      )}
      {paste && (
        <div className="lk-form">
          <label>
            Complete response (Markdown + lore-state, or JSON)
            <textarea
              rows={6}
              maxLength={96000}
              value={output}
              onChange={(e) => setOutput(e.target.value)}
            />
          </label>
          <button
            className="lk-button"
            disabled={busy || !output.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await playApi("saveHandoff", {
                  id: story.id,
                  revision: story.revision,
                  requestId: crypto.randomUUID(),
                  output,
                });
                setPaste(false);
                setOutput("");
                setNotice("Scene saved.");
              } catch (e) {
                setNotice(e instanceof Error ? e.message : "Save failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save this scene
          </button>
          <small>Only {master?.name || "the creator"} can save a scene.</small>
        </div>
      )}
    </div>
  );
  return compact ? (
    <details className="lk-chatgpt-handoff">
      <summary>
        ChatGPT handoff ·{" "}
        {waiting.length
          ? "Waiting for answers"
          : ready
            ? "Ready to continue"
            : "Session information"}
      </summary>
      {content}
    </details>
  ) : (
    <section className="lk-chatgpt-handoff">
      <h2>Continue in ChatGPT</h2>
      {content}
    </section>
  );
}
