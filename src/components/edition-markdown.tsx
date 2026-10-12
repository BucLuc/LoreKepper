import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  remarkEditionSections,
  remarkEditionSemantics,
} from "../lib/edition-markdown";

export function EditionMarkdown({
  text,
  style,
}: {
  text: string;
  style: string;
}) {
  return (
    <div className={style.startsWith("gallery-")?"gallery-prose":"message-prose edition-prose"} data-edition={style}>
      <Markdown
        remarkPlugins={[
          remarkGfm,
          ...(style.startsWith("gallery-")?[]:[remarkEditionSections]),
          remarkEditionSemantics(style),
        ]}
        skipHtml
        components={{
          // Markdown can contain empty URLs or URLs rejected by its safe URL transform.
          // eslint-disable-next-line @next/next/no-img-element
          img: ({src,alt,title}) => typeof src === "string" && src.trim() ? <img src={src} alt={alt??""} title={title}/> : alt ? <span className="pdf-image-unavailable">{alt}</span> : null,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children, ...props }) => style.startsWith("gallery-") ? <table {...props}>{children}</table> : (
            <div
              className="edition-table"
              role="region"
              aria-label="Scrollable table"
              tabIndex={0}
            >
              <table {...props}>{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
