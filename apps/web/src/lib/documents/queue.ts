import type { ConnectionOptions } from "bullmq";
import { Queue } from "bullmq";
import { DOCUMENT_EMBED_QUEUE, LLM_QUEUE } from "@rhodes/shared/constants";

const connection: ConnectionOptions = {
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
  maxRetriesPerRequest: null,
};

export async function enqueueDocumentEmbed(input: {
  documentId: string;
  workspaceId: string;
}) {
  const queue = new Queue(DOCUMENT_EMBED_QUEUE, { connection });
  try {
    await queue.add(
      "embed-document",
      input,
      {
        jobId: `doc-embed-${input.documentId}`,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
      },
    );
  } finally {
    await queue.close();
  }
}

export async function enqueueDocumentMetadataExtraction(input: {
  documentId: string;
  workspaceId: string;
}) {
  const queue = new Queue(LLM_QUEUE, { connection });
  try {
    await queue.add(
      "extract-document-metadata",
      {
        type: "extract-document-metadata",
        documentId: input.documentId,
        workspaceId: input.workspaceId,
      },
      {
        jobId: `metadata-${input.documentId}-${Date.now()}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  } finally {
    await queue.close();
  }
}
