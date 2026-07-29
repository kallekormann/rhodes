import type { Editor } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import {
  extractDocumentImageStoragePath,
  imageServeUrl,
} from "@/lib/documents/document-image-urls";
import { findRelatedBlockInsertPosition } from "@/lib/insights/place-citation";

export { imageServeUrl } from "@/lib/documents/document-image-urls";

/** Match ui-mock: insert a new empty paragraph directly below the current doc block. */
export function insertParagraphAfterBlock(editor: Editor) {
  const { selection } = editor.state;

  if (selection instanceof NodeSelection) {
    const after = selection.from + selection.node.nodeSize;
    editor
      .chain()
      .insertContentAt(after, { type: "paragraph" })
      .run();
    focusParagraphAt(editor, after + 1);
    return;
  }

  const { $from } = selection;
  for (let depth = $from.depth; depth >= 1; depth -= 1) {
    if ($from.node(depth - 1).type.name === "doc") {
      const after = $from.after(depth);
      editor.chain().insertContentAt(after, { type: "paragraph" }).run();
      focusParagraphAt(editor, after + 1);
      return;
    }
  }
}

function focusParagraphAt(editor: Editor, pos: number) {
  const safePos = Math.min(Math.max(1, pos), editor.state.doc.content.size);
  const $pos = editor.state.doc.resolve(safePos);
  const selection = TextSelection.near($pos, 1);
  editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
  editor.view.focus();
}

export function insertParagraphAfterTable(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "table") {
      const after = $from.after(depth);
      editor
        .chain()
        .insertContentAt(after, { type: "paragraph" })
        .setTextSelection(after + 1)
        .run();
      return;
    }
  }
}

export type CitationPlacement = "cursor" | "related-block";

export type CitationInsertInput = {
  sourceId: string;
  sourceRefId?: string;
  originType?: string;
  sourceTitle: string;
  page: number | null;
  excerpt: string;
  locationLabel?: string;
  locationMetadata?: Record<string, unknown> | null;
  placement?: CitationPlacement;
  /** Recent writing context — used to pick a related block when placement is related-block. */
  queryContext?: string;
};

export function insertCitation(editor: Editor, input: CitationInsertInput) {
  const sourceRefId = input.sourceRefId ?? input.sourceId;
  const citation = {
    type: "citation",
    attrs: {
      sourceId: sourceRefId,
      sourceRefId,
      originType: input.originType ?? "source_chunk",
      sourceTitle: input.sourceTitle,
      page: input.page,
      locationLabel: input.locationLabel ?? "",
      locationMetadata: input.locationMetadata ?? null,
      excerpt: input.excerpt,
    },
  };

  if (input.placement === "related-block") {
    const pos = findRelatedBlockInsertPosition(editor, {
      insightText: input.excerpt,
      queryText: input.queryContext ?? "",
    });

    editor
      .chain()
      .focus()
      .insertContentAt(pos, citation)
      .setTextSelection(pos + 1)
      .scrollIntoView()
      .run();
    return;
  }

  editor.chain().focus().insertContent(citation).scrollIntoView().run();
}

/** Normalize image attrs to stable `/serve?path=` URLs (auth checked on serve). */
export async function resolveDocumentImageUrls(
  content: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return normalizeDocumentImageContent(content);
}

export function normalizeDocumentImageContent(
  content: Record<string, unknown>,
): Record<string, unknown> {
  const cloned = structuredClone(content);

  function walk(node: Record<string, unknown>) {
    if (node.type === "image") {
      const attrs = { ...((node.attrs as Record<string, unknown> | undefined) ?? {}) };
      const storagePath =
        (typeof attrs.storagePath === "string" && attrs.storagePath) ||
        extractDocumentImageStoragePath(
          typeof attrs.src === "string" ? attrs.src : null,
        );
      if (storagePath) {
        attrs.storagePath = storagePath;
        attrs.src = imageServeUrl(storagePath);
      }
      node.attrs = attrs;
    }
    const children = node.content;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && typeof child === "object") {
          walk(child as Record<string, unknown>);
        }
      }
    }
  }

  walk(cloned);
  return cloned;
}
