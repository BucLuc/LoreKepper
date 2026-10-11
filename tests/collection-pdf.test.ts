import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CollectionBookend } from "../src/components/collection-bookend";
import { readerEditions, editionGroups } from "../src/lib/reader-editions";
import { readerFonts } from "../src/lib/reader-fonts";
import { pdfEditions, A4_MM } from "../src/lib/pdf-editions";
import { exportCollectionPdf } from "../src/lib/export-collection-pdf";
import type { Exhibit } from "../src/lib/archive";
test("collection PDF offers every reader edition once with complete bookends", () => {
  assert.deepEqual(A4_MM, { width: 210, height: 297 });
  const editions = readerEditions.map(e => e.id).sort();
  assert.deepEqual(Object.keys(pdfEditions).sort(), editions);
  assert.deepEqual(editionGroups.flatMap(g => g.ids).sort(), editions);
  for (const edition of readerEditions) {
    const font = readerFonts(edition.id).at(-1)!;
    for (const end of [false, true]) {
      const html = renderToStaticMarkup(createElement(CollectionBookend, { name: 'A <script>collection</script>', count: 228, style: edition.id, font: font.id, end }));
      assert.ok(html.includes(end ? pdfEditions[edition.id].end : pdfEditions[edition.id].cover), edition.id);
      assert.ok(html.includes('228'), edition.id);
      assert.ok(html.includes(`data-font="${font.id}"`), edition.id);
      assert.ok(html.includes('&lt;script&gt;collection&lt;/script&gt;'), edition.id);
      assert.ok(!html.includes('<script>'), edition.id);
    }
  }
});
test("invalid and cancelled collection PDF requests stop before rendering", async () => {
  const options = { name: "Collection", entries: [] as Exhibit[], edition: "light", font: "default" };
  await assert.rejects(exportCollectionPdf(options), /no stories/);
  const populated = { ...options, entries: [{} as Exhibit] };
  await assert.rejects(exportCollectionPdf({ ...populated, edition: "missing" }), /valid display edition/);
  await assert.rejects(exportCollectionPdf({ ...populated, font: "missing" }), /Choose a font/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(exportCollectionPdf({ ...populated, signal: controller.signal }), error => (error as Error).name === "AbortError");
});
