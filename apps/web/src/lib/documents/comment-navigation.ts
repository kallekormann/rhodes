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

export function scrollEditorToExcerpt(editor: Editor, excerpt: string): boolean {
  const needle = excerpt.trim().slice(0, 80);
  if (!needle) return false;

  const { doc } = editor.state;
  let match: { from: number; to: number } | null = null;

  doc.descendants((node, pos) => {
    if (match || !node.isTextblock) return;
    const text = node.textContent;
    const index = text.indexOf(needle);
    if (index === -1) return;
    match = {
      from: pos + 1 + index,
      to: pos + 1 + index + needle.length,
    };
  });

  if (!match) {
    const fullText = editor.getText();
    const index = fullText.indexOf(needle);
    if (index === -1) return false;
    const from = index + 1;
    match = { from, to: from + needle.length };
  }

  editor.chain().focus().setTextSelection(match).scrollIntoView().run();
  return true;
}

export function scrollEditorToBlock(editor: Editor, blockId: string): boolean {
  const element = editor.view.dom.querySelector(`[data-block-id="${blockId}"]`);
  if (!element) return false;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

export function findCommentIdAtClickTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;

  const marked = target.closest("[data-comment-id]");
  if (!marked) return null;

  const commentId = marked.getAttribute("data-comment-id");
  return commentId && commentId.length > 0 ? commentId : null;
}
