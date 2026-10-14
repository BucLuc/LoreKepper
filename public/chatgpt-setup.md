# LoreKeeper: connect ChatGPT without an OpenAI API key

This integration uses a Custom GPT with Actions inside the ChatGPT web app. LoreKeeper does not call the OpenAI API in this mode. Users connect their LoreKeeper accounts through OAuth; they do not paste an AI key. The app owner configures the OAuth client once.

OpenAI documents the Actions setup as an OpenAPI schema, authentication settings and GPT instructions. [Official setup guide](https://developers.openai.com/api/docs/actions/getting-started).

## 1. Apply the database migrations

The original play migration must already be installed. Then run these in order in the Supabase SQL editor:

1. `202610130002_lobbies_and_chats.sql`
2. `202610140001_chatgpt_bridge.sql`

Copies are included with this delivery. They add live lobby controls, direct/group chats, optional player identities, ChatGPT mode and OAuth storage. Existing story content is retained. The current project's schema check showed both migrations still pending when this work was completed.

## 2. Make LoreKeeper reachable over HTTPS

Deploy the existing Next.js application on a public HTTPS URL, for example `https://your-lorekeeper.example`. Localhost cannot be used directly by ChatGPT Actions. Keep the existing Supabase URL, publishable key, server service-role key and encryption settings in the deployment environment.

Actions require HTTPS with a valid public certificate and have a 45-second request timeout. The bridge performs short database operations; ChatGPT writes the fiction before calling the save endpoint. [OpenAI production requirements](https://developers.openai.com/api/docs/actions/production).

## 3. Create the OAuth client values

Generate a random client ID and a strong random client secret, and set these server environment variables:

```text
LORE_PUBLIC_URL=https://your-lorekeeper.example
LORE_GPT_CLIENT_ID=your-random-client-id
LORE_GPT_CLIENT_SECRET=your-random-client-secret
LORE_GPT_REDIRECT_URI=the-exact-callback-from-the-GPT-editor
```

Use a secret with at least 32 random bytes. These are credentials for your LoreKeeper connection, not OpenAI API credentials. Keep the secret in server configuration and the GPT authentication editor; never put it in GPT instructions, public files or a chat message.

You can initially leave the callback unset while creating the GPT. Fill it in after step 5 and restart/redeploy the app.

## 4. Create your GPT and add the schema

Open the GPT editor in ChatGPT and create a GPT named `LoreKeeper Narrator`. Your account/workspace must support creating GPTs and Actions.

In its Actions section, import this URL, replacing the domain:

```text
https://your-lorekeeper.example/api/story-bridge/openapi
```

Alternatively paste the delivered `LoreKeeper-GPT-action-schema.json` after replacing its example server URL, authorization URL and token URL with your public domain.

The schema exposes four operations: listStorySessions, readStorySession, saveStoryTurn and importCompleteStory. It does not expose general Supabase table access or your AI keys.

## 5. Configure OAuth authentication

Select OAuth for the action and enter:

- Client ID: the value of `LORE_GPT_CLIENT_ID`
- Client secret: the value of `LORE_GPT_CLIENT_SECRET`
- Authorization URL: `https://your-lorekeeper.example/connect/chatgpt`
- Token URL: `https://your-lorekeeper.example/api/story-bridge/oauth/token`
- Scopes: `stories:read stories:write`

The token endpoint accepts client credentials in the request body or HTTP Basic authentication.

Save the GPT/action configuration, copy its exact callback URL, and set `LORE_GPT_REDIRECT_URI` to that URL on the server. It normally has the form `https://chatgpt.com/aip/g-.../oauth/callback`; the older `chat.openai.com` callback form is also supported. The server accepts only the exact configured callback.

OAuth allows each user to sign in to their own account through the GPT. [Official authentication documentation](https://developers.openai.com/api/docs/actions/authentication).

## 6. Add the narrator instructions

Paste the complete contents of `LoreKeeper-GPT-instructions.md` into the GPT's instructions. Suggested conversation starters:

```text
start: paste-your-session-id
continue
save this complete story
```

Save the GPT privately first. Test it before sharing it with other users. Each user connects their own LoreKeeper account; the connection can access only stories they own.

## 7. Connect and play

1. In LoreKeeper, click New story. You enter the lobby immediately.
2. Optionally enter a title, world setting, and each player's name/description. Blank title/world fields are filled by the narrator. Pick a display category/format and invite users if desired.
3. Select ChatGPT web chat, then click Begin with ChatGPT.
4. Copy the session ID or start command.
5. Open your GPT and send `start: SESSION_ID`.
6. On the first action, follow ChatGPT's sign-in prompt, sign in to LoreKeeper and approve Connect this account.
7. The GPT reads the settings, writes the opening, and saves it. LoreKeeper displays the new title and scene automatically, with fade-in and skippable word reveal.
8. Players answer in the formatted story page. Once all pending answers are saved, send `continue` in the GPT.
9. The GPT reads fresh answers and saves the next scene. Repeat as desired.

The handoff panel also copies the current turn or all available session information, including answered questions. A creator can paste a complete generated narrator response as a fallback. Pausing returns to the lobby and blocks GPT writes until resumed; invites remain available there.

## 8. Import a complete existing story

Upload your Markdown file to the GPT and say `save this complete story`. It preserves the Markdown and generates the title/world/summary required for storage. The result is a new completed story in your adventure library, ready to read and export.

The action supports up to 75,000 Markdown characters per import. It rejects larger input rather than truncating it. The GPT must not claim a complete save if it cannot access the whole source.

## 9. Check or disconnect

Go to Profile → Account settings → ChatGPT web chat to see connection status, open the schema/instructions, or disconnect. Disconnecting invalidates that account's access and refresh tokens. Reconnect from the GPT when needed.

If an action reports not ready, begin/resume in the lobby or wait for all players to answer. If it reports session changed, have the GPT fetch the session again. If it reports connection/setup unavailable, check the migrations, OAuth environment values and exact callback. Workspace policy or account availability can also affect Actions.

## Validation and remaining setup

Database and HTTP tests cover ownership, authentication, readiness, revisions, duplicate writes, token rotation/revocation and preserving complete imports. The configured AI API produced a 723-word synthetic opening with a generated title/world and a chapter heading.

The migrations were tested locally, not applied to the hosted database. A Custom GPT was not created or connected inside your ChatGPT account; steps 1–6 are the remaining setup. No OpenAI provider key is required for ChatGPT mode.
