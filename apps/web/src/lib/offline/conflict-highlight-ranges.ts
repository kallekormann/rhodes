import { diffChars, diffWords } from "@/lib/documents/text-diff";

export type CharRange = {
  start: number;
  end: number;
};

function mergeCharRanges(ranges: CharRange[]): CharRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: CharRange[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end + 1) {
      last.end = Math.max(last.end, current.end);
      continue;
    }
    merged.push({ ...current });
  }

  return merged;
}

function findAllRanges(text: string, needle: string): CharRange[] {
  if (!needle) return [];
  const ranges: CharRange[] = [];
  let index = 0;
  while (index < text.length) {
    const found = text.indexOf(needle, index);
    if (found === -1) break;
    ranges.push({ start: found, end: found + needle.length });
    index = found + Math.max(1, needle.length);
  }
  return ranges;
}

function longestCommonPrefix(...values: string[]): number {
  if (values.length === 0) return 0;
  const first = values[0];
  for (let i = 0; i < first.length; i++) {
    const ch = first[i];
    if (!values.every((value) => value[i] === ch)) {
      return i;
    }
  }
  return first.length;
}

/** Locate the conflicting span inside the block text shown in the editor. */
export function conflictCharRangesInDisplayText(params: {
  baseText: string;
  mineText: string;
  theirsText: string;
  displayText: string;
}): CharRange[] {
  const { baseText, mineText, theirsText, displayText } = params;
  if (!displayText) return [];

  const ranges: CharRange[] = [];

  // Highlight what changed offline (base → mine).
  for (const segment of diffWords(baseText, mineText)) {
    if (segment.type !== "add" || !segment.text.trim()) continue;
    ranges.push(...findAllRanges(displayText, segment.text));
  }

  // Also surface what the peer changed (base → theirs) when it differs from mine.
  for (const segment of diffWords(baseText, theirsText)) {
    if (segment.type !== "add" || !segment.text.trim()) continue;
    if (mineText.includes(segment.text)) continue;
    ranges.push(...findAllRanges(displayText, segment.text));
  }

  const merged = mergeCharRanges(ranges);
  if (merged.length > 0) return merged;

  // Word diff missed (e.g. replace "user B" with "changed by user A") — use char diff.
  for (const segment of diffChars(baseText, mineText)) {
    if (segment.type !== "add" || !segment.text.trim()) continue;
    ranges.push(...findAllRanges(displayText, segment.text));
  }

  const charMerged = mergeCharRanges(ranges);
  if (charMerged.length > 0) return charMerged;

  // Last resort: highlight from the first divergence to the end of the line.
  if (mineText !== theirsText && (mineText !== baseText || theirsText !== baseText)) {
    const prefixLen = longestCommonPrefix(baseText, mineText, theirsText, displayText);
    if (prefixLen < displayText.length) {
      return [{ start: prefixLen, end: displayText.length }];
    }
    return [{ start: 0, end: displayText.length }];
  }

  return [];
}
