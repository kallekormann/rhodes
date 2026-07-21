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

const noopEngine: SpellEngine = {
  correct: () => true,
  suggest: () => [],
  add: () => undefined,
};

async function loadEngine(locale: SpellLocale): Promise<SpellEngine | null> {
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
    if (engine.correct(word)) continue;
    issues.push({
      word,
      suggestions: engine.suggest(word).slice(0, 5),
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
    if (engine.correct(word)) continue;
    const from = match.index ?? 0;
    ranges.push({ from, to: from + word.length, word });
  }

  return ranges;
}
