import { createAdminClient } from "@rhodes/db";
import { formatCitationLocation } from "@rhodes/shared/citation-location";
import type { ChunkMetadata } from "@rhodes/shared/chunk-metadata";
import { createOllamaClient } from "./ollama";

export type KnowledgeMatch = {
  origin_type: string;
  item_id: string;
  source_ref_id: string;
  title: string;
  matched_text: string;
  page_ref: number | null;
  similarity: number;
  chunk_metadata: ChunkMetadata | Record<string, unknown> | null;
  source_summary: string | null;
  location_label: string;
};

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

function locationLabelFromMatch(row: {
  title: string;
  page_ref: number | null;
  chunk_metadata?: ChunkMetadata | Record<string, unknown> | null;
}): string {
  const meta = row.chunk_metadata as ChunkMetadata | null | undefined;
  if (meta?.citation) {
    const fileType = meta.file_type ?? "document";
    const formatted = formatCitationLocation(fileType, meta.citation);
    if (formatted) return formatted;
    if (meta.citation.label) return meta.citation.label;
  }
  if (row.page_ref != null) return `p.${row.page_ref}`;
  return "";
}

export async function retrieveWorkspaceKnowledge(input: {
  workspaceId: string;
  queryText: string;
  matchThreshold?: number;
  matchCount?: number;
  /** Drop matches from this document (Insights while editing). */
  excludeDocumentId?: string | null;
}): Promise<KnowledgeMatch[]> {
  const query = input.queryText.trim();
  if (!query) return [];

  const ollama = createOllamaClient();
  const embedding = await ollama.embed(query);
  const admin = createAdminClient();
  const excludeDocumentId = input.excludeDocumentId?.trim() || null;
  // Over-fetch when excluding so we still return a full page after filtering.
  const matchCount = input.matchCount ?? 8;
  const fetchCount = excludeDocumentId
    ? Math.min(matchCount + 8, 24)
    : matchCount;

  const { data, error } = await admin.rpc("match_workspace_knowledge", {
    query_embedding: toVectorLiteral(embedding),
    match_threshold: input.matchThreshold ?? 0.72,
    match_count: fetchCount,
    target_workspace_id: input.workspaceId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  const matches = rows.map((row) => {
    const page_ref =
      typeof row.page_ref === "number" ? row.page_ref : null;
    const chunk_metadata =
      (row.chunk_metadata as ChunkMetadata | Record<string, unknown> | null) ??
      null;
    const title = String(row.title ?? "");
    return {
      origin_type: String(row.origin_type ?? ""),
      item_id: String(row.item_id ?? ""),
      source_ref_id: String(row.source_ref_id ?? ""),
      title,
      matched_text: String(row.matched_text ?? ""),
      page_ref,
      similarity: Number(row.similarity ?? 0),
      chunk_metadata,
      source_summary:
        typeof row.source_summary === "string" ? row.source_summary : null,
      location_label: locationLabelFromMatch({
        title,
        page_ref,
        chunk_metadata,
      }),
    };
  });

  if (!excludeDocumentId) return matches.slice(0, matchCount);

  return matches
    .filter((match) => !isCurrentDocumentMatch(match, excludeDocumentId))
    .slice(0, matchCount);
}

/** True when a RAG hit is a chunk/embedding of the document the user is editing. */
export function isCurrentDocumentMatch(
  match: Pick<KnowledgeMatch, "origin_type" | "item_id" | "source_ref_id">,
  documentId: string,
): boolean {
  if (
    match.origin_type !== "document" &&
    match.origin_type !== "document_chunk"
  ) {
    return false;
  }
  return (
    match.source_ref_id === documentId || match.item_id === documentId
  );
}
