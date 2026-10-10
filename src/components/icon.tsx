import type { SVGProps } from "react";
export type IconName =
  | "crown"
  | "arrow"
  | "search"
  | "copy"
  | "check"
  | "grid"
  | "list"
  | "shuffle"
  | "book"
  | "scroll"
  | "sun"
  | "format"
  | "export"
  | "anchor"
  | "chevron";
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    crown: (
      <>
        <path d="m3 6 4 4 5-7 5 7 4-4-2 12H5L3 6Z" />
        <path d="M5 21h14" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    list: (
      <>
        <path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1" />
      </>
    ),
    shuffle: (
      <>
        <path d="m3 5 4 0 10 14h4M3 19h4L17 5h4M18 2l3 3-3 3M18 16l3 3-3 3" />
      </>
    ),
    book: (
      <>
        <path d="M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v16" />
      </>
    ),
    scroll: (
      <>
        <path d="M7 4h12a2 2 0 0 1 2 2v3h-4M7 4a2 2 0 0 0-2 2v12H3v1a2 2 0 0 0 2 2h12V6a2 2 0 0 1 2-2M5 21a2 2 0 0 0 2-2v-1h10M9 9h5M9 13h5" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    chevron: <path d="m8 4 8 8-8 8" />,
    format: <><path d="M4 5h16M8 5v14M5 19h6M15 11h6M18 8v6M15 19h6" /></>,
    export: <><path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5" /></>,
    anchor: <><circle cx="12" cy="4" r="2" /><path d="M12 6v15M8 10h8M3 14v3c0 3 4 5 9 5s9-2 9-5v-3M3 14l-2 3m2-3 3 2m15-2 2 3m-2-3-3 2" /></>,
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
