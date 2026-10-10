import { Suspense } from "react";
import { ArchiveApp } from "@/components/archive-app";
import { ArchiveSkeleton } from "@/components/vault-ui";
type Props = { params: Promise<{token:string}> };
async function Content({params}:Props) { const {token}=await params; return <ArchiveApp mode="invite" token={token} />; }
export default function Page(props:Props) { return <Suspense fallback={<ArchiveSkeleton page="invite"/>}><Content {...props}/></Suspense>; }
