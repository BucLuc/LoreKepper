"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { NarratorPreset } from "@/lib/play";
// The writing voices from the narrators table (editable in Supabase), in their sort
// order. The server copies a chosen voice into the story when the setup saves.
export function useNarratorPresets() {
  const [presets, setPresets] = useState<NarratorPreset[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase()
      .from("narrators")
      .select("id,name,mood,blurb,sample")
      .order("sort")
      .then((r) => {
        if (!alive) return;
        setLoaded(true);
        if (r.error)
          setError(
            "Writing voices appear once the narrators migration is applied in Supabase.",
          );
        else setPresets(r.data as NarratorPreset[]);
      });
    return () => {
      alive = false;
    };
  }, []);
  return { presets, error, loaded };
}
