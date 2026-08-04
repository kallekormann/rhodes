import { z } from "zod";
import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string; instanceId: string }> };

const layoutPointSchema = z.object({ x: z.number(), y: z.number() });

const updateInstanceSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
  layout: z.record(layoutPointSchema).nullable().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { id: workspaceId, instanceId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateInstanceSchema.safeParse(body);

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    );
  }
  if (
    parsed.data.label === undefined &&
    parsed.data.config === undefined &&
    parsed.data.layout === undefined
  ) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Nothing to update" }, { status: 400 }),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: canWrite } = await supabase.rpc("can_write_workspace", {
    ws_id: workspaceId,
  });
  if (!canWrite) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "You have read-only access in this scope" },
        { status: 403 },
      ),
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("scope_view_instances")
    .select("id, workspace_id")
    .eq("id", instanceId)
    .maybeSingle();

  if (existingError || !existing || existing.workspace_id !== workspaceId) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: existingError?.message ?? "Not found" },
        { status: existingError ? 400 : 404 },
      ),
    );
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.label !== undefined) patch.label = parsed.data.label;
  if (parsed.data.config !== undefined) patch.config = parsed.data.config;
  if (parsed.data.layout !== undefined) patch.layout = parsed.data.layout;

  const { data, error } = await supabase
    .from("scope_view_instances")
    .update(patch)
    .eq("id", instanceId)
    .select(
      "id, workspace_id, base_view_type, label, config, layout, created_from_preset_id, position, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    return withSecurityHeaders(
      NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ instance: data }));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: workspaceId, instanceId } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: canWrite } = await supabase.rpc("can_write_workspace", {
    ws_id: workspaceId,
  });
  if (!canWrite) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "You have read-only access in this scope" },
        { status: 403 },
      ),
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("scope_view_instances")
    .select("id, workspace_id, base_view_type")
    .eq("id", instanceId)
    .maybeSingle();

  if (existingError || !existing || existing.workspace_id !== workspaceId) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: existingError?.message ?? "Not found" },
        { status: existingError ? 400 : 404 },
      ),
    );
  }

  const { count, error: countError } = await supabase
    .from("scope_view_instances")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("base_view_type", existing.base_view_type);

  if (countError) {
    return withSecurityHeaders(
      NextResponse.json({ error: countError.message }, { status: 400 }),
    );
  }

  if ((count ?? 0) <= 1) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          error:
            "Keep at least one board for this view, or turn the view off under Settings → Views.",
        },
        { status: 400 },
      ),
    );
  }

  const { data: deleted, error } = await supabase
    .from("scope_view_instances")
    .delete()
    .eq("id", instanceId)
    .select("id");

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  if (!deleted?.length) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Could not delete this board. You may not have permission." },
        { status: 403 },
      ),
    );
  }

  return withSecurityHeaders(NextResponse.json({ ok: true }));
}
