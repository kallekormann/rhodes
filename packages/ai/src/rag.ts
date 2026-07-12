import { createAdminClient } from "@rhodes/db";
import { createOllamaClient } from "./ollama";

export type KnowledgeMatch = {
  origin_type: string;
  item_id: string;
  title: string;
  matched_text: string;
  page_ref: number | null;
  similarity: number;
};

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export async function retrieveWorkspaceKnowledge(input: {
  workspaceId: string;
  queryText: string;
  matchThreshold?: number;
  matchCount?: number;
}): Promise<KnowledgeMatch[]> {
  const query = input.queryText.trim();
  if (!query) return [];

  const ollama = createOllamaClient();
  const embedding = await ollama.embed(query);
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("match_workspace_knowledge", {
    query_embedding: toVectorLiteral(embedding),
    match_threshold: input.matchThreshold ?? 0.72,
    match_count: input.matchCount ?? 8,
    target_workspace_id: input.workspaceId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data as KnowledgeMatch[] | null) ?? [];
}
