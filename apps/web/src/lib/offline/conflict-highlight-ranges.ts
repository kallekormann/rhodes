export type CharRange = {
  start: number;
  end: number;
};

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

function longestCommonSuffix(...values: string[]): number {
  if (values.length === 0) return 0;
  const minLen = Math.min(...values.map((value) => value.length));
  let suffix = 0;
  for (let i = 1; i <= minLen; i++) {
    const ch = values[0][values[0].length - i];
    if (!values.every((value) => value[value.length - i] === ch)) break;
    suffix = i;
  }
  return suffix;
}

/**
 * Character ranges to highlight inside the offline user's version (mineText).
 * Highlights where mine and theirs diverge — no substring search (avoids
 * false matches like "added" in an unrelated row).
 */
export function conflictCharRangesForBlock(params: {
  baseText: string;
  mineText: string;
  theirsText: string;
}): CharRange[] {
  const { baseText, mineText, theirsText } = params;
  if (!mineText || mineText === theirsText) return [];

  const divergeStart = longestCommonPrefix(mineText, theirsText);
  const divergeEnd =
    mineText.length - longestCommonSuffix(mineText, theirsText);

  if (divergeEnd > divergeStart) {
    return [{ start: divergeStart, end: divergeEnd }];
  }

  const mineStart = longestCommonPrefix(baseText, mineText);
  const mineEnd = mineText.length - longestCommonSuffix(baseText, mineText);
  if (mineEnd > mineStart) {
    return [{ start: mineStart, end: mineEnd }];
  }

  if (mineText !== baseText) {
    return [{ start: 0, end: mineText.length }];
  }

  return [];
}

/**
 * Shift highlight ranges when the live editor block text differs from the
 * offline snapshot (e.g. snapshot text was trimmed during conflict detection).
 */
export function shiftCharRangesToDisplayText(
  ranges: CharRange[],
  snapshotText: string,
  displayText: string,
): CharRange[] {
  if (ranges.length === 0 || snapshotText === displayText) return ranges;

  const trimmedSnapshot = snapshotText.trim();
  if (trimmedSnapshot.length === 0) return ranges;

  const trimmedDisplay = displayText.trim();
  if (trimmedSnapshot === trimmedDisplay) {
    const lead = displayText.indexOf(trimmedDisplay);
    if (lead < 0) return ranges;
    return ranges.map((range) => ({
      start: range.start + lead,
      end: range.end + lead,
    }));
  }

  const anchor = displayText.indexOf(trimmedSnapshot);
  if (anchor >= 0) {
    const snapshotLead = snapshotText.indexOf(trimmedSnapshot);
    const delta = anchor - (snapshotLead >= 0 ? snapshotLead : 0);
    return ranges.map((range) => ({
      start: range.start + delta,
      end: range.end + delta,
    }));
  }

  return ranges;
}

const CONTEXT_CHARS = 120;

export type ConflictContextSnippet = {
  prefix: string;
  highlight: string;
  suffix: string;
  prefixEllipsis: boolean;
  suffixEllipsis: boolean;
};

/** Surrounding context for side-by-side conflict review. */
export function conflictContextSnippet(
  text: string,
  start: number,
  end: number,
  contextChars = CONTEXT_CHARS,
): ConflictContextSnippet {
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));
  const prefixStart = Math.max(0, safeStart - contextChars);
  const suffixEnd = Math.min(text.length, safeEnd + contextChars);
  return {
    prefix: text.slice(prefixStart, safeStart),
    highlight: text.slice(safeStart, safeEnd),
    suffix: text.slice(safeEnd, suffixEnd),
    prefixEllipsis: prefixStart > 0,
    suffixEllipsis: suffixEnd < text.length,
  };
}

/** @deprecated Use conflictCharRangesForBlock — kept for legacy callers with displayText. */
export function conflictCharRangesInDisplayText(params: {
  baseText: string;
  mineText: string;
  theirsText: string;
  displayText: string;
}): CharRange[] {
  const ranges = conflictCharRangesForBlock(params);
  if (ranges.length === 0 || params.displayText === params.mineText) {
    return ranges;
  }

  const aligned = longestCommonPrefix(params.displayText, params.mineText);
  return ranges.map((range) => ({
    start: Math.min(params.displayText.length, range.start),
    end: Math.min(params.displayText.length, range.end),
  }));
}
