import type { Job } from "bullmq";
import { createAdminClient } from "@rhodes/db";
import { createOllamaClient, librarySummaryPrompt, normalizeLibrarySummary } from "@rhodes/ai";
import {
  LIBRARY_SUMMARY_EXCERPT_CHARS,
  resolveOllamaSummaryModel,
  resolveOllamaSummaryTimeoutMs,
} from "@rhodes/shared/constants";
import {
  LIBRARY_PIPELINE_STAGE,
  setLibraryPipelineStage,
} from "../lib/library-source";
import { clearLibraryFailureMetadata } from "@rhodes/shared/library-failure";

export type SummarizeJobData = {
  sourceId: string;
  workspaceId: string;
  excerpt: string;
};

const MAX_RETRIES = 3;

async function generateSummaryWithRetry(excerpt: string): Promise<string> {
  const ollama = createOllamaClient();
  const prompt = librarySummaryPrompt(excerpt);
  const model = resolveOllamaSummaryModel();
  const timeoutMs = resolveOllamaSummaryTimeoutMs();
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      return await ollama.generate(prompt, model, {
        temperature: 0.2,
        numPredict: 180,
        timeoutMs,
      });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Summary generation failed");
}

export async function processSummarizeJob(job: Job<SummarizeJobData>) {
  const started = Date.now();
  const { sourceId, excerpt } = job.data;
  const admin = createAdminClient();
  const trimmedExcerpt = excerpt.slice(0, LIBRARY_SUMMARY_EXCERPT_CHARS);
  const model = resolveOllamaSummaryModel();

  console.log("[summarize] start", {
    sourceId,
    excerptChars: trimmedExcerpt.length,
    model,
  });

  const raw = await generateSummaryWithRetry(trimmedExcerpt);

  const summary = normalizeLibrarySummary(raw);
  if (!summary) {
    console.warn("[summarize] empty summary", { sourceId });
    await setLibraryPipelineStage(
      admin,
      sourceId,
      LIBRARY_PIPELINE_STAGE.READY,
      clearLibraryFailureMetadata(),
    );
    return;
  }

  await admin.from("library_sources").update({ summary }).eq("id", sourceId);
  await setLibraryPipelineStage(
    admin,
    sourceId,
    LIBRARY_PIPELINE_STAGE.READY,
    clearLibraryFailureMetadata(),
  );
  console.log("[summarize] done", { sourceId, ms: Date.now() - started });
}
