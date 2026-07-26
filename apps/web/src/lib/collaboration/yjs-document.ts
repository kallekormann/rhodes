import * as Y from "yjs";

export const COLLAB_FRAGMENT = "default";

/** True when the Y.Doc already has TipTap collaboration body content. */
export function ydocHasCollaborationBody(doc: Y.Doc): boolean {
  try {
    return doc.getXmlFragment(COLLAB_FRAGMENT).length > 0;
  } catch {
    return false;
  }
}
