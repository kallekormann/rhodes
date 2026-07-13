import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { updateWorkspaceSchema } from "@/lib/workspaces/schemas";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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

  const { data: isAdmin } = await supabase.rpc("is_workspace_admin", {
    ws_id: workspaceId,
  });

  if (!isAdmin) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Only scope admins can rename this scope" }, { status: 403 }),
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

  const parsed = updateWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    );
  }

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .update({ name: parsed.data.name })
    .eq("id", workspaceId)
    .select("id, name, is_team_workspace")
    .single();

  if (error || !workspace) {
    return withSecurityHeaders(
      NextResponse.json({ error: error?.message ?? "Couldn't rename scope" }, { status: 400 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        type: workspace.is_team_workspace ? "team" : "private",
      },
    }),
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
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

  const { error } = await supabase.rpc("delete_user_workspace", {
    ws_id: workspaceId,
  });

  if (error) {
    const status = error.message.includes("cannot be deleted") ? 403 : 400;
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ ok: true }));
}
