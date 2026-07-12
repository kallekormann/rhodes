import { NextResponse } from "next/server";
import { createAdminClient } from "@rhodes/db";
import { LIBRARY_BUCKET } from "@rhodes/shared/constants";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { saveLocalLibraryFile } from "@/lib/library/local-storage";
import { enqueueLibraryIngest } from "@/lib/library/queue";
import {
  isLibraryFileAllowed,
  LIBRARY_MAX_UPLOAD_BYTES,
  resolveLibraryMimeType,
} from "@/lib/library/schemas";
import { createClient } from "@/lib/supabase/server";

const SOURCE_FIELDS =
  "id, workspace_id, uploaded_by, file_name, file_path, file_type, summary, embedding_status, created_at";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const workspaceId = formData.get("workspace_id");

  if (!(file instanceof File)) {
    return withSecurityHeaders(
      NextResponse.json({ error: "file required" }, { status: 400 }),
    );
  }

  if (typeof workspaceId !== "string" || workspaceId.length === 0) {
    return withSecurityHeaders(
      NextResponse.json({ error: "workspace_id required" }, { status: 400 }),
    );
  }

  const mimeType = resolveLibraryMimeType(file);
  if (!mimeType || !isLibraryFileAllowed(file)) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Only PDF, DOCX, TXT, and Markdown files are supported" },
        { status: 400 },
      ),
    );
  }

  if (file.size > LIBRARY_MAX_UPLOAD_BYTES) {
    return withSecurityHeaders(
      NextResponse.json({ error: "File must be under 50MB" }, { status: 400 }),
    );
  }

  const { data: allowed } = await supabase.rpc("is_workspace_member", {
    ws_id: workspaceId,
  });

  if (!allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  const sourceId = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
  const filePath = `${workspaceId}/library/${sourceId}/${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(LIBRARY_BUCKET)
    .upload(filePath, bytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    if (process.env.NODE_ENV !== "production") {
      try {
        await saveLocalLibraryFile(filePath, bytes);
      } catch (localError) {
        const message =
          localError instanceof Error ? localError.message : "Local save failed";
        return withSecurityHeaders(
          NextResponse.json({ error: message }, { status: 400 }),
        );
      }
    } else {
      return withSecurityHeaders(
        NextResponse.json({ error: uploadError.message }, { status: 400 }),
      );
    }
  }

  const { data: source, error: insertError } = await supabase
    .from("library_sources")
    .insert({
      id: sourceId,
      workspace_id: workspaceId,
      uploaded_by: user.id,
      file_name: file.name,
      file_path: filePath,
      file_type: mimeType,
      embedding_status: "pending",
      metadata: { byte_size: file.size },
    })
    .select(SOURCE_FIELDS)
    .single();

  if (insertError || !source) {
    await admin.storage.from(LIBRARY_BUCKET).remove([filePath]).catch(() => {});
    return withSecurityHeaders(
      NextResponse.json(
        { error: insertError?.message ?? "Failed to create library source" },
        { status: 400 },
      ),
    );
  }

  try {
    await enqueueLibraryIngest({
      sourceId: source.id,
      workspaceId,
      filePath,
      mimeType,
    });
  } catch (queueError) {
    await admin
      .from("library_sources")
      .update({ embedding_status: "failed" })
      .eq("id", source.id);

    const message =
      queueError instanceof Error ? queueError.message : "Failed to enqueue ingest job";
    return withSecurityHeaders(
      NextResponse.json({ error: message }, { status: 503 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({ source }, { status: 201 }),
  );
}
