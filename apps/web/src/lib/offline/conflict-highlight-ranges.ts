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
