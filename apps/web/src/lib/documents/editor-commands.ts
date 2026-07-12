import type { Editor } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";

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

export function imageServeUrl(storagePath: string) {
  return `/app/api/documents/images/serve?path=${encodeURIComponent(storagePath)}`;
}

export type CitationInsertInput = {
  sourceId: string;
  sourceTitle: string;
  page: number | null;
  excerpt: string;
};

export function insertCitation(editor: Editor, input: CitationInsertInput) {
  editor
    .chain()
    .focus()
    .insertContent({
      type: "citation",
      attrs: {
        sourceId: input.sourceId,
        sourceTitle: input.sourceTitle,
        page: input.page,
        excerpt: input.excerpt,
      },
    })
    .run();
}

export async function resolveDocumentImageUrls(
  content: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const cloned = structuredClone(content);
  const paths: string[] = [];

  function walk(node: Record<string, unknown>) {
    if (node.type === "image") {
      const attrs = (node.attrs as Record<string, unknown> | undefined) ?? {};
      const storagePath =
        (typeof attrs.storagePath === "string" && attrs.storagePath) ||
        extractStoragePath(typeof attrs.src === "string" ? attrs.src : null);
      if (storagePath) paths.push(storagePath);
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
  if (paths.length === 0) return cloned;

  const unique = [...new Set(paths)];
  const response = await fetch("/app/api/documents/images/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths: unique }),
  });
  const data = await response.json().catch(() => ({}));
  const signed = (data.urls as Record<string, string> | undefined) ?? {};

  function apply(node: Record<string, unknown>) {
    if (node.type === "image") {
      const attrs = { ...((node.attrs as Record<string, unknown> | undefined) ?? {}) };
      const storagePath =
        (typeof attrs.storagePath === "string" && attrs.storagePath) ||
        extractStoragePath(typeof attrs.src === "string" ? attrs.src : null);
      if (storagePath) {
        attrs.storagePath = storagePath;
        attrs.src = signed[storagePath] ?? imageServeUrl(storagePath);
      }
      node.attrs = attrs;
    }
    const children = node.content;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && typeof child === "object") {
          apply(child as Record<string, unknown>);
        }
      }
    }
  }

  apply(cloned);
  return cloned;
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
        extractStoragePath(typeof attrs.src === "string" ? attrs.src : null);
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

function extractStoragePath(src: string | null): string | null {
  if (!src) return null;
  if (src.startsWith("blob:")) return null;
  try {
    const url = new URL(src, "http://localhost");
    const path = url.searchParams.get("path");
    return path || null;
  } catch {
    if (src.includes("/") && !src.startsWith("http")) return src;
    return null;
  }
}
