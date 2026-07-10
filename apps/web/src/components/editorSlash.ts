import type { SlashMenuItem } from "./SlashMenu";
import { slashMenuItems } from "./SlashMenu";

export type SlashContext = {
  query: string;
  slashStart: number;
  cursorOffset: number;
};

export function filterSlashItems(query: string, items: SlashMenuItem[] = slashMenuItems) {
  const q = query.toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.hint?.toLowerCase().includes(q) ||
      item.id.includes(q),
  );
}

export function getSlashContext(element: HTMLElement): SlashContext | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return null;

  const pre = range.cloneRange();
  pre.selectNodeContents(element);
  pre.setEnd(range.startContainer, range.startOffset);

  const textBefore = pre.toString();
  const slashStart = textBefore.lastIndexOf("/");
  if (slashStart === -1) return null;

  const query = textBefore.slice(slashStart + 1);
  if (query.includes(" ") || query.includes("\n")) return null;
  if (slashStart > 0 && !/\s/.test(textBefore[slashStart - 1]!)) return null;

  return {
    query,
    slashStart,
    cursorOffset: textBefore.length,
  };
}

export function getCaretClientRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);

  const rects = range.getClientRects();
  if (rects.length > 0) return rects[0]!;

  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  range.insertNode(marker);
  const rect = marker.getBoundingClientRect();
  marker.remove();
  return rect;
}

export function removeSlashTrigger(element: HTMLElement, ctx: SlashContext) {
  const text = element.textContent ?? "";
  const after = text.slice(ctx.cursorOffset);
  element.textContent = text.slice(0, ctx.slashStart) + after;
  placeCaret(element, ctx.slashStart);
}

export function placeCaret(element: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let current = 0;
  let node = walker.nextNode();

  while (node) {
    const len = node.textContent?.length ?? 0;
    if (current + len >= offset) {
      range.setStart(node, offset - current);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    current += len;
    node = walker.nextNode();
  }

  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}
