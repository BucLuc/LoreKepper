type Node = {
  type: string;
  value?: string;
  url?: string;
  children?: Node[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
};
// Annotate only the latest scene. CSS reveals words without reparsing the book every frame.
export function remarkStoryReveal() {
  return (root: Node) => {
    let active = false,
      index = 0;
    const walk = (node: Node) => {
      if (
        node.type === "paragraph" &&
        node.children?.some(
          (c) => c.type === "link" && c.url?.startsWith("#lore-decision-"),
        )
      ) {
        const link = node.children.find(
          (c) => c.type === "link" && c.url?.startsWith("#lore-decision-"),
        );
        active = !!link?.url?.startsWith("#lore-decision-scene-");
        if (active) index = 0;
        return;
      }
      if (node.children)
        node.children = node.children.flatMap((child) => {
          if (active && child.type === "text" && child.value) {
            return (child.value.match(/\S+\s*|\s+/g) || []).map((word) =>
              word.trim()
                ? {
                    type: "emphasis",
                    data: {
                      hName: "span",
                      hProperties: {
                        className: ["lk-reveal-word"],
                        style: `--word:${index++}`,
                      },
                    },
                    children: [{ type: "text", value: word }],
                  }
                : { type: "text", value: word },
            );
          }
          walk(child);
          return [child];
        });
    };
    walk(root);
  };
}
