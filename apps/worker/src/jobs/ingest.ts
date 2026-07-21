import type { Job } from "bullmq";
import { Queue } from "bullmq";
import { createAdminClient } from "@rhodes/db";
import {
  EMBEDDING_MODEL,
  LIBRARY_EMBED_QUEUE,
} from "@rhodes/shared/constants";
import { libraryFailureMetadata } from "@rhodes/shared/library-failure";
import { extractLibraryDocument } from "../lib/extract";
import { segmentsToChunks } from "../lib/extractors/segment-chunker";
import {
  LIBRARY_PIPELINE_STAGE,
  mergeSourceMetadata,
  setLibraryPipelineStage,
} from "../lib/library-source";
import { addOrReplaceJob } from "../lib/queue-job";
import { downloadLibraryFile } from "../lib/storage";
import { connection } from "../connection";

export type IngestJobData = {
  sourceId: string;
  workspaceId: string;
  filePath: string;
  mimeType: string;
};

const embedQueue = new Queue(LIBRARY_EMBED_QUEUE, { connection });

export async function processIngestJob(job: Job<IngestJobData>) {
  const started = Date.now();
  const { sourceId, workspaceId, filePath, mimeType } = job.data;
  const admin = createAdminClient();

  console.log("[ingest] start", { sourceId, filePath, mimeType });

  await admin
    .from("library_sources")
    .update({ embedding_status: "processing" })
    .eq("id", sourceId);

  await setLibraryPipelineStage(admin, sourceId, LIBRARY_PIPELINE_STAGE.READING);

  try {
    const { data: sourceRow } = await admin
      .from("library_sources")
      .select("file_name")
      .eq("id", sourceId)
      .maybeSingle();

    const fileName = sourceRow?.file_name ?? filePath.split("/").pop() ?? "file";
    const bytes = await downloadLibraryFile(filePath);
    const extracted = await extractLibraryDocument(bytes, mimeType, fileName);
    const { chunks, truncated } = segmentsToChunks(extracted, {
      sourceId,
      sourceTitle: fileName,
    });

    if (chunks.length === 0) {
      throw new Error(
        `No extractable text from ${fileName} (extractor produced empty content)`,
      );
    }

    await admin.from("library_source_chunks").delete().eq("source_id", sourceId);

    const { error: insertError } = await admin.from("library_source_chunks").insert(
      chunks.map((chunk) => ({
        source_id: sourceId,
        workspace_id: workspaceId,
        chunk_index: chunk.chunkIndex,
        page_number: chunk.pageNumber,
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

    const excerpt = extracted.full_text.slice(0, 4000);
    await mergeSourceMetadata(admin, sourceId, {
      extracted_text_excerpt: excerpt,
      chunk_count: chunks.length,
      truncated,
      pipeline_stage: LIBRARY_PIPELINE_STAGE.INDEXING,
      pipeline_updated_at: new Date().toISOString(),
      extractor: extracted.extractor,
      ...(extracted.source_metadata ?? {}),
    });

    await addOrReplaceJob(
      embedQueue,
      "embed-chunks",
      { sourceId, workspaceId },
      `embed-${sourceId}`,
      {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
      },
    );

    console.log("[ingest] done", {
      sourceId,
      chunks: chunks.length,
      extractor: extracted.extractor,
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
