import type { Job } from "bullmq";
import { createAdminClient } from "@rhodes/db";
import {
  createOllamaClient,
  extractDocumentMetadataPrompt,
  whyRelevantPrompt,
  type KnowledgeMatch,
} from "@rhodes/ai";
import { OLLAMA_FAST_MODEL } from "@rhodes/shared/constants";

const AI_FILLABLE_KEYS = new Set([
  "summary",
  "tags",
  "document_type",
  "due_date",
  "stakeholders",
  "decision_status",
  "confidence",
  "status",
]);

export type WhyRelevantJobData = {
  type: "why-relevant";
  workspaceId: string;
  queryText: string;
  match: KnowledgeMatch;
};

export type ExtractDocumentMetadataJobData = {
  type: "extract-document-metadata";
  workspaceId: string;
  documentId: string;
};

export type LlmJobData = WhyRelevantJobData | ExtractDocumentMetadataJobData;

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length > 0 ? items : null;
}

function isMetadataValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return !record.start && !record.end;
  }
  return false;
}

async function processWhyRelevant(job: Job<WhyRelevantJobData>) {
  const ollama = createOllamaClient();
  const text = await ollama.generate(
    whyRelevantPrompt(job.data.match, job.data.queryText),
    OLLAMA_FAST_MODEL,
  );
  return text.slice(0, 120);
}

async function processExtractDocumentMetadata(
  job: Job<ExtractDocumentMetadataJobData>,
) {
  const { documentId, workspaceId } = job.data;
  const admin = createAdminClient();

  const { data: document, error: docError } = await admin
    .from("documents")
    .select("id, title, content_plain, metadata")
    .eq("id", documentId)
    .maybeSingle();

  if (docError) throw new Error(docError.message);
  if (!document?.content_plain?.trim()) return;

  const { data: schemas, error: schemaError } = await admin
    .from("metadata_schemas")
    .select("field_key, field_label, field_type, options")
    .eq("workspace_id", workspaceId);

  if (schemaError) throw new Error(schemaError.message);

  const eligibleFields = (schemas ?? []).filter((field) =>
    AI_FILLABLE_KEYS.has(field.field_key),
  );

  if (eligibleFields.length === 0) return;

  const ollama = createOllamaClient();
  const raw = await ollama.generate(
    extractDocumentMetadataPrompt({
      title: document.title,
      contentPlain: document.content_plain,
      fields: eligibleFields.map((field) => ({
        field_key: field.field_key,
        field_label: field.field_label,
        field_type: field.field_type,
        options: Array.isArray(field.options)
          ? field.options.filter((item): item is string => typeof item === "string")
          : null,
      })),
    }),
    OLLAMA_FAST_MODEL,
  );

  const extracted = parseJsonObject(raw);
  if (!extracted) return;

  const currentMetadata =
    document.metadata && typeof document.metadata === "object"
      ? (document.metadata as Record<string, unknown>)
      : {};

  const aiFilledKeys = Array.isArray(currentMetadata._ai_filled_keys)
    ? currentMetadata._ai_filled_keys.filter(
        (item): item is string => typeof item === "string",
      )
    : [];

  const nextMetadata: Record<string, unknown> = { ...currentMetadata };
  const nextAiFilled = new Set(aiFilledKeys);

  for (const field of eligibleFields) {
    const key = field.field_key;
    const currentValue = nextMetadata[key];
    const hasUserValue =
      !isMetadataValueEmpty(currentValue) && !aiFilledKeys.includes(key);
    if (hasUserValue) continue;

    const suggested = extracted[key];
    if (isMetadataValueEmpty(suggested)) continue;

    if (field.field_type === "tags" || field.field_type === "multi_select") {
      const tags = readStringArray(suggested);
      if (!tags) continue;
      nextMetadata[key] = tags;
    } else if (field.field_type === "date_range") {
      if (
        suggested &&
        typeof suggested === "object" &&
        !Array.isArray(suggested)
      ) {
        nextMetadata[key] = suggested;
      }
    } else if (typeof suggested === "string" || typeof suggested === "number") {
      nextMetadata[key] = suggested;
    } else if (Array.isArray(suggested)) {
      nextMetadata[key] = suggested;
    } else {
      continue;
    }

    nextAiFilled.add(key);
  }

  nextMetadata._ai_filled_keys = [...nextAiFilled];
  nextMetadata.word_count = document.content_plain.trim().split(/\s+/).filter(Boolean).length;

  const { error: updateError } = await admin
    .from("documents")
    .update({ metadata: nextMetadata })
    .eq("id", documentId);

  if (updateError) throw new Error(updateError.message);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("LLM job timed out")), timeoutMs);
    }),
  ]);
}

export async function processLlmJob(job: Job<LlmJobData>) {
  return withTimeout(
    (async () => {
      switch (job.data.type) {
        case "why-relevant":
          return processWhyRelevant(job as Job<WhyRelevantJobData>);
        case "extract-document-metadata":
          return processExtractDocumentMetadata(
            job as Job<ExtractDocumentMetadataJobData>,
          );
        default:
          throw new Error("Unknown LLM job type");
      }
    })(),
    30_000,
  );
}
