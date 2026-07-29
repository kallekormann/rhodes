import { NextResponse } from "next/server";
import { z } from "zod";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  ensureWorkspaceScopePolicy,
  getWorkspaceForPolicy,
  updateWorkspaceScopePolicy,
} from "@/lib/scope-policies/server";
import { createClient } from "@/lib/supabase/server";
import { validateAdditionalScopeViewSelection } from "@rhodes/shared/scope-views";
import { resolveServerTier } from "@/lib/features/server-gates";

type RouteContext = { params: Promise<{ id: string }> };

const patchPolicySchema = z.object({
  policy: z.record(z.unknown()).optional(),
  enabled_views: z.array(z.string().min(1)).optional(),
});

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

  const workspace = await getWorkspaceForPolicy(supabase, workspaceId);
  if (!workspace) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }

  const { policy, policyRow } = await readWorkspaceScopePolicy(supabase, workspace);

  return withSecurityHeaders(
    NextResponse.json({
      workspace_id: workspaceId,
      is_team_workspace: workspace.is_team_workspace === true,
      enabled_views: workspace.enabled_views ?? [],
      policy,
      version: policyRow?.version ?? 0,
      persisted: policyRow !== null,
    }),
  );
}

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
      NextResponse.json({ error: "Only scope admins can edit policies" }, { status: 403 }),
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

  const parsed = patchPolicySchema.safeParse(body);
  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    );
  }

  const workspace = await getWorkspaceForPolicy(supabase, workspaceId);
  if (!workspace) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }

  if (parsed.data.enabled_views) {
    const tier = resolveServerTier();
    const viewsValidation = validateAdditionalScopeViewSelection(
      tier,
      parsed.data.enabled_views,
    );
    if (!viewsValidation.ok) {
      return withSecurityHeaders(
        NextResponse.json({ error: viewsValidation.reason }, { status: 400 }),
      );
    }

    const { error: viewsError } = await supabase
      .from("workspaces")
      .update({ enabled_views: parsed.data.enabled_views })
      .eq("id", workspaceId);

    if (viewsError) {
      return withSecurityHeaders(
        NextResponse.json({ error: viewsError.message }, { status: 400 }),
      );
    }
    workspace.enabled_views = parsed.data.enabled_views;
  }

  let policy = (await ensureWorkspaceScopePolicy(supabase, workspace)).policy;
  if (parsed.data.policy) {
    policy = await updateWorkspaceScopePolicy(supabase, workspace, parsed.data.policy);
  }

  const refreshed = await getWorkspaceForPolicy(supabase, workspaceId);

  return withSecurityHeaders(
    NextResponse.json({
      workspace_id: workspaceId,
      is_team_workspace: workspace.is_team_workspace === true,
      enabled_views: refreshed?.enabled_views ?? [],
      policy,
    }),
  );
}
