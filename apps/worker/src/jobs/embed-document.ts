import type { Job } from "bullmq";
import { createAdminClient } from "@rhodes/db";
import { createOllamaClient } from "@rhodes/ai";
import { EMBEDDING_DIMENSIONS } from "@rhodes/shared/constants";

export type EmbedDocumentJobData = {
  documentId: string;
  workspaceId: string;
};

function toVectorLiteral(vector: number[]): string {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}`);
  }
  return `[${vector.join(",")}]`;
}

export async function processEmbedDocumentJob(job: Job<EmbedDocumentJobData>) {
  const { documentId } = job.data;
  const admin = createAdminClient();

  const { data: document, error: loadError } = await admin
    .from("documents")
    .select("id, content_plain")
    .eq("id", documentId)
    .maybeSingle();

  if (loadError) {
    throw new Error(loadError.message);
  }

  const plain = document?.content_plain?.trim() ?? "";
  if (!plain) return;

  const ollama = createOllamaClient();
  const vector = await ollama.embed(plain.slice(0, 8000));

  const { error: updateError } = await admin
    .from("documents")
    .update({ embedding: toVectorLiteral(vector) })
    .eq("id", documentId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}
