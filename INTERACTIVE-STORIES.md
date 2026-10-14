# Interactive Stories, Characters and Chat

Implemented in the existing LoreKeeper checkout on 13 October 2026.

## 1. Implementation summary

### Interactive Stories

- Independent persistent solo and multiplayer adventures with private, permanent pages.
- Simple setup with optional world description, AI-chosen setting/characters, world voice, character selection, every existing display edition and the existing display customizer. Personal characters can be created and selected directly during setup.
- Multiplayer lobbies, seven-day invitation links, up to eight participants, individual character selections and immutable character snapshots. Only the creator starts the adventure or writes its conclusion.
- Full-screen gameplay with an atmospheric backdrop, a compact permanent Leave story control, the selected edition's renderer, and questions/free-text decisions matching its ink, paper and typography. Configuration is kept out of the narrative view.
- Sequential and simultaneous question phases; only the targeted participant can answer, once. Narration waits for all required answers. A database lease prevents duplicate generation and stale workers cannot overwrite a newer generation.
- Automatic continuation when all answers arrive, pause/resume, retry after AI errors, a final AI-generated chapter and preserved completed stories.
- Clean Story by default; Show Interactions in the story menu retains chronological questions and original answers. Current questions and submitted decisions remain visible until the next segment.
- Cumulative AI continuity memory plus recent segments, rather than sending the entire growing adventure to the provider every time.

### Characters and voice

- Personal characters and collection characters, flexible types, personality, a predefined avatar identifier and reusable voice settings.
- Character creation, editing, deletion, collection/origin filtering, JSON imports (up to 100 per batch), selection in adventures and Chat, and links to accessible adventure appearances.
- Collection members can read collection characters; collection owners can manage them. Personal characters are private to their owners. Other participants see the selected character snapshot, not its source collection or unrelated content.
- Language, writing style, tone and style scope are independent. Dialogue Only is the default. Default tone explicitly preserves natural emotion, humor and creative freedom. Characters can inherit the world voice or use their own voice.

### Chat

- Independent private conversations, invitation links and up to twenty participants.
- Ordinary messaging without AI, custom voice transformations, and optional character messaging.
- Originals are saved before transformation. Pending/failed transformations retain a visible original; successful transformations provide an Original message disclosure.
- Realtime updates with periodic recovery reads. The latest 100 messages load initially; earlier messages can be loaded. Exports load the complete conversation.

### AI

- A shared server-only adapter for Groq, Gemini, OpenRouter, OpenAI and Anthropic, with editable model IDs and encrypted personal API keys.
- Optional shared AI backed by a configured server key. Groq is the starter default; no provider account or allowance has been provisioned.
- Every adventure AI request resolves the original Session Master's configuration, even when another player requests continuation. Chat transformations use the sender's configuration.
- Weighted daily usage (story turn: 6 units; chat transformation: 1), a three-second AI request interval, per-user and global shared quotas, provider timeout/error handling and encrypted key storage.
- By default, shared use allows 60 units per user/day and 600 shared units globally/day. BYOK has a 500-unit user/day application safeguard and does not consume the shared global allowance. Attempts count against quota even if the provider subsequently fails; this is deliberate abuse protection. Days follow the database's current_date (normally UTC in Supabase).

### Exports and navigation

- Markdown, PDF and independent collection exports during active, paused or completed adventures. Each destination supports clean content or chronological interactions.
- PDFs use the existing paginated collection PDF pipeline, renderer, edition and customization settings. Collection exports use the existing encrypted entry save function.
- Collection entries preserve source adventure/chat IDs as database metadata. The existing reader exposes source links; those links still require original session membership.
- Collections, Interactive Stories, Characters and Chat are integrated into the existing header. AI access is available at `/ai`.

## 2. Existing functionality reused

`StoryDocument`, `GalleryDocument`, `EditionMarkdown`, the full reader edition catalogue, edition typography and palettes, `EditionCustomizer`, and the existing paged rendering and PDF pipeline are reused. There is no alternate Markdown story renderer.

The existing Supabase authentication/session helper, profiles, collection membership/ownership functions, AES-GCM entry encryption, entry preparation, export filenames, and `save_entry` database function are reused. `StoryDocument` gained an optional `ongoing` flag to suppress completed-document closing material during gameplay; its existing default output is preserved.

There was **no AI or BYOK implementation in this checkout** to extend. The new shared server adapter and encrypted settings store were added rather than duplicating an existing integration. No new runtime dependency was required.

## 3. Supabase setup — required, not yet applied

The migration was tested locally in PGlite. **It has not been executed against your hosted Supabase project.** No hosted configuration or production data was changed.

1. Ensure the existing four migrations from `202610100001_lore.sql` through `202610100004_author_links.sql` have already been applied. For a fresh project, follow `SUPABASE.md` first.
2. Open your Supabase project's SQL Editor and execute **`supabase/migrations/202610130001_play.sql` once**, or use your existing migration deployment workflow. This migration creates new objects and is not intended to be rerun manually.
3. It creates: `characters`, `adventures`, `adventure_players`, `chats`, `chat_players`, `chat_messages`, `play_invites`, `ai_settings`, and `ai_usage`. It adds `source_adventure_id` and `source_chat_id` to `entries`, with foreign keys that clear the reference if a source is deleted.
4. RLS is enabled on every new table. Character writes follow ownership rules. Browsers have read-only access to their adventures, participant lists and chats; answers use a restricted authenticated database function. Invitation records, API keys and usage tables are inaccessible to browsers. Privileged operations are restricted to the server's service role. Apply the provided policies and grants as part of the migration; no separate manual policy creation is needed.
5. Database functions included: `in_adventure`, `in_chat`, `submit_adventure_answer`, `lease_adventure`, `commit_adventure`, `reserve_ai_usage`, `select_adventure_character`, and `join_play`. No new application trigger or storage bucket is required.
6. The migration automatically adds `adventures`, `adventure_players`, `chats`, `chat_players` and `chat_messages` to `supabase_realtime` **if that publication exists**. Check Dashboard → Database → Replication/Publications and verify those five tables are enabled. Alternatively run:

   ```sql
   select tablename from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public';
   ```

   If the publication is unavailable, enable these tables using Supabase's Realtime publication setup. Persisted recovery reads still work without Realtime, but immediate synchronization needs it.
7. Keep your existing Auth configuration. Friends must sign in (or use an existing supported guest session) before accepting an invitation. No public access or anonymous RLS bypass is needed.

There are **no new Supabase Edge Function secrets** to configure: the AI endpoints run in Next.js. The service-role credential below belongs in the Next.js server environment.

## 4. Environment and provider configuration

Add the following to `.env.local` for development and your hosting provider's server environment for deployment. Restart the server after changes. Do not prefix any of these with `NEXT_PUBLIC_`.

| Variable | Required? | Purpose |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for stories, Chat and AI settings | Your Supabase project service-role key, available in Project Settings → API keys (legacy `service_role` key). Server-only privileged session mutations and creator AI resolution. |
| `LORE_ENCRYPTION_KEY` | Existing requirement | Keep the existing 64-hex-character key. It also encrypts personal AI keys. Do not replace it: existing entries and saved credentials depend on it. |
| `LORE_AI_KEY` | Optional | Shared provider API key, obtained from that provider's developer console. Omit it if users will use personal keys. |
| `LORE_AI_PROVIDER` | Optional, default `groq` | `groq`, `gemini`, `openrouter`, `openai`, or `anthropic`. |
| `LORE_AI_MODEL` | Optional | Shared model ID. Default depends on the selected provider; `.env.example` gives a Groq starter configuration. Set this together with the shared provider. |
| `LORE_AI_DAILY_UNITS` | Optional, default `60` | Shared per-user daily allowance. |
| `LORE_AI_GLOBAL_UNITS` | Optional, default `600` | Global shared daily allowance. Keep a positive limit to retain the shared spending safeguard. |

Personal keys are entered under **AI access** (`/ai`). Choose a provider and model, enter its API key, and Save AI access. Only an adventure's creator needs this; participants' keys are never used for that adventure. Ordinary Chat does not require AI.

The adapters follow the providers' documented APIs: [Groq text generation](https://console.groq.com/docs/text-chat), [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai), [OpenRouter chat completion](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request?explorer=true), and [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create). Groq has a documented [free-plan rate limit](https://console.groq.com/docs/rate-limits); actual availability, billing and model limits depend on the account. No free capacity or model quality is guaranteed by the application. Model IDs are editable because provider offerings change.

Your host must permit the server request duration used here (up to 120 seconds). Provider requests time out after 85 seconds. A host timeout does not discard saved decisions; after the two-minute generation lease expires, narration can be retried.

## 5. Remaining limitations

- Hosted Supabase migration, service-role configuration, provider credentials and deployment remain manual steps. Without those, the new persisted feature pages cannot operate against the hosted database.
- Live two-browser multiplayer, real provider writing quality, and new UI PDF downloads could not be tested without configured services/accounts. Provider behavior, supported model IDs and quotas must be verified with your account.
- AI-chosen characters are maintained in story continuity memory, not automatically promoted into reusable library records. Create/import a personal character to reuse it across sessions. Automatic character extraction from existing stories was explicitly out of scope.
- No automatic player removal or invented answer for an inactive participant. The story waits safely for their saved turn; they can reconnect and answer. The Session Master can pause or conclude the adventure. This preserves player agency; an explicit skip/replace-player workflow is not included.
- No live presence roster, message read receipts, or typing indicators. Participants, pending answers and persisted generation status are synchronized.
- No optional final polishing pass. Conclusion generation is implemented and retains prior events/decisions. AI output is delivered per segment rather than streamed token by token.
- Voice transformations are instructed to preserve facts, names, numbers and negations, but are generative output. The preserved original remains available for comparison.
- Characters show accessible adventure appearances. Existing collection stories have no supplied character-to-entry association data, so a historical appearance index for those entries cannot be invented.
- Very long stories are rendered from their complete saved Markdown; full chat history is loaded on demand. Further virtualization or an incremental renderer may be useful at much larger scale, but is not required for the intended private friends application.

## 6. Validation

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm test`: 62 tests passed, including existing collection/edition/export/encryption regressions and new play/database tests.
- `npm run test:ai`: 2 server AI tests passed using mocked provider responses, not real credentials.
- `npm run build`: passed.
- Local migration execution covered RLS, private characters, unauthorized mutation, inaccessible key records, invitation restrictions, snapshot retention after deletion, duplicate/stale answers, waiting for all simultaneous answers, duplicate/stale generation commits, and owner quota attribution.
- Structured-turn tests cover invented/duplicate player IDs, missing questions, clean versus chronological interaction content and natural default voice behavior.
- Browser visual checks used temporary sample content with the real renderer and styles: Glorious desktop typography/decision controls and a 390px manuscript mobile layout. The sample route was removed. These checks do not constitute live multiplayer or provider validation.

## 7. How to use and smoke-test

1. Apply the migration and configure server variables, then run `npm run dev`.
2. Sign in and open Characters. Create a personal character, or import a JSON array into a collection you own. An import record can be:

   ```json
   {"name":"Sir Reginald","kind":"Human","personality":"A proud knight with a soft spot for stray cats.","avatar":"🛡️","voice":{"language":"English","style":"Medieval","tone":"Default","scope":"dialogue"}}
   ```

3. Open AI access and save your provider key, or use the configured shared AI.
4. Open Interactive Stories, enter a title/world (or leave the world empty), choose Solo or With friends, select/create a character and choose a display format. Expand advanced settings for voice or the existing edition customizer.
5. Enter the story. In a multiplayer lobby, copy an invitation link; have another signed-in account open it. Each participant selects their character and whether to inherit the story voice. The creator clicks Begin the adventure.
6. Answer only your targeted question. For simultaneous questions, verify that narration waits until everyone targeted has answered. Reload either browser and confirm the saved story and decisions remain. Try duplicate submissions and confirm no duplicate narration is produced.
7. In the story menu, toggle Show Interactions, export Markdown/PDF, or save into one of your accessible collections. Open the resulting entry and its source link. A collection-only member should be able to read the exported entry while lacking access to the original private adventure.
8. The creator can pause/resume or Write the final chapter. Leave story returns to your adventure list without deleting progress.
9. Open Chat, create a conversation, invite a friend, and send a normal message. Switch to A writing voice or A character for AI transformation. Expand Original message and compare the meaning. Export or save the conversation to a collection.
10. Temporarily choose an invalid provider model or exhaust a small shared test quota. Confirm that an error preserves submitted story answers and chat originals; restore the configuration and retry story narration.

Changes remain uncommitted in the requested checkout. No production database changes or deployment were performed.

## Troubleshooting update: unavailable Groq model

The original Groq starter model `llama-3.3-70b-versatile` is no longer available on the free/developer tier. Groq's deprecation notice lists its shutdown on 16 August 2026. The starter default and local shared configuration now use `openai/gpt-oss-120b`, verified against the configured account's active model list. A live sample story JSON request succeeded with HTTP 200. The UI and server share one provider-default registry, and unavailable-model errors now explain the model problem without suggesting every failure is an invalid key.

If you previously saved the old model as a personal AI setting, update that model under AI access. If you deployed the old shared configuration, update `LORE_AI_MODEL` in your host environment and restart/redeploy. No new SQL migration is needed for this correction.
