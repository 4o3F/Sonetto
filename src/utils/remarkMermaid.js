/**
 * Keep Mermaid source out of Shiki and emit an escaped, readable fallback.
 * HAST data works in both Markdown and MDX without injecting raw HTML.
 * @returns {(tree: import('mdast').Root) => void}
 */
export default function remarkMermaid() {
  return tree => {
    /** @param {import('mdast').Nodes} node */
    function visit(node) {
      if (!("children" in node)) return;
      node.children.forEach((child, index) => {
        if (child.type !== "code" || child.lang !== "mermaid") {
          visit(child);
          return;
        }
        // A paragraph avoids the extra <pre> wrapper of the code-node handler.
        node.children[index] = {
          type: "paragraph",
          children: [],
          data: {
            hName: "div",
            hProperties: { className: ["mermaid-diagram", "not-prose"] },
            hChildren: [
              {
                type: "element",
                tagName: "pre",
                properties: { className: ["mermaid-source"] },
                children: [{ type: "text", value: child.value }],
              },
            ],
          },
        };
      });
    }
    visit(tree);
  };
}
