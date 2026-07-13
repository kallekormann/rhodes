import type { Editor } from "@tiptap/react";

const COACHABLE_HEADING = /hypothesis|thesis|research question|problem statement/i;
const MIN_TEXT_LENGTH = 40;

export type CoachableBlock = {
  blockId: string | null;
  contextLabel: string;
  text: string;
  insertAfterPos: number;
};

export function findCoachableBlock(editor: Editor): CoachableBlock | null {
  const { doc } = editor.state;
  let match: CoachableBlock | null = null;

  doc.descendants((node, pos) => {
    if (match) return false;

    if (node.type.name !== "heading") return;

    const headingText = node.textContent.trim();
    if (!COACHABLE_HEADING.test(headingText)) return;

    const headingEnd = pos + node.nodeSize;
    const next = doc.nodeAt(headingEnd);
    if (!next || !next.isTextblock || next.type.name === "heading") return;

    const text = next.textContent.trim();
    if (text.length < MIN_TEXT_LENGTH) return;

    const blockId =
      typeof next.attrs.blockId === "string" ? next.attrs.blockId : null;

    match = {
      blockId,
      contextLabel: headingText,
      text,
      insertAfterPos: headingEnd + next.nodeSize,
    };
  });

  return match;
}

export function insertRhodesSuggestion(
  editor: Editor,
  insertAfterPos: number,
  improvedText: string,
) {
  editor
    .chain()
    .insertContentAt(insertAfterPos, {
      type: "rhodesSuggestion",
      attrs: { label: "Rhodes suggests" },
      content: [{ type: "text", text: improvedText }],
    })
    .run();
}
