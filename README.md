# LoreKeeper

A glorious private archive for shared chronicles, built with Next.js, React, TypeScript and Supabase.

Read **SUPABASE.md** for the database migration, environment variables, Auth settings and setup steps before running the app.

```powershell
npm install
npm run dev
```

```powershell
npm run lint
npm test
npm run build
npm start
```

## Shared collections

Guest and email/password users can create collections, join invitation links, write entries, and favorite stories. Collection creators can rename/delete collections, import original JSON, invite members, revoke invitations and associate author names with members. Profiles include credentials, guest upgrades, account deletion, authored/submitted entries and personal favorites. Every member can export collections as JSON without internal IDs, as Markdown, or as a complete A4 PDF.

Choose **Export → PDF edition**, then select the display edition and reading font. All 27 editions have matching collection covers and end pages, a linked contents page and story bookmarks. Each story starts on a new page; long passages, lists and tables paginate within A4. The complete collection is included even when the view is filtered. PDFs are generated in the browser with progress and cancellation, then downloaded with **Save file**. Pages preserve the edition artwork as high-resolution images.

Supabase is the source of truth. `data/data.json` remains an import fixture and regression-test source; pages no longer publish it at build time. Entire entry payloads are encrypted on the Next.js server before database writes, with RLS enforcing access. See SUPABASE.md for the security model and key handling.

The original Hall design, search/filter/sort controls, grid/list views and reader editions are retained. Reader preferences remain browser-local. Markdown rendering, PDF/image downloads, source copying, maximized reading and previous/next navigation remain available. Historical fonts, parchment textures and ornaments are local assets. Font licenses are in `public/fonts`.

The scripts use Webpack and keep production output separate from development. Authenticated data is fetched per session through an uncached API; prerendered shells contain no story data. Search-engine indexing remains disabled.
