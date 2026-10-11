import { createClient } from "@supabase/supabase-js";
let client: ReturnType<typeof createClient> | undefined;
export function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Configure Supabase using .env.local. See SUPABASE.md.");
  return (client ??= createClient(url, key));
}
export async function api(action: string, body: Record<string, unknown> = {}, signal?: AbortSignal) {
  const { data } = await supabase().auth.getSession();
  if (!data.session) throw new Error("Please sign in to enter the archives.");
  const response = await fetch("/api/lore", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ action, ...body }),
    signal,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error || "The archive could not complete this request.",
    );
  return result;
}
