type JsonNode = {
  type?: string;
  text?: string;
  content?: JsonNode[];
};

export function extractPlainText(node: unknown): string {
  if (!node || typeof node !== "object") return "";

  const json = node as JsonNode;

  if (json.type === "text" && typeof json.text === "string") {
    return json.text;
  }

  if (!Array.isArray(json.content)) return "";

  const parts = json.content.map((child) => extractPlainText(child));
  const blockTypes = new Set([
    "paragraph",
    "heading",
    "blockquote",
    "listItem",
    "codeBlock",
    "citation",
  ]);

  if (json.type && blockTypes.has(json.type)) {
    return `${parts.join("")}\n`;
  }

  return parts.join("");
}
