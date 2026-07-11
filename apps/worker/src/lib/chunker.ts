import {
  LIBRARY_CHUNK_CHARS,
  LIBRARY_CHUNK_OVERLAP_CHARS,
} from "@rhodes/shared/constants";

export type TextChunk = {
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
};

function splitOnBoundary(text: string, maxChars: number): [string, string] {
  if (text.length <= maxChars) {
    return [text, ""];
  }

  const window = text.slice(0, maxChars + 1);
  const breakCandidates = [
    window.lastIndexOf("\n\n"),
    window.lastIndexOf("\n"),
    window.lastIndexOf(". "),
    window.lastIndexOf(" "),
  ].filter((index) => index > maxChars * 0.5);

  const splitAt =
    breakCandidates.length > 0 ? Math.max(...breakCandidates) : maxChars;

  return [text.slice(0, splitAt).trim(), text.slice(splitAt).trim()];
}

export function chunkText(text: string): TextChunk[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: TextChunk[] = [];
  let remaining = normalized;
  let chunkIndex = 0;

  while (remaining.length > 0) {
    const [chunk, rest] = splitOnBoundary(remaining, LIBRARY_CHUNK_CHARS);
    if (!chunk) break;

    chunks.push({
      chunkIndex,
      content: chunk,
      pageNumber: null,
    });

    chunkIndex += 1;
    if (!rest) break;

    const overlapStart = Math.max(0, chunk.length - LIBRARY_CHUNK_OVERLAP_CHARS);
    const overlap = chunk.slice(overlapStart);
    remaining = `${overlap}${rest}`.trim();
  }

  return chunks;
}
