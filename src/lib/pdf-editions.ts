export type PdfEdition = {
  cover: string;
  end: string;
  subtitle: string;
  closing: string;
};
export const pdfEditions: Record<string, PdfEdition> = Object.fromEntries([
  ["ancientcodex", "Incipit liber", "Explicit liber", "A book of preserved memories", "Here ends the book. May these words endure."],
  ["manuscript", "The illuminated archive", "The final folio", "The collected book of remarkable deeds", "The hand rests. The chronicle remains."],
  ["scroll", "The collected scrolls", "The last fragment", "Wisdom recovered from the archives", "The scrolls are gathered. Their words are preserved."],
  ["decree", "The royal register", "Given under our seal", "The collected proclamations of the archive", "So recorded. So witnessed. So preserved."],
  ["glorious", "The immortal chronicles", "The legend endures", "A treasury of deeds worthy of remembrance", "The volume closes. Its glory remains."],
  ["poetry", "Collected verses", "The last verse", "Fragments gathered into one volume", "A final silence between the words."],
  ["prophecy", "The book of visions", "The final revelation", "The gathered signs and foretold tales", "The visions have been recorded."],
  ["captain", "The captain’s collected logs", "Voyage concluded", "The ship’s journal, bound for posterity", "Log closed. May the tale outlive the tide."],
  ["tavern", "Tales from the tavern", "Until the next tale", "Records gathered beside the hearth", "The fire settles. The stories remain."],
  ["wanted", "The collected warrants", "Register closed", "Notices preserved by the archive", "All notices accounted for."],
  ["light", "Collected stories", "The end", "The complete collection", "Every story in this collection has been preserved."],
  ["dark", "Collected stories", "The end", "The complete collection", "Every story in this collection has been preserved."],
  ["newspaper", "The collected editions", "The final edition", "The Lorekeeper Gazette · bound archive", "End of this volume. The archive continues."],
  ["social", "The archived feed", "You’re all caught up", "Every post, gathered in one collection", "The complete feed has been preserved."],
  ["news", "The complete coverage", "Coverage concluded", "The LK24 collected archive", "All reports in this volume are now on record."],
  ["incident", "Internal records binder", "Collection closed", "Collected incident statements · internal archive", "All statements are retained in this archive."],
  ["card", "The collector’s album", "Album complete", "The complete collection of story cards", "Every card in this volume is accounted for."],
  ["terminal", "Archive bundle", "Export complete", "lorekeeper archive · complete collection", "All records written. Integrity preserved."],
  ["space", "Transmission archive", "End of transmission", "Collected relay records", "The complete payload has been preserved."],
  ["bug", "The issue archive", "Archive complete", "A collected register of reports", "Every report in this volume is accounted for."],
  ["screenplay", "The collected scripts", "Fade out", "A volume of preserved scenes", "The scripts end. The stories endure."],
  ["dossier", "The collected files", "End of dossier", "Directorate archive · collected evidence", "All files returned to the archive."],
  ["museum", "The collection catalogue", "Catalogue complete", "The museum’s collected exhibits", "Every exhibit in this catalogue is preserved."],
  ["court", "Collected proceedings", "Record concluded", "The complete volume of recorded testimony", "The proceedings in this volume are on record."],
  ["academic", "Collected papers", "End of volume", "The collected journal of the archive", "All papers in this volume have been preserved."],
  ["letter", "Collected correspondence", "Yours, for posterity", "A bound archive of letters", "The correspondence is complete."],
  ["lyrics", "The collected songbook", "The final note", "Words gathered into one volume", "The last note fades. The words remain."],
].map(([id, cover, end, subtitle, closing]) => [id, { cover, end, subtitle, closing }]));
export const A4_MM = { width: 210, height: 297 } as const;
