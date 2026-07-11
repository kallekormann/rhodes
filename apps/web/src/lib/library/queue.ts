import type { ConnectionOptions } from "bullmq";
import { Queue } from "bullmq";
import { LIBRARY_INGEST_QUEUE } from "@rhodes/shared/constants";

const connection: ConnectionOptions = {
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
  maxRetriesPerRequest: null,
};

export async function enqueueLibraryIngest(input: {
  sourceId: string;
  workspaceId: string;
  filePath: string;
  mimeType: string;
}) {
  const queue = new Queue(LIBRARY_INGEST_QUEUE, { connection });
  try {
    await queue.add(
      "process-file",
      input,
      {
        jobId: `ingest-${input.sourceId}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  } finally {
    await queue.close();
  }
}

export async function enqueueLibraryIngestRetry(input: {
  sourceId: string;
  workspaceId: string;
  filePath: string;
  mimeType: string;
}) {
  const queue = new Queue(LIBRARY_INGEST_QUEUE, { connection });
  try {
    await queue.add(
      "process-file",
      input,
      {
        jobId: `ingest-${input.sourceId}-${Date.now()}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  } finally {
    await queue.close();
  }
}
