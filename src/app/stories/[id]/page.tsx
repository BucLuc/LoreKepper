import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exhibits } from "@/lib/archive";
import { Reader } from "@/components/reader";
export function generateStaticParams() {
  return exhibits.map((entry) => ({ id: entry.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const entry = exhibits.find((e) => e.id === id);
  return { title: entry?.title ?? "Story not found" };
}
export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const index = exhibits.findIndex((e) => e.id === id);
  if (index === -1) notFound();
  const source = exhibits[index];
  const entry = {
    ...source,
    messages: source.messages.map((m) => ({
      id: m.id,
      source: m.source,
      author: m.author,
      timestamp: m.timestamp,
      content: m.content,
      sourceFormat: m.sourceFormat,
      presentation: m.presentation,
    })),
  };
  const adjacent = (offset: number) => {
    const e = exhibits[index + offset];
    return e ? { id: e.id, title: e.title } : null;
  };
  return (
    <Reader
      key={entry.id}
      entry={entry}
      previous={adjacent(-1)}
      next={adjacent(1)}
    />
  );
}
