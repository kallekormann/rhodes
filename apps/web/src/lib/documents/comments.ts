import type { Editor } from "@tiptap/react";
import { ensureEditorBlockIds } from "@/lib/documents/block-ids";
import {
  getBlockIdForPos,
  getTopLevelBlockIndexFromPos,
} from "@/lib/documents/block-drag";

export type StoredDocumentComment = {
  id: string;
  parentId?: string;
  blockId: string;
  blockIndex: number;
  from: number;
  to: number;
  anchorText: string;
  text: string;
  author: string;
  createdAt: string;
};

const COMMENTS_KEY = "comments";

function isComment(value: unknown): value is StoredDocumentComment {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.from === "number" &&
    typeof record.to === "number" &&
    typeof record.anchorText === "string" &&
    typeof record.text === "string" &&
    typeof record.author === "string" &&
    typeof record.createdAt === "string" &&
    (record.parentId === undefined ||
      record.parentId === null ||
      typeof record.parentId === "string") &&
    (record.blockId === undefined || typeof record.blockId === "string") &&
    (record.blockIndex === undefined || typeof record.blockIndex === "number")
  );
}

function collectCommentHighlightRanges(editor: Editor) {
  const ranges = new Map<string, { from: number; to: number }>();
  const { doc } = editor.state;

  doc.descendants((node, pos) => {
    if (!node.isText) return;

    for (const mark of node.marks) {
      if (mark.type.name !== "commentHighlight" || !mark.attrs.commentId) continue;

      const id = String(mark.attrs.commentId);
      const start = pos;
      const end = pos + node.nodeSize;
      const existing = ranges.get(id);

      if (!existing) {
        ranges.set(id, { from: start, to: end });
        continue;
      }

      ranges.set(id, {
        from: Math.min(existing.from, start),
        to: Math.max(existing.to, end),
      });
    }
  });

  return ranges;
}

export function syncCommentsWithDocument(
  editor: Editor,
  comments: StoredDocumentComment[],
): StoredDocumentComment[] {
  ensureEditorBlockIds(editor);

  const rangeById = collectCommentHighlightRanges(editor);
  let changed = false;

  const next = comments.map((comment) => {
    const range = rangeById.get(comment.id);
    const from = range?.from ?? comment.from;
    const to = range?.to ?? comment.to;
    const blockIndex =
      getTopLevelBlockIndexFromPos(editor, from) ??
      comment.blockIndex ??
      0;
    const blockId = getBlockIdForPos(editor, from) || comment.blockId || "";

    if (
      comment.from !== from ||
      comment.to !== to ||
      comment.blockId !== blockId ||
      comment.blockIndex !== blockIndex
    ) {
      changed = true;
      return { ...comment, from, to, blockId, blockIndex };
    }

    return comment;
  });

  const rootById = new Map(
    next.filter((comment) => !comment.parentId).map((comment) => [comment.id, comment]),
  );

  const withSyncedReplies = next.map((comment) => {
    if (!comment.parentId) return comment;

    const parent = rootById.get(comment.parentId);
    if (!parent) return comment;

    if (
      comment.from !== parent.from ||
      comment.to !== parent.to ||
      comment.blockId !== parent.blockId ||
      comment.blockIndex !== parent.blockIndex
    ) {
      changed = true;
      return {
        ...comment,
        from: parent.from,
        to: parent.to,
        blockId: parent.blockId,
        blockIndex: parent.blockIndex,
        anchorText: parent.anchorText,
      };
    }

    return comment;
  });

  return changed ? withSyncedReplies : comments;
}

export function parseDocumentComments(
  metadata: Record<string, unknown> | null | undefined,
): StoredDocumentComment[] {
  const raw = metadata?.[COMMENTS_KEY];
  if (!Array.isArray(raw)) return [];

  return raw.filter(isComment).map((comment) => ({
    ...comment,
    parentId: comment.parentId ?? undefined,
    blockId: comment.blockId ?? "",
    blockIndex:
      typeof comment.blockIndex === "number" ? comment.blockIndex : 0,
  }));
}

export function withDocumentComments(
  metadata: Record<string, unknown> | null | undefined,
  comments: StoredDocumentComment[],
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    [COMMENTS_KEY]: comments,
  };
}

export function createDocumentComment(input: {
  parentId?: string;
  blockId: string;
  blockIndex: number;
  from: number;
  to: number;
  anchorText: string;
  text: string;
  author: string;
}): StoredDocumentComment {
  return {
    id: crypto.randomUUID(),
    parentId: input.parentId,
    blockId: input.blockId,
    blockIndex: input.blockIndex,
    from: input.from,
    to: input.to,
    anchorText: input.anchorText,
    text: input.text,
    author: input.author,
    createdAt: new Date().toISOString(),
  };
}

export function getRootComments(
  comments: StoredDocumentComment[],
): StoredDocumentComment[] {
  return comments.filter((comment) => !comment.parentId);
}

export function getCommentReplies(
  comments: StoredDocumentComment[],
  parentId: string,
): StoredDocumentComment[] {
  return comments.filter((comment) => comment.parentId === parentId);
}

export function resolveHighlightCommentId(
  comments: StoredDocumentComment[],
  commentId: string | null,
): string | null {
  if (!commentId) return null;
  const comment = comments.find((item) => item.id === commentId);
  if (!comment) return commentId;
  return comment.parentId ?? commentId;
}

export function getCommentIdsToRemove(
  comments: StoredDocumentComment[],
  commentId: string,
): Set<string> {
  const target = comments.find((comment) => comment.id === commentId);
  if (!target) return new Set();

  const ids = new Set<string>([commentId]);
  if (!target.parentId) {
    for (const reply of getCommentReplies(comments, commentId)) {
      ids.add(reply.id);
    }
  }
  return ids;
}

/** Sync ProseMirror comment highlights to root comments only. */
export function applyCommentHighlightsToEditor(
  editor: Editor,
  comments: StoredDocumentComment[],
): void {
  const rootComments = getRootComments(comments);
  const { state } = editor;
  const markType = state.schema.marks.commentHighlight;
  if (!markType) return;

  let tr = state.tr;

  state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    if (!node.marks.some((mark) => mark.type === markType)) return;
    tr = tr.removeMark(pos, pos + node.nodeSize, markType);
  });

  for (const comment of rootComments) {
    if (comment.from < 0 || comment.to > tr.doc.content.size) continue;
    if (comment.from >= comment.to) continue;
    tr = tr.addMark(
      comment.from,
      comment.to,
      markType.create({ commentId: comment.id }),
    );
  }

  if (tr.docChanged) {
    editor.view.dispatch(tr);
  }
}
