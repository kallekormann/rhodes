"use client";

import nspell from "nspell";

export type SpellLocale = "en";

export type SpellingIssue = {
  word: string;
  suggestions: string[];
};

type SpellEngine = {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
  add: (word: string) => void;
};

const engines = new Map<SpellLocale, Promise<SpellEngine | null>>();

const PERSONAL_KEY = "rhodes.spellcheck.personal.en";
const IGNORE_KEY = "rhodes.spellcheck.ignore.en";

/** App is served under Next `basePath: /app` — public files live at `/app/...`. */
function dictionaryUrl(locale: SpellLocale, file: "index.aff" | "index.dic") {
  return `/app/dictionaries/${locale}/${file}`;
}

function loadPersonalWords(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(PERSONAL_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((w): w is string => typeof w === "string"));
  } catch {
    return new Set();
  }
}

function savePersonalWords(words: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PERSONAL_KEY, JSON.stringify([...words]));
}

function loadIgnoredWords(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(IGNORE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed
        .filter((w): w is string => typeof w === "string")
        .map((w) => w.toLowerCase()),
    );
  } catch {
    return new Set();
  }
}

function saveIgnoredWords(words: Set<string>) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(IGNORE_KEY, JSON.stringify([...words]));
}

const sessionIgnored = {
  cache: null as Set<string> | null,
  get(): Set<string> {
    if (!this.cache) this.cache = loadIgnoredWords();
    return this.cache;
  },
  add(word: string) {
    const next = this.get();
    next.add(word.toLowerCase());
    saveIgnoredWords(next);
  },
};

const noopEngine: SpellEngine = {
  correct: () => true,
  suggest: () => [],
  add: () => undefined,
};

async function loadEngine(locale: SpellLocale): Promise<SpellEngine | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return noopEngine;
  }

  const existing = engines.get(locale);
  if (existing) return existing;

  const promise = (async (): Promise<SpellEngine | null> => {
    try {
      const [affRes, dicRes] = await Promise.all([
        fetch(dictionaryUrl(locale, "index.aff")),
        fetch(dictionaryUrl(locale, "index.dic")),
      ]);
      if (!affRes.ok || !dicRes.ok) {
        console.warn(
          `[spellcheck] dictionary unavailable for ${locale} (${affRes.status}/${dicRes.status})`,
        );
        return noopEngine;
      }
      const aff = await affRes.text();
      const dic = await dicRes.text();
      const spell = nspell(aff, dic);
      for (const word of loadPersonalWords()) {
        spell.add(word);
      }
      return spell;
    } catch (error) {
      console.warn(`[spellcheck] failed to load ${locale}`, error);
      return noopEngine;
    }
  })();

  engines.set(locale, promise);
  return promise;
}

const WORD_RE = /[A-Za-z][A-Za-z'-]{1,}/g;
const MIN_SPLIT_PART = 2;
const MAX_SUGGESTIONS = 5;

export function isWordIgnored(word: string): boolean {
  return sessionIgnored.get().has(word.toLowerCase());
}

/** Hide underlines for this word until the tab session ends. */
export function ignoreWord(word: string): void {
  const trimmed = word.trim();
  if (!trimmed) return;
  sessionIgnored.add(trimmed);
}

/**
 * Suggest splitting a concatenated token into two dictionary words
 * (e.g. "writethis" → "write this"). Uses the same EN hunspell pack.
 */
function findSplitSuggestions(word: string, engine: SpellEngine): string[] {
  const letters = word.replace(/'/g, "");
  if (letters.length < MIN_SPLIT_PART * 2) return [];

  const lower = letters.toLowerCase();
  const scored: { suggestion: string; score: number }[] = [];

  for (let i = MIN_SPLIT_PART; i <= lower.length - MIN_SPLIT_PART; i++) {
    const left = lower.slice(0, i);
    const right = lower.slice(i);
    if (!engine.correct(left) || !engine.correct(right)) continue;

    // Prefer longer shortest-part and more balanced splits.
    const score =
      Math.min(left.length, right.length) * 10 -
      Math.abs(left.length - right.length);
    scored.push({ suggestion: `${left} ${right}`, score });
  }

  scored.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of scored) {
    if (seen.has(item.suggestion)) continue;
    seen.add(item.suggestion);
    out.push(applySuggestionCasing(word, item.suggestion));
    if (out.length >= 3) break;
  }
  return out;
}

function applySuggestionCasing(original: string, suggestion: string): string {
  if (original === original.toUpperCase()) return suggestion.toUpperCase();
  if (
    original[0] === original[0]?.toUpperCase() &&
    original.slice(1) === original.slice(1).toLowerCase()
  ) {
    return suggestion.replace(/^[a-z]/, (ch) => ch.toUpperCase());
  }
  return suggestion;
}

function buildSuggestions(word: string, engine: SpellEngine): string[] {
  const splits = findSplitSuggestions(word, engine);
  const edits = engine.suggest(word);
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const candidate of [...splits, ...edits]) {
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(candidate);
    if (merged.length >= MAX_SUGGESTIONS) break;
  }

  return merged;
}

export async function suggestWord(
  word: string,
  locale: SpellLocale = "en",
): Promise<string[]> {
  const trimmed = word.trim();
  if (!trimmed || trimmed.length < 2) return [];
  const engine = await loadEngine(locale);
  if (!engine) return [];
  return buildSuggestions(trimmed, engine);
}

/** Dictionary check — EN now; ES/DE/FR/IT packs in Phase 10. */
export async function checkSpelling(
  text: string,
  locale: SpellLocale = "en",
): Promise<SpellingIssue[]> {
  const engine = await loadEngine(locale);
  if (!engine) return [];

  const issues: SpellingIssue[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(WORD_RE)) {
    const word = match[0];
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (word.length < 3) continue;
    if (isWordIgnored(word)) continue;
    if (engine.correct(word)) continue;
    issues.push({
      word,
      suggestions: buildSuggestions(word, engine),
    });
  }

  return issues;
}

export async function addPersonalWord(
  word: string,
  locale: SpellLocale = "en",
): Promise<void> {
  const trimmed = word.trim();
  if (!trimmed) return;
  const engine = await loadEngine(locale);
  if (!engine) return;
  engine.add(trimmed);
  const personal = loadPersonalWords();
  personal.add(trimmed);
  savePersonalWords(personal);
}

export type SpellRange = {
  from: number;
  to: number;
  word: string;
};

/** Map misspellings to document text offsets for TipTap decorations. */
export async function findMisspelledRanges(
  text: string,
  locale: SpellLocale = "en",
): Promise<SpellRange[]> {
  const engine = await loadEngine(locale);
  if (!engine) return [];

  const ranges: SpellRange[] = [];

  for (const match of text.matchAll(WORD_RE)) {
    const word = match[0];
    if (word.length < 3) continue;
    if (isWordIgnored(word)) continue;
    if (engine.correct(word)) continue;
    const from = match.index ?? 0;
    ranges.push({ from, to: from + word.length, word });
  }

  return ranges;
}
