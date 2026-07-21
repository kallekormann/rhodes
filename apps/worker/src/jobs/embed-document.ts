import type { Job } from "bullmq";
import { createAdminClient } from "@rhodes/db";
import { createOllamaClient } from "@rhodes/ai";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "@rhodes/shared/constants";
import { chunkTipTapDocument } from "../lib/extractors/tiptap-document";

export type EmbedDocumentJobData = {
  documentId: string;
  workspaceId: string;
};

function toVectorLiteral(vector: number[]): string {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}`);
  }
  return `[${vector.join(",")}]`;
}

export async function processEmbedDocumentJob(job: Job<EmbedDocumentJobData>) {
  const { documentId, workspaceId } = job.data;
  const admin = createAdminClient();

  const { data: document, error: loadError } = await admin
    .from("documents")
    .select("id, title, content, content_plain, workspace_id")
    .eq("id", documentId)
    .maybeSingle();

  if (loadError) {
    throw new Error(loadError.message);
  }
  if (!document) return;

  const wsId = (document.workspace_id as string) || workspaceId;
  const chunks = chunkTipTapDocument({
    documentId,
    title: (document.title as string) || "Untitled Document",
    content: (document.content as Record<string, unknown> | null) ?? null,
    contentPlain: document.content_plain as string | null,
  });

  await admin.from("document_chunks").delete().eq("document_id", documentId);

  if (chunks.length === 0) {
    // Clear whole-doc embedding if document emptied
    await admin.from("documents").update({ embedding: null }).eq("id", documentId);
    return;
  }

  const { error: insertError } = await admin.from("document_chunks").insert(
    chunks.map((chunk) => ({
      document_id: documentId,
      workspace_id: wsId,
      chunk_index: chunk.chunkIndex,
      content_chunk: chunk.content,
      content_hash: chunk.contentHash,
      token_estimate: chunk.tokenEstimate,
      chunk_metadata: chunk.chunkMetadata,
      embedding_model_version: EMBEDDING_MODEL,
    })),
  );

  if (insertError) {
    throw new Error(insertError.message);
  }

  const ollama = createOllamaClient();
  const BATCH = 32;
  const { data: pending, error: pendingError } = await admin
    .from("document_chunks")
    .select("id, content_chunk, chunk_metadata")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });

  if (pendingError) throw new Error(pendingError.message);

  const rows = pending ?? [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const texts = batch.map((row) => {
      const meta =
        row.chunk_metadata && typeof row.chunk_metadata === "object"
          ? (row.chunk_metadata as { display?: { reasoning_label?: string } })
          : null;
      const prefix = meta?.display?.reasoning_label?.trim();
      return prefix ? `${prefix}\n${row.content_chunk}` : row.content_chunk;
    });
    const vectors = await ollama.embedBatch(texts);
    await Promise.all(
      batch.map(async (row, index) => {
        const vector = vectors[index];
        if (!vector) throw new Error(`Missing vector for chunk ${row.id}`);
        const { error } = await admin
          .from("document_chunks")
          .update({ embedding: toVectorLiteral(vector) })
          .eq("id", row.id);
        if (error) throw new Error(error.message);
      }),
    );
  }

  // Keep a coarse whole-doc embedding for backward compatibility (title + first 8k).
  const plain = (document.content_plain as string | null)?.trim() ?? "";
  if (plain) {
    const vector = await ollama.embed(plain.slice(0, 8000));
    await admin
      .from("documents")
      .update({ embedding: toVectorLiteral(vector) })
      .eq("id", documentId);
  }

  console.log("[document-embed] done", {
    documentId,
    chunks: chunks.length,
  });
}
