import { Suspense } from "react";
import { ArchiveApp } from "@/components/archive-app";
import { ArchiveSkeleton } from "@/components/vault-ui";
type Props = { params: Promise<{id:string}> };
async function Content({params}:Props) { const {id}=await params; return <ArchiveApp mode="collection" id={id} />; }
export default function Page(props:Props) { return <Suspense fallback={<ArchiveSkeleton page="collection"/>}><Content {...props}/></Suspense>; }
