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

/** Pick a short, query-aligned snippet from a longer chunk match. */
export function formatInsightExcerpt(
  matchedText: string,
  queryText: string,
  maxLength = 160,
): string {
  const text = matchedText.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;

  const terms = significantTerms(queryText);
  if (terms.length === 0) {
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
  }

  const lower = text.toLowerCase();
  let bestStart = 0;
  let bestScore = -1;

  const step = Math.max(1, Math.floor(maxLength / 5));
  for (let start = 0; start <= text.length - maxLength; start += step) {
    const window = lower.slice(start, start + maxLength);
    const score = terms.reduce(
      (total, term) => total + (window.includes(term) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  for (const term of terms) {
    let index = lower.indexOf(term);
    while (index !== -1) {
      const start = Math.max(0, index - Math.floor(maxLength * 0.25));
      const window = lower.slice(start, start + maxLength);
      const score = terms.reduce(
        (total, token) => total + (window.includes(token) ? 1 : 0),
        0,
      );
      if (score > bestScore) {
        bestScore = score;
        bestStart = start;
      }
      index = lower.indexOf(term, index + 1);
    }
  }

  const snippet = text.slice(bestStart, bestStart + maxLength).trim();
  const prefix = bestStart > 0 ? "…" : "";
  const suffix = bestStart + maxLength < text.length ? "…" : "";
  return `${prefix}${snippet}${suffix}`;
}

export function insightOriginLabel(originType: string): string {
  if (originType === "document" || originType === "document_chunk") {
    return "Document";
  }
  return "Library";
}

export function insightLocationLabel(insight: {
  location_label?: string | null;
  page_ref?: number | null;
}): string {
  if (insight.location_label?.trim()) return insight.location_label.trim();
  if (insight.page_ref != null) return `p.${insight.page_ref}`;
  return "";
}
