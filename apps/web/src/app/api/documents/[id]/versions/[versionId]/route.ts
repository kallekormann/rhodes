import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { recordDocumentActivity } from "@/lib/documents/activity";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string; versionId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id, versionId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data, error } = await supabase
    .from("document_versions")
    .select(
      "id, document_id, workspace_id, content, content_plain, changed_by, change_summary, created_at",
    )
    .eq("document_id", id)
    .eq("id", versionId)
    .maybeSingle();

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  if (!data) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ version: data }));
}

export async function POST(_request: Request, context: RouteContext) {
  const { id, versionId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: version, error: versionError } = await supabase
    .from("document_versions")
    .select("id, document_id, workspace_id, content, content_plain")
    .eq("document_id", id)
    .eq("id", versionId)
    .maybeSingle();

  if (versionError || !version) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: versionError?.message ?? "Version not found" },
        { status: versionError ? 400 : 404 },
      ),
    );
  }

  const { data: document, error: updateError } = await supabase
    .from("documents")
    .update({
      content: version.content,
      content_plain: version.content_plain,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(
      "id, workspace_id, created_by, title, content, content_plain, metadata, updated_at, created_at",
    )
    .single();

  if (updateError || !document) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: updateError?.message ?? "Restore failed" },
        { status: 400 },
      ),
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  await recordDocumentActivity(supabase, {
    documentId: id,
    workspaceId: document.workspace_id,
    actorId: user.id,
    actorDisplayName:
      profile?.display_name?.trim() || user.email?.split("@")[0] || "Someone",
    eventType: "version_restored",
    payload: { version_id: versionId },
  });

  return withSecurityHeaders(NextResponse.json({ document }));
}
