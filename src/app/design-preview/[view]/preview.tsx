"use client";
import { useState } from "react";
import { AdventureExperience } from "@/components/adventure-experience";
import { PlayHub } from "@/components/play-hub";
import { presetDesign } from "@/lib/edition-design";
import { Reader } from "@/components/reader";
import { ArchiveSkeleton } from "@/components/vault-ui";
import { ChatHall } from "@/components/chat-hall";
import { PlayChat } from "@/components/play-chat";
import { defaultVoice, storyEntry, type Adventure, type Player } from "@/lib/play";
const now = "2026-10-14T10:00:00.000Z";
const players: Player[] = [
  { user_id: "u1", name: "Luc", character: null, identity_name: "Aldric" },
  { user_id: "u2", name: "Liri", character: null, identity_name: "Maren" },
];
function mockStory(edition: string, view: string, pages = false): Adventure {
  const setup = view.startsWith("setup");
  const fresh = view === "lobby-new" || setup;
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
    design: { ...presetDesign(edition), pages },
    summary: "",
    revision: 3,
    created_at: now,
    // "setup-3" opens the third step; "setup-guest" shows it to an invited player.
    setup: setup
      ? { step: Number(view.split("-")[1]) || 1, theme: view === "setup" || view === "setup-1" ? null : "pirate", quest: "custom" }
      : fresh
        ? { step: 4, done: true, theme: "pirate" }
        : null,
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
// ChatGPT halfway through the next chapter, after everyone answered.
function writingStory(edition: string, pages: boolean): Adventure {
  const story = mockStory(edition, "play", pages);
  const answers = ["I snatch the green lantern before the water reaches the altar.", "She drops the stone into the rising water."];
  return {
    ...story,
    ai_mode: "chatgpt",
    segments: story.segments.map((s, i) =>
      i === story.segments.length - 1 ? { ...s, questions: s.questions.map((q, j) => ({ ...q, answer: answers[j] })) } : s,
    ),
    draft: {
      parts: [
        "## Chapter III: What the Water Wanted\n\nThe lantern was warm in Aldric's hands, warmer than any glass had a right to be.",
        "The stone hissed as it sank. For a heartbeat the whole chapter held its breath — and then, very slowly, the water began to draw back.",
      ],
    },
  };
}
export function DesignPreview({ view, edition, pages = false }: { view: string; edition: string; pages?: boolean }) {
  const [story, setStory] = useState(() => (view === "writing" ? writingStory(edition, pages) : mockStory(edition, view, pages)));
  const [cast, setCast] = useState(players);
  const noop = async () => {};
  if (view === "skeleton") return <ArchiveSkeleton page="lobby" />;
  if (view === "chat-hall")
    return (
      <ChatHall
        me="u1"
        initialHall={{
          chats: [
            { id: "c1", kind: "direct", title: "", created_at: now, partner: { id: "u2", name: "Liri" }, unread: 2, last: { text: "Liri has invited you to “The Salt Debt”.", kind: "invite", from: "u2", at: now } },
            { id: "c2", kind: "direct", title: "", created_at: now, partner: { id: "u3", name: "Bram" }, unread: 0, last: { text: "Then the goose took the crown. I am not joking.", kind: "text", from: "u1", at: "2026-10-12T18:00:00.000Z" } },
          ],
          people: [
            { id: "u4", name: "Cassia" },
            { id: "u5", name: "Dorian" },
            { id: "u6", name: "Elowen" },
            { id: "u7", name: "Fenwick" },
          ],
        }}
      />
    );
  if (view === "chat")
    return (
      <PlayChat
        id="c1"
        initialUser="u1"
        initialData={{
          chat: { title: "Luc & Liri", owner_id: "u1", kind: "direct" },
          players: [
            { user_id: "u1", name: "Luc" },
            { user_id: "u2", name: "Liri" },
          ],
          messages: [
            { id: "m1", user_id: "u2", name: "Liri", original: "Did you see what happened in the chapel?", content: "Did you see what happened in the chapel?", status: "sent", character: null, created_at: "2026-10-16T19:00:00.000Z" },
            { id: "m2", user_id: "u1", name: "Luc", original: "yes and it was terrifying", content: "Aye, I saw it, and me blood ran colder than a kraken's breakfast!", status: "sent", meta: { mode: "rewrite", voice: "Pirate Captain" }, reply_to: "m1", character: null, created_at: "2026-10-16T19:01:00.000Z" },
            { id: "m3", user_id: "u2", name: "Liri", original: "Liri has invited you to “The Salt Debt”.", content: "Liri has invited you to “The Salt Debt”.", status: "sent", kind: "invite", meta: { adventure: "preview-story", title: "The Salt Debt", theme: "pirate" }, character: null, created_at: now },
            { id: "m4", user_id: "u1", name: "Luc", original: "distract her with a story about geese", content: null, status: "pending", meta: { mode: "instruct", voice: "Royal Herald" }, character: null, created_at: now },
          ],
        }}
      />
    );
  if (view === "reader") {
    // Long enough to span several A4 pages in every edition.
    const chapters = mockStory(edition, "play").segments.map((s) => s.narrative);
    const long = Array.from({ length: 4 }, (_, i) => chapters.join("\n\n").replace("Chapter I", `Chapter ${["I", "II", "III", "IV"][i]}`)).join("\n\n");
    return <Reader entry={storyEntry({ ...mockStory(edition, "play"), segments: [{ narrative: long, questions: [], created: now }] }, players, false)} previous={null} next={null} />;
  }
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
      players={cast}
      user={view === "setup-guest" ? "u2" : "u1"}
      busy={false}
      generating={false}
      online
      error=""
      initialLobby={view !== "play" && view !== "writing"}
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
      onConfigure={async ({ aiMode, aiProvider, ...settings }) =>
        setStory((s) => ({ ...s, ...settings, ai_mode: aiMode, ai_provider: aiProvider, revision: s.revision + 1 }))
      }
      onPlayer={async (player, c) =>
        setCast((all) => all.map((p) => (p.user_id === player ? { ...p, identity_name: c.name, description: c.description, voice: c.voice } : p)))
      }
      onInviteUser={noop}
    />
  );
}
