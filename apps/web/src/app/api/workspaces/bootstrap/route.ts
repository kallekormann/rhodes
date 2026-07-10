import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: workspaceId, error } = await supabase.rpc("bootstrap_user_workspace");

  if (error || !workspaceId) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: error?.message ?? "Workspace bootstrap failed" },
        { status: 400 },
      ),
    );
  }

  const { data: workspace, error: fetchError } = await supabase
    .from("workspaces")
    .select("id, name, is_team_workspace")
    .eq("id", workspaceId)
    .single();

  if (fetchError || !workspace) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: fetchError?.message ?? "Workspace not found after bootstrap" },
        { status: 400 },
      ),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        type: workspace.is_team_workspace ? "team" : "private",
        role: "owner",
      },
    }),
  );
}
