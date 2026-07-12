import type { Editor } from "@tiptap/react";

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "been",
  "from",
  "have",
  "into",
  "that",
  "the",
  "this",
  "with",
  "your",
]);

function significantTerms(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3 && !STOP_WORDS.has(word)),
    ),
  ];
}

function overlapScore(text: string, terms: string[]): number {
  if (terms.length === 0) return 0;
  const lower = text.toLowerCase();
  return terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
}

/** Insert position immediately after the top-level block most related to the insight. */
export function findRelatedBlockInsertPosition(
  editor: Editor,
  input: { insightText: string; queryText: string },
): number {
  const terms = significantTerms(`${input.queryText} ${input.insightText}`);
  const doc = editor.state.doc;

  let bestPos = editor.state.selection.from;
  let bestScore = -1;

  doc.forEach((node, offset) => {
    if (!node.isBlock || node.type.name === "doc") return;

    const blockText = node.textContent.trim();
    if (!blockText) return;

    const score = overlapScore(blockText, terms);
    if (score > bestScore) {
      bestScore = score;
      bestPos = offset + node.nodeSize;
    }
  });

  return Math.min(bestPos, doc.content.size);
}
