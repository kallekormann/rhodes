import { NextResponse } from "next/server";
import {
  clearLibraryFailureMetadata,
} from "@rhodes/shared/library-failure";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { enqueueLibraryIngestRetry } from "@/lib/library/queue";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

const SOURCE_FIELDS =
  "id, workspace_id, file_name, file_path, file_type, embedding_status, metadata";

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: source, error } = await supabase
    .from("library_sources")
    .select(SOURCE_FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (error || !source) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }

  const { data: allowed } = await supabase.rpc("is_workspace_member", {
    ws_id: source.workspace_id,
  });

  if (!allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  await supabase.from("library_source_chunks").delete().eq("source_id", id);

  const currentMeta =
    source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata)
      ? (source.metadata as Record<string, unknown>)
      : {};

  const nextMetadata = {
    ...currentMeta,
    ...clearLibraryFailureMetadata(),
    pipeline_stage: "queued",
    pipeline_updated_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } = await supabase
    .from("library_sources")
    .update({
      embedding_status: "pending",
      summary: null,
      metadata: nextMetadata,
    })
    .eq("id", id)
    .select(
      "id, workspace_id, uploaded_by, file_name, file_path, file_type, summary, embedding_status, metadata, created_at",
    )
    .single();

  if (updateError || !updated) {
    return withSecurityHeaders(
      NextResponse.json({ error: updateError?.message ?? "Retry failed" }, { status: 400 }),
    );
  }

  if (!source.file_type) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Source is missing file type" }, { status: 400 }),
    );
  }

  try {
    await enqueueLibraryIngestRetry({
      sourceId: updated.id,
      workspaceId: updated.workspace_id,
      filePath: updated.file_path,
      mimeType: source.file_type,
    });
  } catch (queueError) {
    const message =
      queueError instanceof Error ? queueError.message : "Failed to enqueue retry";
    return withSecurityHeaders(
      NextResponse.json({ error: message }, { status: 503 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ source: updated }));
}
