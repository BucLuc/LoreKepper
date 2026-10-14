"use client";
import { useEffect, useState } from "react";
import { playApi } from "@/lib/play-client";
export type PickedUser = { id: string; name: string };
export function UserPicker({
  selected,
  onChange,
  multiple = true,
  excluded = [],
}: {
  selected: PickedUser[];
  onChange: (users: PickedUser[]) => void;
  multiple?: boolean;
  excluded?: string[];
}) {
  const [query, setQuery] = useState(""),
    [users, setUsers] = useState<PickedUser[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => {
      playApi("findUsers", { query: query.trim() })
        .then((r) => {
          if (alive) {
            setUsers(r.users);
            setError("");
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <div className="lk-user-picker">
      <label>
        Find users by display name
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type at least two characters…"
          maxLength={100}
        />
      </label>
      {selected.length > 0 && (
        <div className="lk-picked-users">
          {selected.map((u) => (
            <button
              type="button"
              key={u.id}
              onClick={() => onChange(selected.filter((x) => x.id !== u.id))}
            >
              {u.name} ×
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && (
        <div className="lk-user-results">
          {users
            .filter((u) => !excluded.includes(u.id))
            .map((u) => (
              <button
                type="button"
                key={u.id}
                aria-pressed={selected.some((x) => x.id === u.id)}
                onClick={() =>
                  onChange(
                    selected.some((x) => x.id === u.id)
                      ? selected.filter((x) => x.id !== u.id)
                      : multiple
                        ? [...selected, u]
                        : [u],
                  )
                }
              >
                <strong>{u.name}</strong>
                <small>{u.id.slice(0, 8)}</small>
                <span>{selected.some((x) => x.id === u.id) ? "✓" : "+"}</span>
              </button>
            ))}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
