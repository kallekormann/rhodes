import type { Job } from "bullmq";
import { Queue } from "bullmq";
import { createAdminClient } from "@rhodes/db";
import {
  EMBEDDING_MODEL,
  LIBRARY_EMBED_QUEUE,
  LIBRARY_SUMMARIZE_QUEUE,
} from "@rhodes/shared/constants";
import { chunkText } from "../lib/chunker";
import { downloadLibraryFile } from "../lib/storage";
import { extractTextWithTika } from "../lib/tika";
import { connection } from "../connection";

export type IngestJobData = {
  sourceId: string;
  workspaceId: string;
  filePath: string;
  mimeType: string;
};

const embedQueue = new Queue(LIBRARY_EMBED_QUEUE, { connection });
const summarizeQueue = new Queue(LIBRARY_SUMMARIZE_QUEUE, { connection });

export async function processIngestJob(job: Job<IngestJobData>) {
  const { sourceId, workspaceId, filePath, mimeType } = job.data;
  const admin = createAdminClient();

  await admin
    .from("library_sources")
    .update({ embedding_status: "processing" })
    .eq("id", sourceId);

  try {
    const bytes = await downloadLibraryFile(filePath);
    const extractedText = await extractTextWithTika(bytes, mimeType);

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
    await admin
      .from("library_sources")
      .update({
        metadata: {
          extracted_text_excerpt: excerpt,
          chunk_count: chunks.length,
        },
      })
      .eq("id", sourceId);

    await embedQueue.add(
      "embed-chunks",
      { sourceId, workspaceId },
      { jobId: `embed-${sourceId}`, removeOnComplete: 100, removeOnFail: 50 },
    );

    await summarizeQueue.add(
      "summarize-source",
      { sourceId, workspaceId, excerpt },
      { jobId: `summarize-${sourceId}`, removeOnComplete: 100, removeOnFail: 50 },
    );
  } catch (error) {
    await admin
      .from("library_sources")
      .update({ embedding_status: "failed" })
      .eq("id", sourceId);
    throw error;
  }
}
