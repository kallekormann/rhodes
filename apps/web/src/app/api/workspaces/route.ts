import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  assertCanCreateWorkspace,
  resolveServerTier,
} from "@/lib/features/server-gates";
import { createClient } from "@/lib/supabase/server";
import { createWorkspaceSchema } from "@/lib/workspaces/schemas";
import { validateAdditionalScopeViewSelection } from "@rhodes/shared/scope-views";

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

  const tier = resolveServerTier();
  const scopeGate = await assertCanCreateWorkspace(
    supabase,
    user.id,
    tier,
    parsed.data.is_team_workspace,
  );
  if (!scopeGate.ok) {
    return withSecurityHeaders(
      NextResponse.json({ error: scopeGate.message }, { status: 403 }),
    );
  }

  const viewsValidation = validateAdditionalScopeViewSelection(
    tier,
    parsed.data.enabled_views ?? [],
  );
  if (!viewsValidation.ok) {
    return withSecurityHeaders(
      NextResponse.json({ error: viewsValidation.reason }, { status: 400 }),
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
    .select("id, name, is_team_workspace, enabled_views")
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

  const enabledViews = parsed.data.enabled_views ?? [];
  if (enabledViews.length > 0) {
    const { error: viewsError } = await supabase
      .from("workspaces")
      .update({ enabled_views: enabledViews })
      .eq("id", workspaceId);

    if (viewsError) {
      return withSecurityHeaders(
        NextResponse.json({ error: viewsError.message }, { status: 400 }),
      );
    }
  }

  return withSecurityHeaders(
    NextResponse.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        type: workspace.is_team_workspace ? "team" : "private",
        role: "owner",
        enabled_views: enabledViews,
      },
    }),
  );
}
