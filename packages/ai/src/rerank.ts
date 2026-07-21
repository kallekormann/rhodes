import { createOllamaClient } from "./ollama";
import { OLLAMA_FAST_MODEL } from "@rhodes/shared/constants";
import type { KnowledgeMatch } from "./rag";

export type RerankVerdict = "keep" | "skip";

export type RerankStep = {
  item_id: string;
  relevant: boolean;
  verdict: RerankVerdict;
  label: string;
  location_label: string;
  origin_type: string;
  title: string;
};

function parseJsonObject(raw: string): { relevant?: boolean; label?: string } | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as {
      relevant?: boolean;
      label?: string;
    };
  } catch {
    return null;
  }
}

async function evaluateMatch(
  question: string,
  match: KnowledgeMatch,
): Promise<RerankStep> {
  const ollama = createOllamaClient();
  const excerpt = match.matched_text.slice(0, 900);
  const prompt = `Does this excerpt help answer the user question? Reply JSON only: {"relevant":true|false,"label":"short human summary ≤80 chars"}

Question: ${question}

Source: ${match.title}${match.location_label ? ` (${match.location_label})` : ""}
Excerpt:
${excerpt}

JSON:`;

  let raw = "";
  try {
    raw = await ollama.generate(prompt, OLLAMA_FAST_MODEL);
  } catch {
    // On model failure, keep high-similarity matches
    const relevant = match.similarity >= 0.75;
    return {
      item_id: match.item_id,
      relevant,
      verdict: relevant ? "keep" : "skip",
      label:
        match.chunk_metadata &&
        typeof match.chunk_metadata === "object" &&
        "display" in match.chunk_metadata &&
        (match.chunk_metadata as { display?: { reasoning_label?: string } }).display
          ?.reasoning_label
          ? String(
              (match.chunk_metadata as { display?: { reasoning_label?: string } })
                .display?.reasoning_label,
            )
          : `${match.title} — ${excerpt.slice(0, 60)}`,
      location_label: match.location_label,
      origin_type: match.origin_type,
      title: match.title,
    };
  }

  const parsed = parseJsonObject(raw);
  const relevant = parsed?.relevant === true;
  const label =
    parsed?.label?.trim() ||
    `${match.title}${match.location_label ? ` — ${match.location_label}` : ""}`;

  return {
    item_id: match.item_id,
    relevant,
    verdict: relevant ? "keep" : "skip",
    label: label.slice(0, 80),
    location_label: match.location_label,
    origin_type: match.origin_type,
    title: match.title,
  };
}

/** LLM-rerank candidates with limited concurrency. */
export async function rerankKnowledgeMatches(input: {
  question: string;
  matches: KnowledgeMatch[];
  concurrency?: number;
  onStep?: (step: RerankStep) => void | Promise<void>;
}): Promise<{ kept: KnowledgeMatch[]; steps: RerankStep[] }> {
  const concurrency = Math.max(1, input.concurrency ?? 3);
  const steps: RerankStep[] = [];
  const keptIds = new Set<string>();
  const queue = [...input.matches];

  async function worker() {
    while (queue.length > 0) {
      const match = queue.shift();
      if (!match) return;
      const step = await evaluateMatch(input.question, match);
      steps.push(step);
      if (step.relevant) keptIds.add(step.item_id);
      await input.onStep?.(step);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, input.matches.length) }, () =>
      worker(),
    ),
  );

  const kept = input.matches.filter((m) => keptIds.has(m.item_id));
  return { kept, steps };
}
