import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  assertCanCreateWorkspace,
  requireTierFeature,
  resolveServerTier,
} from "@/lib/features/server-gates";
import {
  applyScopeComposition,
  resolveAndValidateComposition,
} from "@/lib/scope-composition/apply";
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
  const compositionBody = parsed.data.scope_composition;
  let enabledViews = parsed.data.enabled_views ?? [];
  let compositionResult = null;

  if (compositionBody) {
    const resolved = resolveAndValidateComposition(compositionBody, tier);
    if (!resolved.ok) {
      return withSecurityHeaders(
        NextResponse.json({ error: resolved.reason }, { status: 400 }),
      );
    }
    compositionResult = resolved;
    enabledViews = resolved.enabledViews;
  } else {
    const viewsValidation = validateAdditionalScopeViewSelection(tier, enabledViews);
    if (!viewsValidation.ok) {
      return withSecurityHeaders(
        NextResponse.json({ error: viewsValidation.reason }, { status: 400 }),
      );
    }
  }

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

  if (parsed.data.org_id) {
    if (!parsed.data.is_team_workspace) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: "Only team scopes can belong to an organization" },
          { status: 400 },
        ),
      );
    }

    const orgCheck = requireTierFeature(tier, "org.create");
    if (!orgCheck.ok) {
      return withSecurityHeaders(
        NextResponse.json({ error: orgCheck.message }, { status: 403 }),
      );
    }

    const { data: orgMembership, error: orgError } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", parsed.data.org_id)
      .maybeSingle();

    if (orgError || !orgMembership) {
      return withSecurityHeaders(
        NextResponse.json({ error: "Organization not found" }, { status: 404 }),
      );
    }

    if (orgMembership.role !== "owner" && orgMembership.role !== "admin") {
      return withSecurityHeaders(
        NextResponse.json(
          { error: "Only org owners and admins can create org teams" },
          { status: 403 },
        ),
      );
    }
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
    .select("id, name, is_team_workspace, enabled_views, bundle_ids, setup_config")
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

  const workspaceUpdates: {
    enabled_views?: string[];
    org_id?: string;
  } = {};

  if (compositionResult) {
    const applied = await applyScopeComposition(supabase, {
      workspaceId,
      composition: compositionResult,
      wizardMode: "create",
    });
    if (!applied.ok) {
      return withSecurityHeaders(
        NextResponse.json({ error: applied.message }, { status: 400 }),
      );
    }
  } else if (enabledViews.length > 0) {
    workspaceUpdates.enabled_views = enabledViews;
  }

  if (parsed.data.org_id) {
    workspaceUpdates.org_id = parsed.data.org_id;
  }

  if (Object.keys(workspaceUpdates).length > 0) {
    const { error: updateError } = await supabase
      .from("workspaces")
      .update(workspaceUpdates)
      .eq("id", workspaceId);

    if (updateError) {
      return withSecurityHeaders(
        NextResponse.json({ error: updateError.message }, { status: 400 }),
      );
    }
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("workspaces")
    .select("id, name, is_team_workspace, enabled_views, bundle_ids, setup_config")
    .eq("id", workspaceId)
    .single();

  if (refreshError || !refreshed) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: refreshError?.message ?? "Scope not found after creation" },
        { status: 400 },
      ),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({
      workspace: {
        id: refreshed.id,
        name: refreshed.name,
        type: refreshed.is_team_workspace ? "team" : "private",
        role: "owner",
        org_id: parsed.data.org_id ?? null,
        enabled_views: refreshed.enabled_views ?? [],
        bundle_ids: refreshed.bundle_ids ?? [],
        setup_config: refreshed.setup_config ?? {},
      },
      ...(compositionResult
        ? { inferred: compositionResult.inferred }
        : {}),
    }),
  );
}
