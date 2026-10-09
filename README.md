# LoreKeeper

A deliberately glorious Hall of Fame for Luc and Liri’s messages. Built with Next.js App Router, React, TypeScript, and Tailwind CSS.

## Run locally

```powershell
npm install
npm run dev
```

Open http://localhost:3000. Use `npm run dev -- --port 3001` if that port is occupied.

```powershell
npm run lint
npm test
npm run build
npm start
```

The dev and build scripts use Webpack because Turbopack’s native Windows path resolution fails inside the Codex sandbox. The JavaScript config also avoids a separate native TypeScript config-transpilation step. The historical editions use locally hosted IM Fell English and UnifrakturMaguntia fonts under the SIL Open Font License (license files are in `public/fonts`). Modern editions keep their system fonts. The aged parchment texture and heraldic ornaments are local SVG assets; reading requires no external font or image requests.

## The collection

`data/data.json` is the source of truth. The app reads its `entries` array at build time, preserving stable entry IDs and every message in each conversation. Add entries there using the existing structure, then restart development or rebuild production. Original source data is never edited by the reader. There is no editor or database in this first version.

The hall provides full-text search, author/source/type filters, rating/date/title/length sorting, grid and list views, pagination, and a random-story button. `/` focuses search. Short and full Teams author names resolve to Luc and Liri. WhatsApp timestamps are interpreted in Europe/Zurich; Teams UTC timestamps are displayed in that zone.

Each story has a direct `/stories/<id>` URL and twenty-three editions, including: Glorious, Newspaper, Medieval Manuscript, Ancient Scroll, Royal Decree, Movie Screenplay, Social Media Post, Corporate Incident Report, Classified Dossier, Formal Letter, and Terminal Archive. These change presentation, not the words. Style suggestions are based on the entry title and conversation type.

The reader supports adjustable text size, unformatted source text, copying the entire story, copying conversations with attribution, maximized reading (Escape to restore), downloading the selected edition as an A4 PDF, and previous/next navigation. Reader preferences persist locally in the browser. If clipboard access is unavailable, a selectable manual-copy box appears.

Markdown is rendered safely. Teams HTML originals are converted to Markdown on the server; embedded scripts, styles, frames, and images are removed. One source entry contains HTML in its nominally plain-text content; that entry is also converted to readable text for search and copying. ASCII art retains monospace spacing and scrolls independently.

## Access

This version is a local archive without authentication. Search-engine indexing is disabled, but this is not access control. Add authentication before deploying the collection somewhere accessible to others.

The twelve additional editions are Museum Exhibit, Court Transcript, Poetry, Tavern Noticeboard, Wanted Poster, Trading Card, Space Transmission, Prophecy, Academic Paper, Breaking News, Bug Report, and Album Lyrics. The selector groups all editions into five collapsible categories. Decorative labels describe the presentation; original message wording is preserved.


