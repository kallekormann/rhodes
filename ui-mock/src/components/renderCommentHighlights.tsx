import type { ReactNode } from "react";
import type { EditorComment } from "../data/editorTypes";

export function renderCommentHighlights(
  content: string,
  comments: EditorComment[],
  emphasizeId?: string | null,
): ReactNode {
  if (comments.length === 0) return content;

  const sorted = [...comments].sort((a, b) => a.start - b.start);
  const nodes: ReactNode[] = [];
  let cursor = 0;

  sorted.forEach((comment) => {
    if (comment.start > cursor) {
      nodes.push(content.slice(cursor, comment.start));
    }
    const emphasized = emphasizeId === comment.id;
    nodes.push(
      <mark
        key={comment.id}
        className={`editor-body__comment-highlight ${emphasized ? "editor-body__comment-highlight--emphasized" : ""}`}
      >
        {content.slice(comment.start, comment.end)}
      </mark>,
    );
    cursor = comment.end;
  });

  if (cursor < content.length) {
    nodes.push(content.slice(cursor));
  }

  return nodes;
}
