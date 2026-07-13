import type { Job } from "bullmq";
import { Queue } from "bullmq";
import { createAdminClient } from "@rhodes/db";
import {
  EMBEDDING_MODEL,
  LIBRARY_EMBED_QUEUE,
} from "@rhodes/shared/constants";
import { chunkText } from "../lib/chunker";
import {
  LIBRARY_PIPELINE_STAGE,
  mergeSourceMetadata,
  setLibraryPipelineStage,
} from "../lib/library-source";
import { addOrReplaceJob } from "../lib/queue-job";
import { downloadLibraryFile } from "../lib/storage";
import { extractLibraryText } from "../lib/extract";
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
    const bytes = await downloadLibraryFile(filePath);
    const extractedText = await extractLibraryText(bytes, mimeType);

    if (!extractedText) {
      throw new Error("No text extracted from file");
    }

    const chunks = chunkText(extractedText);
    if (chunks.length === 0) {
      throw new Error("No chunks produced from extracted text");
    }

    await admin.from("library_source_chunks").delete().eq("source_id", sourceId);

    const { error: insertError } = await admin.from("library_source_chunks").insert(
      chunks.map((chunk) => ({
        source_id: sourceId,
        workspace_id: workspaceId,
        chunk_index: chunk.chunkIndex,
        page_number: chunk.pageNumber,
        content_chunk: chunk.content,
        embedding_model_version: EMBEDDING_MODEL,
      })),
    );

    if (insertError) {
      throw new Error(insertError.message);
    }

    const excerpt = extractedText.slice(0, 4000);
    await mergeSourceMetadata(admin, sourceId, {
      extracted_text_excerpt: excerpt,
      chunk_count: chunks.length,
      pipeline_stage: LIBRARY_PIPELINE_STAGE.INDEXING,
      pipeline_updated_at: new Date().toISOString(),
    });

    await addOrReplaceJob(
      embedQueue,
      "embed-chunks",
      { sourceId, workspaceId },
      `embed-${sourceId}`,
      { removeOnComplete: 100, removeOnFail: 50 },
    );

    console.log("[ingest] done", {
      sourceId,
      chunks: chunks.length,
      ms: Date.now() - started,
    });
  } catch (error) {
    await admin
      .from("library_sources")
      .update({ embedding_status: "failed" })
      .eq("id", sourceId);
    await setLibraryPipelineStage(admin, sourceId, LIBRARY_PIPELINE_STAGE.FAILED).catch(
      () => {},
    );
    throw error;
  }
}
