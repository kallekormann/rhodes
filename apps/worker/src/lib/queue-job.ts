import type { JobsOptions, Queue } from "bullmq";

/** Replace a non-completed job with the same id so retries and re-queues are not skipped. */
export async function addOrReplaceJob<T>(
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
