// Supabase Edge Function "lorekeeper-mcp": the MCP server ChatGPT connects to.
// Deploy server.ts alongside this file, with "Verify JWT" turned OFF (see CHATGPT-MCP.md).
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { handle } from "./server.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
const client = createClient(
  supabaseUrl,
  Deno.env.get("LOREKEEPER_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve((req) =>
  handle(req, {
    supabaseUrl,
    appUrl: Deno.env.get("LOREKEEPER_APP_URL"),
    rpc: async (fn, args) => await client.rpc(fn, args),
    userFor: async (token) => (await client.auth.getUser(token)).data.user?.id ?? null,
  }),
);
