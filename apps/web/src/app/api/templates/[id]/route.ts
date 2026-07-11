import { NextResponse } from "next/server";
import { z } from "zod";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

const TEMPLATE_FIELDS =
  "id, workspace_id, created_by, name, description, metadata, structure_json, is_system, is_shared, created_at";

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  structure_json: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(_request: Request, context: RouteContext) {
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

  const { data, error } = await supabase
    .from("templates")
    .select(TEMPLATE_FIELDS)
    .eq("id", id)
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

  if (
    !data.is_system &&
    data.workspace_id &&
    !(await supabase.rpc("is_workspace_member", { ws_id: data.workspace_id }))
      .data
  ) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ template: data }));
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
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

  const { data: existing, error: loadError } = await supabase
    .from("templates")
    .select("id, workspace_id, is_system")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }

  if (existing.is_system || !existing.workspace_id) {
    return withSecurityHeaders(
      NextResponse.json({ error: "System templates cannot be edited" }, { status: 403 }),
    );
  }

  const { data: allowed } = await supabase.rpc("is_workspace_member", {
    ws_id: existing.workspace_id,
  });

  if (!allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.description !== undefined) {
    patch.description = parsed.data.description;
  }
  if (parsed.data.structure_json !== undefined) {
    patch.structure_json = parsed.data.structure_json;
  }
  if (parsed.data.metadata !== undefined) {
    patch.metadata = parsed.data.metadata;
  }

  const { data, error } = await supabase
    .from("templates")
    .update(patch)
    .eq("id", id)
    .select(TEMPLATE_FIELDS)
    .single();

  if (error || !data) {
    return withSecurityHeaders(
      NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ template: data }));
}

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

  const { data: existing, error: loadError } = await supabase
    .from("templates")
    .select("id, workspace_id, is_system")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }

  if (existing.is_system || !existing.workspace_id) {
    return withSecurityHeaders(
      NextResponse.json({ error: "System templates cannot be deleted" }, { status: 403 }),
    );
  }

  const { data: allowed } = await supabase.rpc("is_workspace_member", {
    ws_id: existing.workspace_id,
  });

  if (!allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  const { error } = await supabase.from("templates").delete().eq("id", id);

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ ok: true }));
}
