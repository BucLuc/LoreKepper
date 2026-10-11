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
    <div className="message-prose edition-prose" data-edition={style}>
      <Markdown
        remarkPlugins={[
          remarkGfm,
          remarkEditionSections,
          remarkEditionSemantics(style),
        ]}
        skipHtml
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children, ...props }) => (
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
