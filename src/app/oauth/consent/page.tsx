import { Suspense } from "react";
import { OAuthConsent } from "@/components/oauth-consent";
import { ArchiveSkeleton } from "@/components/vault-ui";
async function Content({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  return <OAuthConsent authorizationId={p.authorization_id || ""} />;
}
export default function Page(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <Suspense fallback={<ArchiveSkeleton page="login" />}>
      <Content {...props} />
    </Suspense>
  );
}
