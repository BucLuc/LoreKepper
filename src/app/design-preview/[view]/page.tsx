import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DesignPreview } from "./preview";
// Development-only visual harness for interactive stories (no auth, mock data).
async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<{ edition?: string; pages?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await params;
  const { edition, pages } = await searchParams;
  return <DesignPreview view={view} edition={edition || "gallery-codex"} pages={pages === "1"} />;
}
export default function Page(props: {
  params: Promise<{ view: string }>;
  searchParams: Promise<{ edition?: string; pages?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <Content {...props} />
    </Suspense>
  );
}
