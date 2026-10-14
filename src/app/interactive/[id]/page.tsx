import { PlaySession } from "@/components/play-session";
import { Suspense } from "react";
import { ArchiveSkeleton } from "@/components/vault-ui";
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlaySession id={id} />;
}
export default function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ArchiveSkeleton story />}>
      <Content {...props} />
    </Suspense>
  );
}
