import { Hall } from "@/components/hall";
import { exhibits, archiveStats } from "@/lib/archive";
export default function Home() {
  return (
    <Hall
      exhibits={exhibits.map((e) => ({
        ...e,
        messages: e.messages.map((m) => ({
          id: m.id,
          source: m.source,
          author: m.author,
          timestamp: m.timestamp,
          content: m.content,
          sourceFormat: m.sourceFormat,
        })),
      }))}
      stats={archiveStats}
    />
  );
}
