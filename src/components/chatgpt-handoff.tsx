"use client";
import { useState } from "react";
import Link from "next/link";
import type { Adventure, Player } from "@/lib/play";
export function ChatGPTHandoff({
  story,
  players,
  compact = false,
  pending = false,
}: {
  story: Adventure;
  players: Player[];
  compact?: boolean;
  pending?: boolean;
}) {
  const [notice, setNotice] = useState("");
  const waiting =
      story.segments.at(-1)?.questions.filter((q) => !q.answer) || [],
    ready = story.status === "active" && !waiting.length,
    writing = !!story.draft?.parts.length;
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied.");
    } catch {
      setNotice("Copy failed. Select the session ID and copy it manually.");
    }
  };
  const content = (
    <div className="lk-handoff-content">
      <p>
        {story.status === "completed"
          ? "This story is complete."
          : writing
            ? "ChatGPT is writing the next chapter into the story."
            : !story.segments.length
              ? "In ChatGPT, with the Lorekeeper app enabled, send the start command below."
              : waiting.length
                ? `Waiting for ${waiting.map((q) => players.find((p) => p.user_id === q.player)?.name || "a player").join(", ")} to answer.`
                : "All answers are saved. Write Continue in the same ChatGPT conversation."}
      </p>
      <label>
        Session ID
        <input value={story.id} readOnly onFocus={(e) => e.target.select()} />
      </label>
      <div className="lk-handoff-actions">
        <button disabled={pending} onClick={() => void copy(story.id)}>
          Copy ID
        </button>
        <button
          disabled={pending}
          onClick={() => void copy(`Start: ${story.id}`)}
        >
          Copy start command
        </button>
      </div>
      <small>
        ChatGPT writes each chapter freely and saves it here; chapters appear
        automatically. No OpenAI API key is used.{" "}
        <Link href="/profile?tab=settings#chatgpt-connection">
          Connection setup
        </Link>
      </small>
      {notice && <p role="status">{notice}</p>}
    </div>
  );
  return compact ? (
    <details className="lk-chatgpt-handoff">
      <summary>
        ChatGPT ·{" "}
        {writing
          ? "Writing…"
          : waiting.length
          ? "Waiting for answers"
          : ready && story.segments.length
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
