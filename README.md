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

Each display format keeps its original layout. The compact **Customize** panel has three tabs: **Background**, **Font** and **Options**. Background swatches change only the page surface and colors, including cotton rag, laid paper, ivory vellum, rose parchment, blue-grey stock and antique golden parchment; font arrows compare bundled typefaces. Options belong to the selected format: illuminated borders and initials, transcript numbering, newspaper columns, or decorative artwork. The panel stays available while scrolling. Saved older mixed-part arrangements migrate back to the selected format’s original header, body and footer. Reset restores that format’s defaults.


Choose **Export → PDF edition** to customize the entire collection. Cover and end pages are disabled by default; enabling either selects the current preset’s artwork, which can be replaced independently and adapts to the chosen background. The export dialog previews a measured A4 story page plus enabled bookends, with enlarged views. Each story starts on a new page; long passages, lists and tables paginate within A4, including two-column editions. A linked contents page and story bookmarks point to the correct pages whether bookends are enabled or not. The complete collection is included even when the view is filtered. PDFs are generated in the browser with progress and cancellation. Chrome and Edge open a native **Save As** dialog before rendering; other browsers offer **Save file** as a download fallback. Pages preserve the artwork as high-resolution images.

Supabase is the source of truth. `data/data.json` remains an import fixture and regression-test source; pages no longer publish it at build time. Entire entry payloads are encrypted on the Next.js server before database writes, with RLS enforcing access. See SUPABASE.md for the security model and key handling.

The original Hall design, search/filter/sort controls, grid/list views and reader editions are retained. Reader preferences remain browser-local. Markdown rendering, PDF/image downloads, source copying, maximized reading and previous/next navigation remain available. Historical fonts, parchment textures and ornaments are local assets. Font licenses are in `public/fonts`.

The scripts use Webpack and keep production output separate from development. Authenticated data is fetched per session through an uncached API; prerendered shells contain no story data. Search-engine indexing remains disabled.
