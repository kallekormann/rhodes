import type { Job } from "bullmq";
import { createAdminClient } from "@rhodes/db";
import { createOllamaClient } from "@rhodes/ai";
import { EMBEDDING_DIMENSIONS } from "@rhodes/shared/constants";

export type EmbedJobData = {
  sourceId: string;
  workspaceId: string;
};

const BATCH_SIZE = 32;
const MAX_RETRIES = 3;

function toVectorLiteral(vector: number[]): string {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}`);
  }
  return `[${vector.join(",")}]`;
}

async function embedWithRetry(texts: string[]): Promise<number[][]> {
  const ollama = createOllamaClient();
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      return await ollama.embedBatch(texts);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Embedding failed");
}

export async function processEmbedJob(job: Job<EmbedJobData>) {
  const started = Date.now();
  const { sourceId } = job.data;
  const admin = createAdminClient();

  const { data: chunks, error: loadError } = await admin
    .from("library_source_chunks")
    .select("id, content_chunk")
    .eq("source_id", sourceId)
    .is("embedding", null)
    .order("chunk_index", { ascending: true });

  if (loadError) {
    throw new Error(loadError.message);
  }

  const pending = chunks ?? [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const vectors = await embedWithRetry(batch.map((chunk) => chunk.content_chunk));

    await Promise.all(
      batch.map(async (chunk, index) => {
        const vector = vectors[index];
        if (!vector) {
          throw new Error(`Missing embedding vector for chunk ${chunk.id}`);
        }

        const { error: updateError } = await admin
          .from("library_source_chunks")
          .update({ embedding: toVectorLiteral(vector) })
          .eq("id", chunk.id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      }),
    );
  }

  const { count, error: countError } = await admin
    .from("library_source_chunks")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId)
    .is("embedding", null);

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count ?? 0) === 0) {
    await admin
      .from("library_sources")
      .update({ embedding_status: "ready" })
      .eq("id", sourceId);
  }

  console.log("[embed] done", {
    sourceId,
    chunks: pending.length,
    ms: Date.now() - started,
  });
}
