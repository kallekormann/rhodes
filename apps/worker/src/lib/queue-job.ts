import type { JobsOptions, Queue } from "bullmq";

/**
 * Enqueue a job with a stable id, replacing any prior job (including completed).
 * Without removing completed jobs, BullMQ silently skips `queue.add` for the same id —
 * which left library sources stuck on "Indexing…" after re-ingest (chunks rewritten,
 * embed never re-run).
 */
export async function addOrReplaceJob<T>(
  queue: Queue,
  name: string,
  data: T,
  jobId: string,
  options?: Omit<JobsOptions, "jobId">,
) {
  const existing = await queue.getJob(jobId);
  if (existing) {
    try {
      await existing.remove();
    } catch {
      // Active/locked — use a unique id so work is not skipped.
      return queue.add(name, data, {
        ...options,
        jobId: `${jobId}-${Date.now()}`,
      });
    }
  }

  return queue.add(name, data, { ...options, jobId });
}
