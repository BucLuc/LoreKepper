import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "./encryption";
import { providers } from "./ai-config";
export { providers } from "./ai-config";
export class AIError extends Error {
  constructor(message: string, publicStatus = 502) {
    super(message);
    this.publicStatus = publicStatus;
  }
  readonly publicStatus: number;
}
export async function generateAI(
  db: SupabaseClient,
  owner: string,
  system: string,
  prompt: string,
  cost: number,
  json = false,
  history: { role: "user" | "assistant"; content: string }[] = [],
  outputTokens?: number,
  // "shared", one of the owner's providers, or nothing: their newest key, else shared.
  choice?: string | null,
) {
  let settings = null;
  if (choice !== "shared") {
    let query = db
      .from("ai_settings")
      .select("*")
      .eq("user_id", owner)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (choice) query = query.eq("provider", choice);
    const { data, error } = await query;
    if (error)
      throw new Error("AI settings unavailable. Apply the play migration.");
    settings = data?.[0] || null;
    if (choice && !settings)
      throw new AIError(
        `The Session Master's ${choice} key was removed. Add it again under AI access, or start a new story with another AI. Your story is saved.`,
        422,
      );
  }
  const provider = settings?.provider || process.env.LORE_AI_PROVIDER || "groq";
  const config = providers[provider];
  if (!config) throw new Error("Unsupported AI provider.");
  const key = settings
    ? decrypt(settings.encrypted_key, "ai", owner).key
    : process.env.LORE_AI_KEY;
  if (!key)
    throw new Error(
      "The Session Master needs an API key, or configure the shared AI key on the server.",
    );
  const model = settings?.model || process.env.LORE_AI_MODEL || config.model;
  const quota = await db.rpc("reserve_ai_usage", {
    u: owner,
    cost,
    daily_limit: settings ? 500 : Number(process.env.LORE_AI_DAILY_UNITS || 60),
    global_limit: settings
      ? 0
      : Number(process.env.LORE_AI_GLOBAL_UNITS || 600),
  });
  if (quota.error) throw new Error(quota.error.message);
  const instructions =
    system +
    (json ? "\nReturn one valid JSON object only, without code fences." : "");
  const anthropic = provider === "anthropic";
  const response = await fetch(config.url, {
    method: "POST",
    signal: AbortSignal.timeout(85000),
    headers: anthropic
      ? {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        }
      : { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(
      anthropic
        ? {
            model,
            max_tokens: outputTokens ?? (json ? 4500 : 1800),
            system: instructions,
            messages: [...history, { role: "user", content: prompt }],
          }
        : {
            model,
            ...(provider === "groq" && model.startsWith("openai/gpt-oss-")
              ? {
                  max_completion_tokens: outputTokens ?? (json ? 6000 : 2200),
                  reasoning_effort: outputTokens ? "high" : "low",
                  include_reasoning: false,
                }
              : { max_tokens: outputTokens ?? (json ? 4500 : 1800) }),
            ...(provider === "groq"
              ? { temperature: outputTokens || json ? 0.9 : 0.7 }
              : {}),
            ...(provider === "groq" && model.startsWith("qwen/")
              ? { reasoning_effort: "none", reasoning_format: "hidden" }
              : {}),
            messages: [
              { role: "system", content: instructions },
              ...history,
              { role: "user", content: prompt },
            ],
            ...(json ? { response_format: { type: "json_object" } } : {}),
          },
    ),
  });
  if (!response.ok) {
    // Do not echo arbitrary provider response bodies: they may contain credentials.
    if (response.status === 404)
      throw new AIError(
        `The ${provider} model "${model}" is unavailable for this account (404). Choose an available model in AI access, or update the shared LORE_AI_MODEL. Your story is saved.`,
        422,
      );
    if (response.status === 401 || response.status === 403)
      throw new AIError(
        `AI provider denied access (${response.status}). Check the API key's provider and model permissions. Your story is saved.`,
        422,
      );
    if (response.status === 429)
      throw new AIError(
        "AI provider rate limit reached. Your content is saved; retry later.",
        429,
      );
    throw new AIError(
      `AI provider rejected the request (${response.status}). Check model availability and support for structured JSON output in AI access. Your story is saved.`,
    );
  }
  const result = await response.json();
  const text = anthropic
    ? result.content
        ?.filter((c: { type: string }) => c.type === "text")
        .map((c: { text: string }) => c.text)
        .join("")
    : result.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim())
    throw new Error("AI returned no text. Retry safely.");
  return text;
}
