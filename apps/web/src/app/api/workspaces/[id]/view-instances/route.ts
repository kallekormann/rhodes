import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id: workspaceId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: isMember } = await supabase.rpc("is_workspace_member", {
    ws_id: workspaceId,
  });
  if (!isMember) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  const { data, error } = await supabase
    .from("scope_view_instances")
    .select(
      "id, workspace_id, base_view_type, label, config, layout, created_from_preset_id, position, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 500 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({ instances: data ?? [] }),
  );
}
