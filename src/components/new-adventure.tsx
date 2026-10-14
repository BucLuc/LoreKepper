"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { playApi } from "@/lib/play-client";
export function NewAdventure() {
  const router = useRouter(),
    pending = useRef<Promise<{ id: string }> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    pending.current ||= playApi("createAdventure", {});
    pending.current
      .then((r) => {
        if (alive) router.replace(`/interactive/${r.id}?lobby=1`);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [router]);
  return (
    <main id="main" className="lk-page">
      <h1>Your story lobby</h1>
      {error ? (
        <p className="lk-alert" role="alert">
          {error}
          <Link href="/login?next=%2Finteractive%2Fnew"> Sign in</Link>
        </p>
      ) : (
        <p role="status">Opening your lobby…</p>
      )}
    </main>
  );
}
