/**
 * One-time safety net: import TipTap JSON from IDB into an empty local Y.Doc.
 */

import Collaboration from "@tiptap/extension-collaboration";
import StarterKit from "@tiptap/starter-kit";
import { Editor } from "@tiptap/core";
import * as Y from "yjs";
import { COLLAB_FRAGMENT, ydocHasCollaborationBody } from "@/lib/collaboration/yjs-document";
import { bodyRichness } from "@/lib/offline/document-body";
import { getOfflineDocument } from "@/lib/offline/documents-cache";

const SEEDED_MAP_KEY = "rhodes";
const SEEDED_FLAG = "seeded";

export async function seedYjsFromProjectionIfNeeded(
  documentId: string,
  doc: Y.Doc,
): Promise<boolean> {
  if (ydocHasCollaborationBody(doc)) return false;
  if (doc.getMap(SEEDED_MAP_KEY).get(SEEDED_FLAG) === true) return false;

  const offline = await getOfflineDocument(documentId);
  if (!offline?.content) return false;

  const rich = bodyRichness(offline.content, offline.content_plain);
  if (rich === 0) return false;

  const editor = new Editor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: doc, field: COLLAB_FRAGMENT }),
    ],
    content: offline.content,
  });

  try {
    if (!ydocHasCollaborationBody(doc)) {
      editor.commands.setContent(offline.content);
    }
    doc.getMap(SEEDED_MAP_KEY).set(SEEDED_FLAG, true);
    return ydocHasCollaborationBody(doc);
  } finally {
    editor.destroy();
  }
}
