# ChatGPT integration (MCP server on Supabase)

ChatGPT connects to Lorekeeper as an app (MCP connector). The MCP server is the Supabase Edge Function `lorekeeper-mcp`. It only loads and saves story data. ChatGPT writes the story freely, with no narrator prompt, mechanics or format rules from Lorekeeper. Users sign in through Supabase Auth's OAuth 2.1 server, so each ChatGPT user only reaches the stories their own Lorekeeper account owns.

```
ChatGPT ──MCP (OAuth bearer)──▶ Edge Function lorekeeper-mcp ──service role RPC──▶ Postgres
   │                                                                  ▲
   └──sign-in──▶ Supabase Auth OAuth server ──consent page──▶ Lorekeeper /oauth/consent
```

## Tools

| Tool | Purpose |
|---|---|
| `list_roleplays` | The user's recent stories and session IDs |
| `get_roleplay` | Settings, players and the complete history (every chapter, question and answer) as Markdown |
| `save_chapter` | Saves the reply ChatGPT just wrote in the chat as the next chapter, plus its question. Works from the lobby, so "Begin" in Lorekeeper is optional. Checks the revision and waits for every answer. |
| `save_roleplay` | Saves a roleplay played in ChatGPT as a continuable story, or updates one saved from the same chat |
| `import_story` | Imports a Markdown story unchanged; long stories can be sent in parts |

## Owner setup (once)

1. **Database:** in the SQL editor, run every migration not yet applied, in filename order. The ChatGPT ones are `202610140001_chatgpt_bridge.sql` and then `202610150002_chatgpt_mcp.sql`.
2. **Site URL:** under Authentication → URL Configuration, set the Site URL to the public HTTPS address of the deployed Lorekeeper app. Deploy the app so `/oauth/consent` exists.
3. **OAuth server:** under Authentication → OAuth Server, enable it, set the authorization path to `/oauth/consent`, and enable dynamic client registration ("Allow Dynamic OAuth Apps").
4. **Edge Function:** go to Edge Functions → Deploy a new function → Via Editor and name it `lorekeeper-mcp`. Paste `supabase/functions/lorekeeper-mcp/index.ts` into `index.ts`, add a file `server.ts` with `supabase/functions/lorekeeper-mcp/server.ts`, and deploy.
5. **Turn JWT verification off** for the function, in its settings ("Enforce JWT verification" / "Verify JWT"). The function validates the OAuth token itself, and ChatGPT's first, unauthenticated discovery request must reach it.
6. **Secrets** (Edge Functions → Secrets):
   - `LOREKEEPER_APP_URL`: the app's public URL, for links in ChatGPT replies (optional).
   - `LOREKEEPER_SECRET_KEY`: only if the legacy `service_role` key is disabled. Use a secret key (`sb_secret_…`). `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.
7. **Check:** `curl -i -X POST https://<project-ref>.supabase.co/functions/v1/lorekeeper-mcp` should return `401` with a `WWW-Authenticate: Bearer resource_metadata=…` header. `https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1` should return JSON once the OAuth server is enabled.

The MCP server URL is `https://<project-ref>.supabase.co/functions/v1/lorekeeper-mcp`. Lorekeeper also shows it under Profile → Account settings → ChatGPT. User setup is in `public/chatgpt-setup.md`.

## Tests

`tests/chatgpt-mcp.test.ts` runs the function's handler (`server.ts`) against the real migrations in PGlite. It covers OAuth discovery, the start/continue flow, revision and answer checks, ownership, saving and updating roleplays, and imports.
