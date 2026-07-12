import type { ConnectionOptions, JobsOptions, Queue } from "bullmq";
import { Queue as BullQueue } from "bullmq";
import { LIBRARY_INGEST_QUEUE } from "@rhodes/shared/constants";

const connection: ConnectionOptions = {
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
  maxRetriesPerRequest: null,
};

async function addOrReplaceJob<T>(
  queue: Queue,
  name: string,
  data: T,
  jobId: string,
  options?: Omit<JobsOptions, "jobId">,
) {
  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state !== "completed") {
      await existing.remove();
    }
  }

  return queue.add(name, data, { ...options, jobId });
}

export async function enqueueLibraryIngest(input: {
  sourceId: string;
  workspaceId: string;
  filePath: string;
  mimeType: string;
}) {
  const queue = new BullQueue(LIBRARY_INGEST_QUEUE, { connection });
  try {
    await addOrReplaceJob(queue, "process-file", input, `ingest-${input.sourceId}`, {
      removeOnComplete: 100,
      removeOnFail: 50,
    });
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
  const queue = new BullQueue(LIBRARY_INGEST_QUEUE, { connection });
  try {
    await queue.add("process-file", input, {
      jobId: `ingest-${input.sourceId}-${Date.now()}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  } finally {
    await queue.close();
  }
}
