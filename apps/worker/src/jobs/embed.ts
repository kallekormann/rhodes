import type { Job } from "bullmq";
import { Queue } from "bullmq";
import { createAdminClient } from "@rhodes/db";
import { createOllamaClient } from "@rhodes/ai";
import {
  EMBEDDING_DIMENSIONS,
  LIBRARY_SUMMARIZE_QUEUE,
} from "@rhodes/shared/constants";
import { addOrReplaceJob } from "../lib/queue-job";
import {
  clearLibraryFailureMetadata,
  libraryFailureMetadata,
} from "@rhodes/shared/library-failure";
import {
  LIBRARY_PIPELINE_STAGE,
  setLibraryPipelineStage,
} from "../lib/library-source";
import { connection } from "../connection";

export type EmbedJobData = {
  sourceId: string;
  workspaceId: string;
};

const BATCH_SIZE = 32;
const MAX_RETRIES = 3;
const summarizeQueue = new Queue(LIBRARY_SUMMARIZE_QUEUE, { connection });

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

/** Returns true if a summarize job was enqueued. */
async function enqueueSummarizeJob(
  sourceId: string,
  workspaceId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data: source, error } = await admin
    .from("library_sources")
    .select("summary, metadata")
    .eq("id", sourceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!source || source.summary) return false;

  const metadata =
    source.metadata && typeof source.metadata === "object"
      ? (source.metadata as Record<string, unknown>)
      : null;
  const excerpt =
    typeof metadata?.extracted_text_excerpt === "string"
      ? metadata.extracted_text_excerpt
      : "";

  if (!excerpt.trim()) return false;

  await setLibraryPipelineStage(admin, sourceId, LIBRARY_PIPELINE_STAGE.ANALYZING, {
    ...clearLibraryFailureMetadata(),
  });

  await addOrReplaceJob(
    summarizeQueue,
    "summarize-source",
    { sourceId, workspaceId, excerpt },
    `summarize-${sourceId}`,
    {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: "exponential", delay: 15_000 },
    },
  );
  return true;
}

export async function processEmbedJob(job: Job<EmbedJobData>) {
  const started = Date.now();
  const { sourceId, workspaceId } = job.data;
  const admin = createAdminClient();

  try {
    const { data: chunks, error: loadError } = await admin
      .from("library_source_chunks")
      .select("id, content_chunk, chunk_metadata")
      .eq("source_id", sourceId)
      .is("embedding", null)
      .order("chunk_index", { ascending: true });

    if (loadError) {
      throw new Error(loadError.message);
    }

    const pending = chunks ?? [];
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      const texts = batch.map((chunk) => {
        const meta =
          chunk.chunk_metadata && typeof chunk.chunk_metadata === "object"
            ? (chunk.chunk_metadata as { display?: { reasoning_label?: string } })
            : null;
        const prefix = meta?.display?.reasoning_label?.trim();
        return prefix
          ? `${prefix}\n${chunk.content_chunk}`
          : chunk.content_chunk;
      });
      const vectors = await embedWithRetry(texts);

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

      const summarizing = await enqueueSummarizeJob(sourceId, workspaceId);
      if (!summarizing) {
        await setLibraryPipelineStage(
          admin,
          sourceId,
          LIBRARY_PIPELINE_STAGE.READY,
          clearLibraryFailureMetadata(),
        );
      }
    }

    console.log("[embed] done", {
      sourceId,
      chunks: pending.length,
      ms: Date.now() - started,
    });
  } catch (error) {
    await admin
      .from("library_sources")
      .update({ embedding_status: "failed" })
      .eq("id", sourceId);
    await setLibraryPipelineStage(
      admin,
      sourceId,
      LIBRARY_PIPELINE_STAGE.FAILED,
      libraryFailureMetadata(error),
    ).catch(() => {});
    throw error;
  }
}
