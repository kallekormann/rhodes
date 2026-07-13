import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";
import { createWorkspaceSchema } from "@/lib/workspaces/schemas";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withSecurityHeaders(
      NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    );
  }

  const parsed = createWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    );
  }

  const { data: workspaceId, error } = await supabase.rpc("create_user_workspace", {
    ws_name: parsed.data.name,
    is_team: parsed.data.is_team_workspace,
  });

  if (error || !workspaceId) {
    const message = error?.message ?? "Couldn't create scope";
    const status = message.includes("limit reached") ? 403 : 400;
    return withSecurityHeaders(
      NextResponse.json({ error: message }, { status }),
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
        { error: fetchError?.message ?? "Scope not found after creation" },
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
