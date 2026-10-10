# The shared archives

## Setup

1. Create a free Supabase project. Run the SQL files in `supabase/migrations/` in filename order in the SQL editor (or apply using Supabase CLI migrations). For an existing installation, run only the migrations you have not already applied. `202610100002_collection_creation_rls.sql` fixes collection creation with returned rows; do not rerun the original table-creation migration.
   Also apply `202610100003_entry_management.sql` once to enable editing/deleting your own entries. It adds creator-only RLS policies and preserves entry identity and collection. Existing entries and favorites are retained.
   Also apply `202610100004_author_links.sql` after deleting your current entries. It adds entry/speaker author fields and real user foreign keys, removes the old assignment map, and installs atomic save/assignment functions. Auth accounts and collections are preserved. Do not rerun already-applied SQL.
2. Copy `.env.example` to `.env.local`. Set your project URL and publishable key (a legacy anon key also works). Never use a service-role key. Generate the encryption key with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Save its output as `LORE_ENCRYPTION_KEY`, and back it up securely. Use the same key on every app instance.
3. In Authentication settings, enable anonymous sign-ins and the email/password provider. Disable **Confirm email**. Enable manual identity linking for guest conversion. Configure the app Site URL. These are project settings; the app cannot change them with a public key.
4. Run `npm run dev`. Create a guest or email account, create a collection, then use its Settings page to import `data/data.json`. Local JSON is no longer served by application pages. Importing appends records with fresh IDs; repeating an import creates duplicates. Batches are limited to 500 records / 3 MB.
5. Configure the same environment variables in your Next.js hosting provider. This app requires a Node server, not static export. Never prefix the encryption key with `NEXT_PUBLIC_`.

## Behavior and security

Collection creators are admins. Invitations are reusable bearer links with random 256-bit tokens, SHA-256 hashes stored in the database, seven-day expiry, and admin revocation. The destination survives login via a validated local `next` path. Accepting is idempotent and grants membership inside a database function. Anyone receiving a forwarded link can join until expiry or revocation.

Guest accounts use Supabase anonymous Auth and retain their UUID on email/password upgrade, preserving memberships and contributions. Email signup and upgrades require the Auth settings above. Guests lose access after signing out or clearing browser storage. Profile supports display names, credentials, signing out, entries and personal favorites. Entries attributed to a selected member or an assigned imported author appear in that member's profile, alongside their own submissions.

Profile also supports permanent account deletion, including owned collections. Changing the email of an existing permanent account still requires Supabase email-change verification, even with signup confirmation disabled; configure SMTP for reliable delivery if you use this option. Signup and guest upgrade do not require verification with Confirm email disabled. This is Auth behavior, not a paid-plan restriction.

All collection members can download JSON or Markdown from the collection heading. JSON uses the original `{entries: [...]}` structure and preserves original source content, omitting entry/message IDs, user UUIDs and derived display fields. Markdown uses readable titles, attribution and message text. Exports contain decrypted data; keep downloaded archives private. Exported JSON can be reimported.

Favorites are per member, aggregated into the collection's shared favorites. Removing your favorite does not remove anyone else's. Membership, admin actions, attribution assignments and favorites are protected by PostgreSQL row-level security, including direct database API calls. Server requests use verified user access tokens and the publishable key, retaining RLS. No service key is required.

Entry creators can rename or delete their submissions from title menus, with an edit shortcut in their profile. Author attribution is distinct from entry ownership: selecting another member or assigning an imported author does not give that member edit permissions. Editing keeps the same entry ID and favorites; deleting cascades to favorites. The editor supports multiple message passages and member or free-text authors.

The avatar menu opens on hover, click, or keyboard activation. New collections, imports, invitations, renaming and account changes use focused dialogs; forms are not permanently displayed in overview pages. Profile and Settings have separate task sections. All collection members can access Settings; only admins see configuration, deletion, author assignments, invitations and import controls. Old /admin links redirect to /settings. Every data-loading page renders a layout skeleton. Collection exports ask for a format and use the browser's native save-file picker where available, with an explicit Save file action as the fallback; the browser controls the fallback save location.

Story entry payloads (title, messages, original content, presentation metadata) are AES-256-GCM encrypted **on the Next.js server before persistence**, and decrypted only after an authorized database read. Random nonces and collection/entry IDs as authenticated associated data prevent ciphertext swapping. The server is trusted: this is not end-to-end encryption. Collection names, membership, user names, entry/speaker fallback author names and user references, favorites and timestamps remain database metadata. Transport must use HTTPS in production. Losing the server key permanently loses access to encrypted entries; rotating it requires a migration that decrypts with the old key and reencrypts with the new one.

The existing reader editions, exports, search, filters and local display preferences remain. Search runs on decrypted authorized entries in the browser; plaintext search indexes are not stored in Supabase. Collections are loaded in database batches; very large collections still need a future server paging/search design to limit browser memory and egress. Entry imports and their attribution records are atomic per batch. Linked names resolve from the current member profile on every read/export. Fallback strings survive deleted accounts. `assign_collection_author(p_collection, p_author, p_user)` links every still-unlinked occurrence of an exact author name in that collection and returns the number of affected stories. The admin Names list contains only unresolved names.

## Free tier

All implemented Supabase capabilities are available on Free: PostgreSQL/RLS, email/password Auth, anonymous Auth, and database functions. No paid-only API, Storage, Realtime, SMTP delivery or Edge Function is required. Current limits: 500 MB database, 50,000 monthly active users and 5 GB egress; projects may pause after one week of inactivity. Automatic backups are not included. Back up both the database and encryption key. Anonymous users count toward Auth usage. See https://supabase.com/pricing and https://supabase.com/docs/guides/auth/auth-anonymous .

## Live acceptance checks

Use two browser profiles with different accounts and a configured project:

- Create a collection as A; B cannot read its rows or admin APIs before invitation acceptance.
- Open an invite while signed out as B; sign in or create a guest, land in the collection, and read entries. Repeat acceptance; only one membership exists.
- Revoke an invite; a third account cannot join. Check expired invitations are rejected.
- B can create entries and favorite them, but cannot rename/delete/import/invite/assign. A can perform those actions.
- A and B favorite the same entry; each can remove only their own favorite. Shared favorites retain the other member's favorite.
- Import original JSON and inspect the database: payloads contain ciphertext, not story text. All reader editions still display decrypted stories.
- Assign exact imported author names to B; attributed stories appear in B's profile. Create with member selection and free-text author selection.
- Upgrade B's guest account to email/password; its UUID and contributions remain; sign out and sign back in.
- Rename and delete a collection; deletion cascades to all its records.

Local tests cover encryption authentication/tampering, archive rendering preparation, import validation, JSON/Markdown exports and the actual SQL migration in embedded PostgreSQL (PGlite), with a mock Auth schema and authenticated role. They exercise membership isolation, admin permissions, expiration, per-user favorites, assignment membership and deletion cascades. A successful local build does not validate your hosted Auth configuration; run these live checks after setup.

The story editor edits formatted text directly and stores Markdown. Selection-aware formatting controls toggle existing styles, with keyboard shortcuts and undo/redo. There is no Write/Preview switch or paste notification. Rich-text clipboard HTML (including Teams/Office styled emphasis, lists, links, quotes and tables) is converted to Markdown before saving. Images, fonts and colors are not represented in Markdown. No pasted HTML is injected into the preview. The same editor is used for creating and revising stories.

