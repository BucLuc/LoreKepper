"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { playApi } from "@/lib/play-client";
import { ArchiveSkeleton } from "./vault-ui";
export function NewAdventure() {
  const router = useRouter(),
    pending = useRef<Promise<{ id: string }> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    // The ref spans React's double effect run in development, so one visit creates
    // one story. With cacheComponents the page stays mounted (hidden) after leaving,
    // so the promise is dropped once used: the next visit must create a new story,
    // not reopen the previous one.
    const creating = (pending.current ||= playApi("createAdventure", {}));
    creating
      .then((r) => {
        if (!alive) return;
        pending.current = null;
        router.replace(`/interactive/${r.id}`);
      })
      .catch((e) => {
        if (!alive) return;
        pending.current = null;
        setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [router]);
  return error ? (
    <main id="main" className="lk-page">
      <h1>A new tale</h1>
      <p className="lk-alert" role="alert">
        {error}
        <Link href="/login?next=%2Finteractive%2Fnew"> Sign in</Link>
      </p>
    </main>
  ) : (
    <ArchiveSkeleton page="lobby" />
  );
}
