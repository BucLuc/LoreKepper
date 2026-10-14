import { remarkStoryReveal } from "@/lib/story-reveal";
import { useContext, useMemo, Children, isValidElement } from "react";
import { StoryInteractions } from "./story-interactions";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import {
  remarkEditionSections,
  remarkEditionSemantics,
} from "../lib/edition-markdown";

const DecisionParagraph: NonNullable<Components["p"]> = ({ children, className }) => {
  const renderDecision = useContext(StoryInteractions);
  return renderDecision && Children.toArray(children).some((child) =>
    isValidElement<{ href?: string }>(child) && child.props.href?.startsWith("#lore-decision-"),
  ) ? <div className={`lk-prose-paragraph ${className || ""}`}>{children}</div>
    : <p className={className}>{children}</p>;
};
const DecisionLink: NonNullable<Components["a"]> = ({ children, href }) => {
  const renderDecision = useContext(StoryInteractions);
  return href?.startsWith("#lore-decision-") && renderDecision
    ? renderDecision(href.slice("#lore-decision-".length))
    : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
};

export function EditionMarkdown({
  text,
  style,
}: {
  text: string;
  style: string;
}) {
  const renderDecision = useContext(StoryInteractions);
  // Stable component types keep prose, selections and answer inputs mounted
  // when realtime presence or the generation clock updates.
  const components = useMemo<Components>(() => ({
    p: DecisionParagraph,
    a: DecisionLink,
    img: ({ src, alt, title }) => typeof src === "string" && src.trim()
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={src} alt={alt ?? ""} title={title} />
      : alt ? <span className="pdf-image-unavailable">{alt}</span> : null,
    table: ({ children, ...props }) => style.startsWith("gallery-")
      ? <table {...props}>{children}</table>
      : <div className="edition-table" role="region" aria-label="Scrollable table" tabIndex={0}><table {...props}>{children}</table></div>,
  }), [style]);
  return (
    <div
      className={
        style.startsWith("gallery-")
          ? "gallery-prose"
          : "message-prose edition-prose"
      }
      data-edition={style}
    >
      <Markdown
        remarkPlugins={[
          remarkGfm,
          ...(style.startsWith("gallery-") ? [] : [remarkEditionSections]),
          remarkEditionSemantics(style),
          ...(renderDecision ? [remarkStoryReveal] : []),
        ]}
        skipHtml
        components={components}
      >
        {text}
      </Markdown>
    </div>
  );
}
