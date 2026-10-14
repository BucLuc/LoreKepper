"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function MainNavigation() {
  const path = usePathname();
  return <NavigationLinks path={path} />;
}
export function NavigationLinks({ path = "" }: { path?: string }) {
  return (
    <>
      {[
        ["/", "Collections"],
        ["/interactive", "Interactive Stories"],
        ["/chat", "Chat"],
      ].map(([href, label]) => {
        const active =
          href === "/"
            ? path === "/" ||
              path.startsWith("/collections") ||
              path.startsWith("/stories")
            : path.startsWith(href);
        return (
          <span className="lk-nav-item" key={href}>
            {href === "/interactive" && (
              <span className="lk-nav-separator" aria-hidden="true">
                |
              </span>
            )}
            <Link
              className="lk-main-link"
              href={href}
              key={href}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          </span>
        );
      })}
    </>
  );
}
