import { ArchiveApp } from "@/components/archive-app";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArchiveSkeleton } from "@/components/vault-ui";
export default function Page(props:{params:Promise<{id:string;view:string}>}) { return <Suspense fallback={<ArchiveSkeleton page="collection"/>}><Content {...props}/></Suspense>; }
async function Content({
  params,
}: {
  params: Promise<{ id: string; view: string }>;
}) {
  const { id, view } = await params;
  if (view === "admin") redirect(`/collections/${id}/settings`);
  if (!["settings", "new", "favorites"].includes(view)) notFound();
  return <ArchiveApp mode={view} id={id} />;
}
