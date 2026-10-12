import type { Root, RootContent, BlockContent, DefinitionContent } from "mdast";

/** Work on the parsed tree, never regex-split Markdown (which breaks fences/lists). */
export function remarkEditionSections() {
  return (tree: Root) => {
    const output: RootContent[] = [];
    let section: RootContent[] | undefined;
    let index = 0;
    for (const node of tree.children) {
      if (node.type === "heading" && node.depth <= 2) {
        section = [];
        index += 1;
        // A standard HTML section keeps the original heading and all content intact.
        output.push({
          type: "blockquote",
          children: section as (BlockContent | DefinitionContent)[],
          data: {
            hName: "section",
            hProperties: {
              className: ["edition-section"],
              "data-section": String(index).padStart(2, "0"),
            },
          },
        });
      }
      (section ?? output).push(node);
    }
    tree.children = output;
  };
}

/** Recognize document conventions on parsed paragraphs without changing a word. */
export function remarkEditionSemantics(style: string) {
  return () => (tree: Root) => {
    const textOf = (node: RootContent): string => {
      if ("value" in node && typeof node.value === "string") return node.value;
      return "children" in node
        ? (node.children as RootContent[]).map(textOf).join("")
        : "";
    };
    const walk = (node: RootContent) => {
      if (node.type === "paragraph") {
        const text = textOf(node).trim();
        let kind = "";
        if (style === "screenplay" && !text.includes("\n")) {
          if (/^(INT\.|EXT\.|INT\/EXT\.)\s/i.test(text)) kind = "script-slug";
          else if (
            text.length < 55 &&
            /\p{L}/u.test(text) &&
            text === text.toLocaleUpperCase()
          )
            kind = "script-character";
          else if (/^\([^\n]+\)$/.test(text)) kind = "script-direction";
        }
        if (style === "court" && /^[QA]:\s/.test(text)) kind = "court-question";
        if (
          ["letter", "incident"].includes(style) &&
          /^(Subject|Betreff|From|To|Date|Datum|Von|An):\s/i.test(text)
        )
          kind = "correspondence-field";
        if (
          style === "bug" &&
          /^(Expected|Actual|Steps to reproduce|Environment):\s/i.test(text)
        )
          kind = "issue-detail";
        if(style.startsWith("gallery-")){
          if(/^(The Year of Our Lord|Im Jahre des Herrn) \d{3,4}\b/i.test(text)) kind="setting-note";
          else if(/^(Subject|Betreff|From|To|Date|Datum|Von|An|Ort|Location|Author|Verfasser|Setting):\s/i.test(text))kind="manuscript-field";
        }
        if (kind)
          node.data = {
            ...node.data,
            hProperties: { ...node.data?.hProperties, className: [kind] },
          };
      }
      if(style.startsWith("gallery-") && node.type==="blockquote" && /^\s*\[!(SETTING|NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(textOf(node))){
        const first=node.children[0];
        if(first?.type==="paragraph" && first.children[0]?.type==="text")first.children[0].value=first.children[0].value.replace(/^\s*\[![A-Z]+\]\s*/i,"");
        node.data={...node.data,hName:"div",hProperties:{className:["setting-note"],role:"note"}};
      }
      if ("children" in node) (node.children as RootContent[]).forEach(walk);
    };
    tree.children.forEach(walk);
  };
}
