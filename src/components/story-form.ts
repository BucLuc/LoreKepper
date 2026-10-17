"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Adventure, PlayerVoice, Quest, StorySetup, Voice } from "@/lib/play";
// Everything the creator configures for the story as a whole. Players' own
// characters are saved separately (configurePlayer), so edits never collide.
export type StorySettings = {
  title: string;
  world: string;
  voice: Voice;
  edition: string;
  design: Adventure["design"];
  aiMode: "api" | "chatgpt";
  aiProvider: string | null;
  setup: StorySetup | null;
};
export type PlayerCast = {
  name: string;
  description: string;
  voice: PlayerVoice | null;
};
export function storySettings(story: Adventure): StorySettings {
  return {
    title: story.title,
    world: story.world,
    voice: story.voice,
    edition: story.edition,
    design: story.design,
    aiMode: story.ai_mode || "api",
    aiProvider: story.ai_provider ?? null,
    setup: story.setup ?? null,
  };
}
// The creator's copy of the settings, saved shortly after each change. Everyone else
// (and the creator when idle) sees the server copy, which realtime keeps current.
export function useStoryForm({
  story,
  master,
  busy,
  generating,
  onSave,
}: {
  story: Adventure;
  master: boolean;
  busy: boolean;
  generating: boolean;
  onSave: (settings: StorySettings) => Promise<void>;
}) {
  const [form, setForm] = useState(() => storySettings(story)),
    [dirty, setDirty] = useState(false),
    [saveError, setSaveError] = useState("");
  // Counts edits, so a finished save knows whether newer edits are still pending.
  // (Comparing form objects fails: React may run state updaters twice.)
  const edits = useRef(0);
  useEffect(() => {
    if (dirty || busy) return;
    const next = storySettings(story),
      seen = edits.current;
    queueMicrotask(() => {
      // An edit made in the meantime wins over the server copy.
      if (edits.current === seen) setForm(next);
    });
  }, [story, dirty, busy]);
  const update = useCallback((change: Partial<StorySettings>) => {
    edits.current++;
    setForm((f) => ({ ...f, ...change }));
    setDirty(true);
    setSaveError("");
  }, []);
  const save = useCallback(
    async (settings: StorySettings) => {
      const saving = edits.current;
      await onSave(settings);
      if (edits.current === saving) {
        setDirty(false);
        setSaveError("");
      }
    },
    [onSave],
  );
  useEffect(() => {
    // The database refuses lobby edits while Lorekeeper's narrator story is
    // active or ChatGPT is mid-chapter; wait until that is over.
    if (
      !dirty ||
      busy ||
      generating ||
      !master ||
      saveError ||
      (story.status === "active" && story.ai_mode !== "chatgpt") ||
      !!story.draft?.parts.length
    )
      return;
    const timer = setTimeout(() => {
      save(form).catch((e) => setSaveError(e.message));
    }, 650);
    return () => clearTimeout(timer);
  }, [form, dirty, busy, generating, master, save, saveError, story.status, story.ai_mode, story.draft]);
  return {
    // Only the creator edits; everyone else always sees the saved story.
    form: master ? form : storySettings(story),
    update,
    dirty,
    saveError,
    setSaveError,
    // Saves right away, e.g. before beginning the story.
    flush: (change: Partial<StorySettings> = {}) => {
      const next = { ...form, ...change };
      edits.current++;
      setForm(next);
      return save(next);
    },
  };
}
// Rows of the worlds table: ready-made quests per theme, editable in Supabase.
export function useQuests() {
  const [quests, setQuests] = useState<Quest[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase()
      .from("worlds")
      .select("id,theme,title,pitch,story")
      .order("sort")
      .then((r) => {
        if (!alive) return;
        setLoaded(true);
        if (r.error) setError("Ready-made quests appear once the story setup migration is applied in Supabase.");
        else setQuests(r.data as Quest[]);
      });
    return () => {
      alive = false;
    };
  }, []);
  return { quests, error, loaded };
}
// Which AIs the signed-in user can write with: the shared one and their own keys.
export type AIOptions = { shared: boolean; keys: { provider: string; model: string }[] };
export function useAIOptions(enabled = true) {
  const [options, setOptions] = useState<AIOptions | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    import("@/lib/play-client")
      .then(({ playApi }) => playApi("aiOptions"))
      .then((r: AIOptions) => alive && setOptions(r))
      .catch((e) => {
        if (!alive) return;
        // ChatGPT still works; nothing should wait for this forever.
        setOptions({ shared: false, keys: [] });
        setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return { options, error };
}
