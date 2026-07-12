import type { ConnectionOptions, JobsOptions, Queue } from "bullmq";
import { Queue as BullQueue } from "bullmq";
import {
  LIBRARY_EMBED_QUEUE,
  LIBRARY_INGEST_QUEUE,
  LIBRARY_SUMMARIZE_QUEUE,
} from "@rhodes/shared/constants";

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

const LIBRARY_QUEUE_NAMES = [
  LIBRARY_INGEST_QUEUE,
  LIBRARY_EMBED_QUEUE,
  LIBRARY_SUMMARIZE_QUEUE,
] as const;

/** Drop pending ingest/embed/summarize jobs so a removed source is not re-indexed. */
export async function cancelLibrarySourceJobs(sourceId: string) {
  for (const queueName of LIBRARY_QUEUE_NAMES) {
    const queue = new BullQueue(queueName, { connection });
    try {
      const knownJobIds = [
        `ingest-${sourceId}`,
        `embed-${sourceId}`,
        `summarize-${sourceId}`,
      ];

      for (const jobId of knownJobIds) {
        const job = await queue.getJob(jobId);
        if (job) await job.remove();
      }

      const jobs = await queue.getJobs(
        ["wait", "active", "delayed", "failed", "paused"],
        0,
        200,
      );
      for (const job of jobs) {
        if (job.data?.sourceId === sourceId) {
          await job.remove();
        }
      }
    } finally {
      await queue.close();
    }
  }
}
