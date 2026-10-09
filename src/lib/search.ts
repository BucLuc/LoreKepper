type Searchable = { title: string; messages: { content: string }[] };
export function normalizeSearch(text: string) {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[*_`#]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
export function matchesStory(entry: Searchable, query: string) {
  const needle = normalizeSearch(query);
  return (
    !needle ||
    [entry.title, ...entry.messages.map((m) => m.content)].some((text) =>
      normalizeSearch(text).includes(needle),
    )
  );
}
