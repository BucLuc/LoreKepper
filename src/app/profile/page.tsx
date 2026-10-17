import { Suspense } from "react";
import { ArchiveApp } from "@/components/archive-app";
import { ArchiveSkeleton } from "@/components/vault-ui";
type Props = { searchParams: Promise<{ tab?: string }> };
async function Profile({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <ArchiveApp
      mode="profile"
      initialProfileTab={params.tab === "settings" ? "settings" : undefined}
    />
  );
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<ArchiveSkeleton page="profile" />}>
      <Profile {...props} />
    </Suspense>
  );
}
