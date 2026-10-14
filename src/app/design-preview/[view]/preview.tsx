"use client";
import { useState } from "react";
import { AdventureExperience } from "@/components/adventure-experience";
import { PlayHub } from "@/components/play-hub";
import { presetDesign } from "@/lib/edition-design";
import { defaultVoice, type Adventure, type Player } from "@/lib/play";
const now = "2026-10-14T10:00:00.000Z";
const players: Player[] = [
  { user_id: "u1", name: "Luc", character: null, identity_name: "Aldric" },
  { user_id: "u2", name: "Liri", character: null, identity_name: "Maren" },
];
function mockStory(edition: string, view: string): Adventure {
  const fresh = view === "lobby-new";
  return {
    id: "preview-story",
    owner_id: "u1",
    title: fresh ? "" : "The Lantern of Vael Tor",
    status: view === "play" ? "active" : fresh ? "lobby" : "paused",
    mode: "multiplayer",
    ai_mode: "api",
    world:
      "A drowned kingdom where the tide never fully recedes, and the bells of sunken chapels still ring at dusk.",
    voice: defaultVoice,
    edition,
    design: presetDesign(edition),
    summary: "",
    revision: 3,
    created_at: now,
    segments: fresh
      ? []
      : [
          {
            created: "2026-10-13T10:00:00.000Z",
            narrative:
              "## Chapter I: The Bells Beneath\n\nThe tide had already swallowed the lower stairs by the time Aldric reached the chapel. Salt crusted the iron gate, and somewhere below the black water a bell rang once — slow, deliberate, as if someone were still pulling the rope.\n\nMaren held the lantern higher. Its light did not reach the far wall, but it reached far enough to show the footprints: small, bare, and leading *down* into the water.\n\n‘Nobody walks into the sea on purpose,’ she whispered.",
            questions: [
              {
                player: "u1",
                text: "The gate is locked, but the chain is rusted thin. What does Aldric do?",
                answer: "I break the chain with the hilt of my sword and step inside first.",
              },
              {
                player: "u2",
                text: "Maren notices a mark carved into the gatepost. How does she react?",
                answer: "She traces it with her finger and quietly pockets a flake of the stone.",
              },
            ],
          },
          {
            created: "2026-10-14T09:00:00.000Z",
            narrative:
              "The chain gave with a sound like a cough. Inside, the chapel smelled of kelp and candle smoke, which made no sense at all, since every candle had drowned a century ago.\n\nYet one was burning.\n\nIt stood on the altar in a puddle of its own wax, and beside it lay a lantern of green glass, unlit, humming faintly like a hive. Maren's pocket grew warm where the stone flake rested. The bell rang again — closer now — and the water at the threshold began, very politely, to rise.",
            questions: [
              {
                player: "u1",
                text: "The water is rising and the green lantern hums on the altar. What do you do?",
              },
              {
                player: "u2",
                text: "The stone in Maren's pocket is burning hot. What does she do with it?",
              },
            ],
          },
        ],
  };
}
export function DesignPreview({ view, edition }: { view: string; edition: string }) {
  const [story, setStory] = useState(() => mockStory(edition, view));
  const noop = async () => {};
  if (view === "library")
    return (
      <PlayHub
        tab="stories"
        initialHome={{
          user: "u1",
          characters: [],
          chats: [],
          collections: [],
          adventures: ["gallery-codex", "glorious", "captain", "gallery-chancery", "terminal"].map(
            (e, i) => ({
              ...mockStory(e, "play"),
              id: `s${i}`,
              title: ["The Lantern of Vael Tor", "Ashes of the Ninth Crown", "The Salt Debt", "Starlight Over Orrin", "Protocol: Midnight"][i],
              status: (["active", "completed", "paused", "lobby", "active"] as const)[i],
            }),
          ),
        }}
      />
    );
  return (
    <AdventureExperience
      story={story}
      players={players}
      user="u1"
      busy={false}
      generating={false}
      online
      error=""
      initialLobby={view !== "play"}
      onGenerate={noop}
      onAnswer={async (answer) =>
        setStory((s) => ({
          ...s,
          segments: s.segments.map((seg, i) =>
            i === s.segments.length - 1
              ? { ...seg, questions: seg.questions.map((q) => (q.player === "u1" ? { ...q, answer } : q)) }
              : seg,
          ),
        }))
      }
      onStatus={noop}
      onInvite={async () => "https://example.com/join/abc"}
      onArmChatGPT={noop}
      onConfigure={async (settings) => setStory((s) => ({ ...s, ...settings }))}
      onInviteUser={noop}
    />
  );
}
