export function messageRange<T extends { id: string }>(
  messages: T[],
  from: string,
  to: string,
): string[] {
  const a = messages.findIndex((m) => m.id === from),
    b = messages.findIndex((m) => m.id === to);
  if (a < 0 || b < 0) throw new Error("Choose both ends of the range.");
  return messages.slice(Math.min(a, b), Math.max(a, b) + 1).map((m) => m.id);
}
export function selectedMessages<T extends { id: string }>(
  messages: T[],
  ids: string[],
) {
  const set = new Set(ids);
  return messages.filter((m) => set.has(m.id));
}

export type ConversationMessage = {
  id: string;
  name: string;
  original: string;
  content: string | null;
  created_at: string;
  character?: { name: string } | null;
};
export function conversationMessages(
  messages: ConversationMessage[],
  originals = false,
) {
  return messages.map((m) => ({
    id: m.id,
    author: m.character?.name || m.name,
    timestamp: m.created_at,
    content:
      (m.content || m.original) +
      (originals && m.content && m.content !== m.original
        ? `\n\n> Original: ${m.original}`
        : ""),
    source: "LoreKeeper",
    sourceFormat: "markdown",
  }));
}
