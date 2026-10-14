import { Suspense } from "react";
import { ArchiveApp } from "@/components/archive-app";
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
    <Suspense fallback={<p>Loading profile�</p>}>
      <Profile {...props} />
    </Suspense>
  );
}
