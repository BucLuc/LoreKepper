import { PlayJoin } from "@/components/play-join";
import { Suspense } from "react";
import { ArchiveSkeleton } from "@/components/vault-ui";
async function Content({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PlayJoin token={token} />;
}
export default function Page(props: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<ArchiveSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
