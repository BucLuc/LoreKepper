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
  | "chevron"
  | "user"
  | "plus"
  | "star"
  | "settings"
  | "logout"
  | "close"
  | "edit"
  | "users"
  | "link"
  | "shield"
  | "more"
  | "trash";
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    more: <><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></>,
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    star: (
      <path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2L3.2 9.6l6-.9L12 3Z" />
    ),
    settings: (
      <>
        <path d="M22.000 12.000L21.808 13.951L19.391 15.061L18.652 16.445L19.071 19.071L17.556 20.315L15.061 19.391L13.561 19.846L12.000 22.000L10.049 21.808L8.939 19.391L7.555 18.652L4.929 19.071L3.685 17.556L4.609 15.061L4.154 13.561L2.000 12.000L2.192 10.049L4.609 8.939L5.348 7.555L4.929 4.929L6.444 3.685L8.939 4.609L10.439 4.154L12.000 2.000L13.951 2.192L15.061 4.609L16.445 5.348L19.071 4.929L20.315 6.444L19.391 8.939L19.846 10.439Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    logout: (
      <>
        <path d="M9 4H4v16h5M9 12h12m-4-4 4 4-4 4" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    edit: (
      <>
        <path d="m14 4 6 6M4 20l5-1L21 7l-4-4L5 15l-1 5ZM13 20h8" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2" />
      </>
    ),
    link: (
      <>
        <path d="m9 15 6-6M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
      </>
    ),
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
    format: (
      <>
        <path d="M4 5h16M8 5v14M5 19h6M15 11h6M18 8v6M15 19h6" />
      </>
    ),
    export: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5" />
      </>
    ),
    anchor: (
      <>
        <circle cx="12" cy="4" r="2" />
        <path d="M12 6v15M8 10h8M3 14v3c0 3 4 5 9 5s9-2 9-5v-3M3 14l-2 3m2-3 3 2m15-2 2 3m-2-3-3 2" />
      </>
    ),
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
