/**
 * One-time safety net: import TipTap JSON into an empty local Y.Doc.
 * Prefers offline IDB; falls back to optional Postgres/projection content.
 */

import Collaboration from "@tiptap/extension-collaboration";
import StarterKit from "@tiptap/starter-kit";
import { Editor } from "@tiptap/core";
import * as Y from "yjs";
import { COLLAB_FRAGMENT, ydocHasMeaningfulCollaborationBody } from "@/lib/collaboration/yjs-document";
import { bodyRichness } from "@/lib/offline/document-body";
import { getOfflineDocument } from "@/lib/offline/documents-cache";

const SEEDED_MAP_KEY = "rhodes";
const SEEDED_FLAG = "seeded";

export async function seedYjsFromProjectionIfNeeded(
  documentId: string,
  doc: Y.Doc,
  fallbackContent?: Record<string, unknown> | null,
): Promise<boolean> {
  if (ydocHasMeaningfulCollaborationBody(doc)) return false;
  // Allow re-seed when a prior empty-paragraph bootstrap flipped `seeded`
  // without real text — otherwise template tips never appear.

  const offline = await getOfflineDocument(documentId);
  const content =
    offline?.content && bodyRichness(offline.content, offline.content_plain) > 0
      ? offline.content
      : fallbackContent && bodyRichness(fallbackContent, null) > 0
        ? fallbackContent
        : null;

  if (!content) return false;

  const editor = new Editor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: doc, field: COLLAB_FRAGMENT }),
    ],
    content,
  });

  try {
    if (!ydocHasMeaningfulCollaborationBody(doc)) {
      editor.commands.setContent(content);
    }
    doc.getMap(SEEDED_MAP_KEY).set(SEEDED_FLAG, true);
    return ydocHasMeaningfulCollaborationBody(doc);
  } finally {
    editor.destroy();
  }
}
