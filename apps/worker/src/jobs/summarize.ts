import type { Job } from "bullmq";
import { createAdminClient } from "@rhodes/db";
import { createOllamaClient, librarySummaryPrompt, normalizeLibrarySummary } from "@rhodes/ai";
import { OLLAMA_SUMMARY_MODEL } from "@rhodes/shared/constants";

export type SummarizeJobData = {
  sourceId: string;
  workspaceId: string;
  excerpt: string;
};

export async function processSummarizeJob(job: Job<SummarizeJobData>) {
  const started = Date.now();
  const { sourceId, excerpt } = job.data;
  const admin = createAdminClient();
  const ollama = createOllamaClient();

  const raw = await ollama.generate(
    librarySummaryPrompt(excerpt),
    OLLAMA_SUMMARY_MODEL,
  );

  const summary = normalizeLibrarySummary(raw);
  if (!summary) return;

  await admin.from("library_sources").update({ summary }).eq("id", sourceId);
  console.log("[summarize] done", { sourceId, ms: Date.now() - started });
}
