import Link from "next/link";
// The path back up, e.g. Interactive Stories / The Salt Debt / Lobby.
export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="eyebrow entry-breadcrumb lkx-crumbs" aria-label="Breadcrumb">
      {items.map((c, i) => (
        <span key={i} className="lkx-crumb">
          {i > 0 && <span aria-hidden="true">/</span>}
          {c.href ? (
            <Link href={c.href}>{c.label}</Link>
          ) : (
            <span aria-current={i === items.length - 1 ? "page" : undefined}>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
