import { supabase } from "./supabase";
export async function playApi(
  action: string,
  body: Record<string, unknown> = {},
) {
  const { data } = await supabase().auth.getSession();
  if (!data.session) throw new Error("Please sign in first.");
  const response = await fetch("/api/play", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}
