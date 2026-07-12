/** Returns 0–1 ratio of how much plain text changed between saves. */
export function contentChangeRatio(before: string, after: string): number {
  const prev = before.trim();
  const next = after.trim();

  if (prev === next) return 0;
  if (prev.length === 0) return next.length > 0 ? 1 : 0;
  if (next.length === 0) return 1;

  const maxLen = Math.max(prev.length, next.length);
  let commonPrefix = 0;
  const limit = Math.min(prev.length, next.length);
  while (commonPrefix < limit && prev[commonPrefix] === next[commonPrefix]) {
    commonPrefix += 1;
  }

  let commonSuffix = 0;
  while (
    commonSuffix < limit - commonPrefix &&
    prev[prev.length - 1 - commonSuffix] === next[next.length - 1 - commonSuffix]
  ) {
    commonSuffix += 1;
  }

  const unchanged = commonPrefix + commonSuffix;
  const changed = maxLen - unchanged;
  return Math.min(1, changed / maxLen);
}

export function shouldReembedContent(
  before: string,
  after: string,
  threshold = 0.15,
): boolean {
  return contentChangeRatio(before, after) >= threshold;
}
