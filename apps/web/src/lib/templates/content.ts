type ContentNode = Record<string, unknown>;

function extractHeadingText(node: ContentNode): string {
  const children = node.content;
  if (!Array.isArray(children)) return "";
  return children
    .map((child) => {
      if (!child || typeof child !== "object") return "";
      return typeof (child as ContentNode).text === "string"
        ? ((child as ContentNode).text as string)
        : "";
    })
    .join("");
}

/** Remove a leading heading that duplicates the document title field. */
export function stripLeadingTitleHeading(
  content: Record<string, unknown>,
  title: string,
): Record<string, unknown> {
  const cloned = structuredClone(content);
  const children = cloned.content;
  if (!Array.isArray(children) || children.length === 0) return cloned;

  const first = children[0] as ContentNode;
  if (first.type !== "heading") return cloned;

  const headingText = extractHeadingText(first).trim();
  const normalizedTitle = title.trim();
  if (
    headingText &&
    normalizedTitle &&
    headingText.toLowerCase() === normalizedTitle.toLowerCase()
  ) {
    children.shift();
  }

  return cloned;
}
