import type { Editor } from "@tiptap/react";
import type { StoredDocumentComment } from "@/lib/documents/comments";

const SCROLL_OFFSET_PX = 120;

/** Scroll the editor canvas so a comment highlight is visible. */
export function scrollCommentIntoView(
  editor: Editor,
  scrollContainer: HTMLElement,
  comment: Pick<StoredDocumentComment, "from">,
): void {
  const safePos = Math.max(1, Math.min(comment.from, editor.state.doc.content.size));
  const coords = editor.view.coordsAtPos(safePos);
  const containerRect = scrollContainer.getBoundingClientRect();

  const aboveViewport = coords.top < containerRect.top + SCROLL_OFFSET_PX;
  const belowViewport = coords.bottom > containerRect.bottom - SCROLL_OFFSET_PX;

  if (!aboveViewport && !belowViewport) return;

  const targetTop =
    coords.top - containerRect.top + scrollContainer.scrollTop - SCROLL_OFFSET_PX;

  scrollContainer.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "smooth",
  });
}

export function findCommentIdAtClickTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;

  const marked = target.closest("[data-comment-id]");
  if (!marked) return null;

  const commentId = marked.getAttribute("data-comment-id");
  return commentId && commentId.length > 0 ? commentId : null;
}
