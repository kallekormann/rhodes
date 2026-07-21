import type { AskToolResult } from "./types";

export type AskIntent = "tools" | "knowledge" | "mixed";

const KNOWLEDGE_HINT =
  /\b(document|documents|library|workspace|template|templates|status|file|files|source|sources|according to|in my|what(?:'| i)?s in|which docs?|property|properties|metadata|outline|roadmap|kpi|dashboard)\b/i;

/**
 * Decide whether Ask should run tools only, knowledge retrieval, or both.
 *
 * Rules (cheap, deterministic — no LLM):
 * 1. Successful calculator match + no knowledge language → `tools` (skip RAG/overview/Ollama)
 * 2. Successful tool match + knowledge language → `mixed` (tools + RAG)
 * 3. Otherwise → `knowledge` (overview + RAG; Ollama if anything found)
 */
export function classifyAskIntent(
  question: string,
  toolResults: AskToolResult[],
): AskIntent {
  // Only successful tools count — a failed false-positive match must not force RAG.
  const okTools = toolResults.filter((result) => result.ok);
  const wantsKnowledge = KNOWLEDGE_HINT.test(question);

  if (okTools.length > 0 && !wantsKnowledge) return "tools";
  if (okTools.length > 0 && wantsKnowledge) return "mixed";
  return "knowledge";
}

export function isToolOnlyQuestion(
  question: string,
  results: AskToolResult[],
): boolean {
  return classifyAskIntent(question, results) === "tools";
}
