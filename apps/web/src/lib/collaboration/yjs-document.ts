import * as Y from "yjs";

export const COLLAB_FRAGMENT = "default";

function xmlNodePlainText(node: Y.XmlElement | Y.XmlText | Y.XmlHook): string {
  if (node instanceof Y.XmlText) {
    return node.toString();
  }
  if (node instanceof Y.XmlElement) {
    let out = "";
    node.forEach((child) => {
      out += xmlNodePlainText(child);
    });
    return out;
  }
  return "";
}

/** True when the Y.Doc already has TipTap collaboration body content. */
export function ydocHasCollaborationBody(doc: Y.Doc): boolean {
  try {
    return doc.getXmlFragment(COLLAB_FRAGMENT).length > 0;
  } catch {
    return false;
  }
}

/**
 * True when the collab fragment contains visible text.
 * Empty paragraphs still make fragment.length > 0 — those must not block
 * seeding template/Postgres content into a fresh Y.Doc.
 */
export function ydocHasMeaningfulCollaborationBody(doc: Y.Doc): boolean {
  try {
    const fragment = doc.getXmlFragment(COLLAB_FRAGMENT);
    if (fragment.length === 0) return false;
    let out = "";
    fragment.forEach((node) => {
      out += xmlNodePlainText(node);
    });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}
