/**
 * Word-level plain-text diff + 3-way merge for conflict review chrome.
 */

export type TextDiffSegment = {
  type: "equal" | "add" | "del";
  text: string;
};

function tokenize(value: string): string[] {
  return value.split(/(\s+)/).filter((part) => part.length > 0);
}

/** Classic LCS word diff — good enough for paragraph-sized conflict review. */
export function diffWords(before: string, after: string): TextDiffSegment[] {
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length === 0 && b.length === 0) return [];
  if (a.length === 0) return [{ type: "add", text: after }];
  if (b.length === 0) return [{ type: "del", text: before }];

  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segments: TextDiffSegment[] = [];
  const push = (type: TextDiffSegment["type"], text: string) => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.type === type) {
      last.text += text;
      return;
    }
    segments.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("equal", a[i]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("del", a[i]);
      i += 1;
    } else {
      push("add", b[j]);
      j += 1;
    }
  }
  while (i < n) {
    push("del", a[i]);
    i += 1;
  }
  while (j < m) {
    push("add", b[j]);
    j += 1;
  }

  return segments;
}

type TextHunk = {
  /** Inclusive start index into base tokens. */
  baseStart: number;
  /** Exclusive end index into base tokens (deleted/replaced span). */
  baseEnd: number;
  /** Tokens to insert in place of [baseStart, baseEnd). */
  insert: string[];
};

/** Turn base→side alignment into hunks against base token indices. */
function hunksAgainstBase(base: string[], side: string[]): TextHunk[] {
  const n = base.length;
  const m = side.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        base[i] === side[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const hunks: TextHunk[] = [];
  let i = 0;
  let j = 0;
  let pending: TextHunk | null = null;

  const flush = () => {
    if (!pending) return;
    hunks.push(pending);
    pending = null;
  };

  while (i < n || j < m) {
    if (i < n && j < m && base[i] === side[j]) {
      flush();
      i += 1;
      j += 1;
      continue;
    }
    if (pending == null) {
      pending = { baseStart: i, baseEnd: i, insert: [] };
    }
    if (j >= m || (i < n && dp[i + 1][j] >= dp[i][j + 1])) {
      pending.baseEnd = i + 1;
      i += 1;
    } else {
      pending.insert.push(side[j]);
      j += 1;
    }
  }
  flush();
  return hunks;
}

function hunksOverlap(a: TextHunk, b: TextHunk): boolean {
  const aInsertOnly = a.baseStart === a.baseEnd;
  const bInsertOnly = b.baseStart === b.baseEnd;

  // Pure inserts at the same caret compete — require Mode C.
  if (aInsertOnly && bInsertOnly) {
    return a.baseStart === b.baseStart;
  }

  // Insert vs replace/delete: inserting inside a replaced span is a conflict
  // (e.g. B replaces "world", A inserts at that word's start).
  if (aInsertOnly) {
    return b.baseStart <= a.baseStart && a.baseStart < b.baseEnd;
  }
  if (bInsertOnly) {
    return a.baseStart <= b.baseStart && b.baseStart < a.baseEnd;
  }

  return a.baseStart < b.baseEnd && b.baseStart < a.baseEnd;
}

/**
 * 3-way plain-text merge.
 * Non-overlapping edits (e.g. A appends, B prepends) merge cleanly.
 * Overlapping edits of the same base span → conflict.
 */
export function threeWayMergeText(
  base: string,
  mine: string,
  theirs: string,
): { ok: true; text: string } | { ok: false } {
  if (mine === theirs) return { ok: true, text: mine };
  if (mine === base) return { ok: true, text: theirs };
  if (theirs === base) return { ok: true, text: mine };

  const baseTok = tokenize(base);
  const mineTok = tokenize(mine);
  const theirsTok = tokenize(theirs);

  // Empty-base: both wrote into a blank block — only identical text auto-merges.
  if (baseTok.length === 0) {
    return mine === theirs ? { ok: true, text: mine } : { ok: false };
  }

  const mineHunks = hunksAgainstBase(baseTok, mineTok);
  const theirsHunks = hunksAgainstBase(baseTok, theirsTok);

  for (const mh of mineHunks) {
    for (const th of theirsHunks) {
      if (!hunksOverlap(mh, th)) continue;
      if (
        mh.baseStart === th.baseStart &&
        mh.baseEnd === th.baseEnd &&
        mh.insert.join("") === th.insert.join("")
      ) {
        continue;
      }
      return { ok: false };
    }
  }

  type Tagged = TextHunk & { side: "mine" | "theirs" };
  const all: Tagged[] = [
    ...theirsHunks.map((h) => ({ ...h, side: "theirs" as const })),
    ...mineHunks.map((h) => ({ ...h, side: "mine" as const })),
  ].sort((a, b) => {
    if (a.baseStart !== b.baseStart) return a.baseStart - b.baseStart;
    if (a.baseEnd !== b.baseEnd) return a.baseEnd - b.baseEnd;
    if (a.side !== b.side) return a.side === "theirs" ? -1 : 1;
    return 0;
  });

  const out: string[] = [];
  let cursor = 0;
  for (const hunk of all) {
    if (hunk.baseStart < cursor) {
      if (hunk.baseStart === hunk.baseEnd && hunk.baseStart === cursor) {
        out.push(...hunk.insert);
        continue;
      }
      return { ok: false };
    }
    out.push(...baseTok.slice(cursor, hunk.baseStart));
    out.push(...hunk.insert);
    cursor = Math.max(cursor, hunk.baseEnd);
  }
  out.push(...baseTok.slice(cursor));

  return { ok: true, text: out.join("") };
}
