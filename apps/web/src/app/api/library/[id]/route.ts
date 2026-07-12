import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { removeLibrarySource } from "@/lib/library/delete-source";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
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
    .select("id, workspace_id, file_path")
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

  try {
    await removeLibrarySource({
      sourceId: source.id,
      filePath: source.file_path,
    });
  } catch (removeError) {
    const message =
      removeError instanceof Error ? removeError.message : "Failed to remove source";
    return withSecurityHeaders(
      NextResponse.json({ error: message }, { status: 500 }),
    );
  }

  return withSecurityHeaders(new NextResponse(null, { status: 204 }));
}
