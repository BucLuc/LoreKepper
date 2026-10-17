"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Adventure, Player, Quest, StorySetup as Setup } from "@/lib/play";
import { playApi } from "@/lib/play-client";
import { providerName } from "@/lib/ai-config";
import { storyThemes, themeOf } from "@/lib/story-themes";
import { useNarratorPresets } from "./narrator-picker";
import { languages } from "./voice-settings";
import { Feedback } from "./feedback";
import { FellowshipList, InvitePanel, Seal } from "./story-party";
import { SkeletonCards } from "./vault-ui";
import { SurpriseButton, spinState, useSpin } from "./surprise";
import { useAIOptions, useQuests, useStoryForm, type PlayerCast, type StorySettings } from "./story-form";
import { Crumbs } from "./crumbs";
import { mcpServerUrl } from "./chatgpt-connection-settings";
const steps = [
  { name: "The Fellowship", eyebrow: "Gather your party", lede: "Summon your companions, name your heroes and choose who holds the quill." },
  { name: "The Realm", eyebrow: "Choose your theme", lede: "Every legend needs a realm. Pick one, or let the fates decide." },
  { name: "The Quest", eyebrow: "Choose your tale", lede: "A ready-made quest, one of your own, or none at all and let the narrator surprise you." },
  { name: "The Voice", eyebrow: "Choose who tells it", lede: "The same tale sounds wildly different in another voice." },
];
export function aiLabel(story: { ai_mode?: string; ai_provider?: string | null }) {
  if (story.ai_mode === "chatgpt") return "Written by ChatGPT";
  if (story.ai_provider === "shared") return "Lorekeeper's free AI";
  if (story.ai_provider) return `${providerName(story.ai_provider)} · your key`;
  return "Lorekeeper AI";
}
// The four steps before the lobby. Only the creator chooses; invited players watch
// every choice (and every Surprise me) arrive live.
export function StorySetup({
  story,
  players,
  user,
  busy,
  generating,
  error,
  onSave,
  onPlayer,
  onInvite,
  onInviteUser,
}: {
  story: Adventure;
  players: Player[];
  user: string;
  busy: boolean;
  generating: boolean;
  error: string;
  onSave: (settings: StorySettings) => Promise<void>;
  onPlayer: (player: string, cast: PlayerCast) => Promise<void>;
  onInvite: () => Promise<string>;
  onInviteUser: (id: string) => Promise<void>;
}) {
  const master = story.owner_id === user;
  const { form, update, dirty, saveError, setSaveError, flush } = useStoryForm({
    story,
    master,
    busy,
    generating,
    onSave,
  });
  const setup: Setup = form.setup || { step: 1 };
  const step = setup.step;
  const changeSetup = (change: Partial<Setup>, rest: Partial<StorySettings> = {}) =>
    update({ ...rest, setup: { ...setup, ...change } });
  const { presets, loaded: presetsLoaded } = useNarratorPresets();
  const { quests, loaded: questsLoaded } = useQuests();
  const spinner = useSpin();
  const [help, setHelp] = useState(false),
    [otherVoices, setOtherVoices] = useState(false),
    [conjuring, setConjuring] = useState(false),
    [notice, setNotice] = useState("");
  const theme = themeOf(setup.theme);

  // The creator's AI choices: the shared AI, ChatGPT, and each provider with a key.
  const { options: ai, error: aiError } = useAIOptions(master);
  useEffect(() => {
    if (aiError) queueMicrotask(() => setSaveError(aiError));
  }, [aiError, setSaveError]);
  // A new story starts on the first AI that works without further setup.
  const defaulted = useRef(false);
  useEffect(() => {
    if (!ai || defaulted.current || form.aiMode === "chatgpt" || form.aiProvider) return;
    defaulted.current = true;
    const provider = ai.shared ? "shared" : ai.keys[0]?.provider;
    queueMicrotask(() =>
      update(provider ? { aiMode: "api", aiProvider: provider } : { aiMode: "chatgpt", aiProvider: null }),
    );
  }, [ai, form.aiMode, form.aiProvider, update]);

  const themeQuests: Quest[] = quests.filter((q) => q.theme === setup.theme);
  const ideas = setup.ideas || [];
  const questIds = [...themeQuests.map((q) => `preset:${q.id}`), ...ideas.map((q) => q.id)];
  const themeVoices = presets.filter((p) => p.mood === setup.theme);
  const voices = otherVoices || !themeVoices.length ? presets : themeVoices;
  const candidates = (kind: "theme" | "quest" | "voice") =>
    kind === "theme"
      ? storyThemes.map((t) => t.id)
      : kind === "quest"
        ? questIds
        : (themeVoices.length ? themeVoices : presets).map((p) => p.id);

  // Everyone watching replays the creator's Surprise me.
  const spin = setup.spin;
  const seenSpin = useRef(spin?.n);
  useEffect(() => {
    if (!spin || spin.n === seenSpin.current) return;
    seenSpin.current = spin.n;
    if (!master) spinner.spin(candidates(spin.kind), spin.value);
    // candidates only matter at the moment a new spin arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin?.n, master]);

  const chooseTheme = (id: string): Partial<StorySettings> => ({
    // Your own tale survives a change of realm; the realm's quests do not.
    setup: {
      ...setup,
      theme: id,
      ...(id !== setup.theme ? { quest: setup.quest === "custom" ? "custom" : null, ideas: [] } : {}),
    },
    ...(id !== setup.theme && setup.quest !== "custom" ? { title: "", world: "" } : {}),
  });
  const chooseQuest = (key: string): Partial<StorySettings> => {
    const quest = key.startsWith("preset:")
      ? themeQuests.find((q) => `preset:${q.id}` === key)
      : ideas.find((q) => q.id === key);
    return {
      setup: { ...setup, quest: key },
      ...(quest
        ? { title: quest.title, world: quest.story }
        : key === "none" || setup.quest !== "custom"
          ? { title: "", world: "" }
          : {}),
    };
  };
  const chooseVoice = (id: string): Partial<StorySettings> => {
    const preset = presets.find((p) => p.id === id);
    return {
      voice: {
        ...form.voice,
        narrator: id || undefined,
        narratorName: id === "custom" ? undefined : preset?.name,
        persona: id === "custom" ? form.voice.persona : undefined,
      },
    };
  };
  const surprise = (kind: "theme" | "quest" | "voice") => {
    const ids = candidates(kind);
    if (!ids.length) return;
    const value = ids[Math.floor(Math.random() * ids.length)];
    const n = Date.now();
    seenSpin.current = n;
    spinner.spin(ids, value);
    const change =
      kind === "theme" ? chooseTheme(value) : kind === "quest" ? chooseQuest(value) : chooseVoice(value);
    update({ ...change, setup: { ...(change.setup || setup), spin: { kind, value, n } } });
  };
  // While the light runs, nothing shows as chosen yet.
  const chosen = (selected: boolean) => !spinner.spinning && selected;

  const conjure = async () => {
    setConjuring(true);
    try {
      const r = await playApi("questIdeas", {
        id: story.id,
        theme: setup.theme,
        avoid: [...themeQuests, ...ideas].map((q) => q.title),
      });
      // The chosen idea's text is already in the story; it simply becomes your own.
      changeSetup({
        ideas: r.ideas,
        ...(setup.quest?.startsWith("idea:") ? { quest: "custom" } : {}),
      });
      setNotice("Three fresh quests rose from the mist.");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "The oracle is silent. Try again.");
    } finally {
      setConjuring(false);
    }
  };

  const ready = [
    form.aiMode === "chatgpt" || !!form.aiProvider,
    !!setup.theme,
    !!setup.quest && (setup.quest !== "custom" || !!form.world.trim()),
    true,
  ];
  const go = (n: number) => changeSetup({ step: n });
  const finish = async () => {
    try {
      await flush({ setup: { ...setup, done: true, spin: null } });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not enter the lobby");
    }
  };
  const current = steps[step - 1];
  const words = current.name.split(" ");

  return (
    <section className="lkx-lobby lkx-setup" data-step={step}>
      <header className="lkx-lobby-hero lkx-setup-hero">
        <div className="lkx-hero-arch" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <Crumbs
          items={[
            { label: "Interactive Stories", href: "/interactive" },
            { label: form.title || "A new tale" },
            { label: "The forging" },
          ]}
        />
        <div className="lkx-hero-copy">
          <span className="lkx-eyebrow">
            Chapter {["I", "II", "III", "IV"][step - 1]} of the forging · {current.eyebrow}
          </span>
          <h1>
            {words.slice(0, -1).join(" ")} <em>{words.at(-1)}</em>
          </h1>
          <p className="lkx-hero-lede">
            {master ? current.lede : "The Session Master is forging your tale. Every choice appears here the moment it is made."}
          </p>
        </div>
        <aside className="lkx-party lkx-setup-party" aria-label="Your party">
          <span className="lkx-eyebrow">The party</span>
          <ul>
            {players.map((p) => (
              <li key={p.user_id}>
                <Seal player={p} />
                <span>
                  <strong>{p.identity_name || p.name}</strong>
                  <small>
                    {p.identity_name ? `${p.name} · ` : ""}
                    {p.user_id === story.owner_id ? "Session Master" : "Companion"}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </aside>
        <ol className="lkx-steps" aria-label="Setup steps">
          {steps.map((s, i) => (
            <li key={s.name} aria-current={step === i + 1 ? "step" : undefined} data-done={step > i + 1 || undefined}>
              <button
                type="button"
                disabled={!master || i + 1 === step || ready.slice(0, i).some((r) => !r)}
                onClick={() => go(i + 1)}
              >
                <span>{["I", "II", "III", "IV"][i]}</span>
                {s.name}
              </button>
            </li>
          ))}
        </ol>
      </header>

      {(error || saveError) && (
        <Feedback error onDismiss={() => setSaveError("")}>
          {error || saveError}
        </Feedback>
      )}
      {notice && <Feedback onDismiss={() => setNotice("")}>{notice}</Feedback>}

      <fieldset className="lkx-setup-stage lkx-sheet" disabled={!master || generating} aria-label={current.name}>
        {step === 1 && (
          <div className="lkx-setup-split">
            <section className="lkx-setup-card">
              <h2>Your companions</h2>
              <p className="lkx-sheet-hint">Name every hero, or leave it empty to discover in the story. The ✎ opens their character sheet: who they are, their language and how they speak.</p>
              <FellowshipList
                players={players}
                owner={story.owner_id}
                user={user}
                canEdit={() => master}
                presets={presets}
                presetsLoaded={presetsLoaded}
                storyLanguage={form.voice.language}
                onPlayer={onPlayer}
                onError={setSaveError}
                onSaved={setNotice}
              />
              {master && (
                <>
                  <h3>Summon a companion</h3>
                  <InvitePanel
                    players={players}
                    disabled={busy}
                    onInvite={onInvite}
                    onInviteUser={onInviteUser}
                    onError={setSaveError}
                  />
                </>
              )}
            </section>
            <section className="lkx-setup-card">
              <h2>Who holds the quill?</h2>
              <p className="lkx-sheet-hint">The AI that writes every chapter. It cannot be changed once the story begins.</p>
              <div className="lkx-quills">
                {master && !ai && <SkeletonCards count={2} seal={false} className="lkx-quill-skeleton" label="Finding your quills" />}
                {(master ? !!ai?.shared : form.aiProvider === "shared") && (
                  <QuillCard
                    pressed={form.aiMode === "api" && form.aiProvider === "shared"}
                    sigil="✒️"
                    title="Lorekeeper's free AI"
                    hint="Shared by every adventurer, with a daily allowance. Nothing to set up."
                    onClick={() => update({ aiMode: "api", aiProvider: "shared" })}
                  />
                )}
                <QuillCard
                  pressed={form.aiMode === "chatgpt"}
                  sigil="💬"
                  title="ChatGPT"
                  hint="ChatGPT writes each chapter in your own ChatGPT; your party answers here."
                  onClick={() => update({ aiMode: "chatgpt", aiProvider: null })}
                  help={() => setHelp((h) => !h)}
                />
                {(master ? ai?.keys || [] : form.aiMode === "api" && form.aiProvider && form.aiProvider !== "shared" ? [{ provider: form.aiProvider, model: "" }] : []).map((k) => (
                  <QuillCard
                    key={k.provider}
                    pressed={form.aiMode === "api" && form.aiProvider === k.provider}
                    sigil="🗝️"
                    title={providerName(k.provider)}
                    hint={`Your own key${k.model ? ` · ${k.model}` : ""}`}
                    onClick={() => update({ aiMode: "api", aiProvider: k.provider })}
                  />
                ))}
              </div>
              {help && (
                <div className="lkx-quill-help" role="note">
                  <strong>Writing with ChatGPT</strong>
                  <ol>
                    <li>
                      Once: add Lorekeeper to ChatGPT as an app with this server URL{" "}
                      <code>{mcpServerUrl()}</code> (
                      <Link href="/profile?tab=settings#chatgpt-connection">setup guide</Link>).
                    </li>
                    <li>
                      In the lobby, copy the start command and send it in a ChatGPT chat with the
                      Lorekeeper app enabled.
                    </li>
                    <li>ChatGPT writes each chapter and saves it here. Your party answers in Lorekeeper.</li>
                    <li>
                      When everyone has answered, write <code>Continue</code> in the same ChatGPT chat.
                    </li>
                  </ol>
                  <small>No API key needed: it runs on your ChatGPT plan.</small>
                </div>
              )}
              {master && (
                <Link className="lk-text-button" href="/profile?tab=settings#ai-access">
                  + Add your own provider key
                </Link>
              )}
            </section>
          </div>
        )}

        {step === 2 && (
          <section>
            <div className="lkx-setup-bar">
              <h2>Choose your realm</h2>
              <SurpriseButton disabled={spinner.spinning} onClick={() => surprise("theme")} />
            </div>
            <div className="lkx-realms">
              {storyThemes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="lkx-realm"
                  style={{ "--realm": t.hue } as CSSProperties}
                  aria-pressed={chosen(setup.theme === t.id)}
                  {...spinState(spinner, t.id)}
                  onClick={() => update(chooseTheme(t.id))}
                >
                  <span className="lkx-realm-sigil" aria-hidden="true">
                    {t.sigil}
                  </span>
                  <strong>{t.name}</strong>
                  <small>{t.tagline}</small>
                  <em>
                    {quests.filter((q) => q.theme === t.id).length} quests ·{" "}
                    {presets.filter((p) => p.mood === t.id).length} voices
                  </em>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <div className="lkx-setup-bar">
              <h2>
                Quests of the realm <small>{theme ? `${theme.sigil} ${theme.name}` : ""}</small>
              </h2>
              <div>
                <button type="button" className="lkx-surprise is-quiet" disabled={conjuring || spinner.spinning} onClick={() => void conjure()}>
                  {conjuring ? "The oracle is dreaming…" : "✦ Conjure new quests"}
                </button>
                <SurpriseButton disabled={spinner.spinning || !questIds.length} onClick={() => surprise("quest")} />
              </div>
            </div>
            <div className="lkx-quests" aria-busy={conjuring || !questsLoaded}>
              {!questsLoaded && <SkeletonCards count={3} seal={false} label="Unrolling the quests" />}
              {conjuring && <SkeletonCards count={3} seal={false} className="is-conjuring" />}
              {[...themeQuests.map((q) => ({ ...q, key: `preset:${q.id}`, fresh: false })), ...ideas.map((q) => ({ ...q, key: q.id, fresh: true }))].map((q) => (
                <button
                  key={q.key}
                  type="button"
                  className="lkx-quest"
                  aria-pressed={chosen(setup.quest === q.key)}
                  {...spinState(spinner, q.key)}
                  onClick={() => update(chooseQuest(q.key))}
                >
                  {q.fresh && <span className="lkx-quest-fresh">✦ Freshly conjured</span>}
                  <strong>{q.title}</strong>
                  <q>{q.pitch}</q>
                </button>
              ))}
              <button
                type="button"
                className="lkx-quest is-own"
                aria-pressed={chosen(setup.quest === "custom")}
                onClick={() => update(chooseQuest("custom"))}
              >
                <strong>✍️ Write your own</strong>
                <q>Describe the tale in plain words. Used for this story only.</q>
              </button>
              <button
                type="button"
                className="lkx-quest is-own"
                aria-pressed={chosen(setup.quest === "none")}
                onClick={() => update(chooseQuest("none"))}
              >
                <strong>🎲 Let the narrator decide</strong>
                <q>No quest at all. The narrator invents one on the first page.</q>
              </button>
            </div>
            {setup.quest && setup.quest !== "none" && !spinner.spinning && (
              <div className="lkx-quest-editor">
                <span className="lkx-eyebrow">
                  {setup.quest === "custom" ? "Your own tale" : "Make it yours — changes stay in this story"}
                </span>
                <input
                  className="lkx-title-input"
                  maxLength={120}
                  value={form.title}
                  onChange={(e) => update({ title: e.target.value })}
                  placeholder="Title (optional — the narrator names it)"
                  aria-label="Story title"
                />
                <textarea
                  className="lkx-parchment"
                  rows={5}
                  maxLength={6000}
                  value={form.world}
                  onChange={(e) => update({ world: e.target.value })}
                  placeholder="Where does it start, who are you, and what is at stake?"
                  aria-label="The tale"
                />
              </div>
            )}
          </section>
        )}

        {step === 4 && (
          <section>
            <div className="lkx-setup-bar">
              <h2>
                Voices of the realm <small>{theme ? `${theme.sigil} ${theme.name}` : ""}</small>
              </h2>
              <div>
                <button
                  type="button"
                  className="lkx-surprise is-quiet"
                  aria-pressed={otherVoices}
                  onClick={() => setOtherVoices((v) => !v)}
                >
                  {otherVoices ? "Only this realm" : "Voices from other realms"}
                </button>
                <SurpriseButton disabled={spinner.spinning} onClick={() => surprise("voice")} />
              </div>
            </div>
            <div className="lkx-teller-grid lkx-voices">
              {!presetsLoaded && <SkeletonCards count={4} seal={false} label="Gathering the voices" />}
              {voices.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="lkx-teller"
                  aria-pressed={chosen(form.voice.narrator === p.id)}
                  {...spinState(spinner, p.id)}
                  onClick={() => update(chooseVoice(p.id))}
                >
                  <strong>
                    {otherVoices && `${themeOf(p.mood)?.sigil || ""} `}
                    {p.name}
                  </strong>
                  <q>{p.sample}</q>
                  <small>{p.blurb}</small>
                </button>
              ))}
              {otherVoices && (
                <>
                  <button
                    type="button"
                    className="lkx-teller"
                    aria-pressed={chosen(!form.voice.narrator)}
                    onClick={() => update(chooseVoice(""))}
                  >
                    <strong>Plain</strong>
                    <q>The rain had not stopped for three days when the stranger arrived.</q>
                    <small>Natural storytelling, no special voice.</small>
                  </button>
                  <button
                    type="button"
                    className="lkx-teller"
                    aria-pressed={chosen(form.voice.narrator === "custom")}
                    onClick={() => update(chooseVoice("custom"))}
                  >
                    <strong>Your own voice</strong>
                    <q>Anything you like — gothic romance, a cooking show, legal paperwork.</q>
                    <small>Describe how the story should sound.</small>
                  </button>
                </>
              )}
            </div>
            {form.voice.narrator === "custom" && (
              <textarea
                className="lkx-parchment lkx-narrator-custom"
                rows={3}
                maxLength={600}
                value={form.voice.persona || ""}
                onChange={(e) => update({ voice: { ...form.voice, narrator: "custom", persona: e.target.value } })}
                placeholder="How should the story sound? e.g. Write like a gothic romance: candlelight, longing glances and very dramatic weather."
                aria-label="Your own voice"
              />
            )}
            <label className="lkx-field lkx-language">
              <span>Language of the tale</span>
              <input
                list="lkx-story-languages"
                maxLength={60}
                value={form.voice.language}
                onChange={(e) => update({ voice: { ...form.voice, language: e.target.value } })}
              />
              <datalist id="lkx-story-languages">
                {languages.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </datalist>
            </label>
          </section>
        )}
      </fieldset>

      <nav className="lkx-setup-nav" aria-label="Setup navigation">
        {master ? (
          <>
            <button type="button" className="lk-text-button" disabled={step === 1} onClick={() => go(step - 1)}>
              ← {step > 1 ? steps[step - 2].name : "Back"}
            </button>
            <span className="lkx-save-state" role="status">
              {dirty ? "Inscribing…" : "Every choice is saved"}
            </span>
            {step < 4 ? (
              <button
                type="button"
                className="gold-button lkx-begin"
                disabled={!ready[step - 1] || spinner.spinning}
                onClick={() => go(step + 1)}
              >
                Onward to {steps[step].name} <span aria-hidden="true">→</span>
              </button>
            ) : (
              <button
                type="button"
                className="gold-button lkx-begin"
                disabled={busy || spinner.spinning}
                onClick={() => void finish()}
              >
                Enter the lobby <span aria-hidden="true">→</span>
              </button>
            )}
          </>
        ) : (
          <span className="lkx-hero-wait">Waiting for the Session Master to finish the forging…</span>
        )}
      </nav>
    </section>
  );
}
function QuillCard({
  pressed,
  sigil,
  title,
  hint,
  onClick,
  help,
}: {
  pressed: boolean;
  sigil: string;
  title: string;
  hint: string;
  onClick: () => void;
  help?: () => void;
}) {
  return (
    <div className="lkx-quill" data-pressed={pressed || undefined}>
      <button type="button" aria-pressed={pressed} onClick={onClick}>
        <span aria-hidden="true">{sigil}</span>
        <strong>{title}</strong>
        <small>{hint}</small>
      </button>
      {help && (
        <button type="button" className="lkx-quill-q" aria-label={`How ${title} works`} onClick={help}>
          ?
        </button>
      )}
    </div>
  );
}
