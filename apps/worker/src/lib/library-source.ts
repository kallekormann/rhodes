import type { createAdminClient } from "@rhodes/db";

export const LIBRARY_PIPELINE_STAGE = {
  QUEUED: "queued",
  READING: "reading",
  INDEXING: "indexing",
  ANALYZING: "analyzing",
  READY: "ready",
  FAILED: "failed",
} as const;

export type LibraryPipelineStage =
  (typeof LIBRARY_PIPELINE_STAGE)[keyof typeof LIBRARY_PIPELINE_STAGE];

type AdminClient = ReturnType<typeof createAdminClient>;

export async function readSourceMetadata(
  admin: AdminClient,
  sourceId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin
    .from("library_sources")
    .select("metadata")
    .eq("id", sourceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.metadata || typeof data.metadata !== "object" || Array.isArray(data.metadata)) {
    return {};
  }

  return data.metadata as Record<string, unknown>;
}

export async function mergeSourceMetadata(
  admin: AdminClient,
  sourceId: string,
  patch: Record<string, unknown>,
) {
  const current = await readSourceMetadata(admin, sourceId);
  const { error } = await admin
    .from("library_sources")
    .update({ metadata: { ...current, ...patch } })
    .eq("id", sourceId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function setLibraryPipelineStage(
  admin: AdminClient,
  sourceId: string,
  stage: LibraryPipelineStage,
  extraMetadata: Record<string, unknown> = {},
) {
  await mergeSourceMetadata(admin, sourceId, {
    pipeline_stage: stage,
    pipeline_updated_at: new Date().toISOString(),
    ...extraMetadata,
  });
}
