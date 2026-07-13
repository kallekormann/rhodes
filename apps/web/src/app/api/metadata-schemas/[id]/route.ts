import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  normalizeUpdateMetadataSchemaInput,
  updateMetadataSchemaInput,
} from "@/lib/metadata/api";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

const SCHEMA_FIELDS =
  "id, workspace_id, field_key, field_label, field_type, options, group_id, sub_key, sort_order, ai_fill_enabled, created_at";

async function canManageWorkspaceSchemas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string,
) {
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) return false;
  return membership.role === "owner" || membership.role === "admin";
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateMetadataSchemaInput.safeParse(body);

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
    .from("metadata_schemas")
    .select("id, workspace_id, group_id")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }

  if (existing.group_id) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Edit sub-properties through the property group editor" },
        { status: 400 },
      ),
    );
  }

  if (!(await canManageWorkspaceSchemas(supabase, existing.workspace_id, user.id))) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Only workspace owners and admins can manage properties" },
        { status: 403 },
      ),
    );
  }

  let normalized;
  try {
    normalized = normalizeUpdateMetadataSchemaInput(parsed.data);
  } catch (error) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid property" },
        { status: 400 },
      ),
    );
  }

  const { data, error } = await supabase
    .from("metadata_schemas")
    .update(normalized)
    .eq("id", id)
    .select(SCHEMA_FIELDS)
    .single();

  if (error || !data) {
    return withSecurityHeaders(
      NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ schema: data }));
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const purgeValues = searchParams.get("purge_values") === "true";

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
    .from("metadata_schemas")
    .select("id, workspace_id, field_key")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }

  if (!(await canManageWorkspaceSchemas(supabase, existing.workspace_id, user.id))) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Only workspace owners and admins can manage properties" },
        { status: 403 },
      ),
    );
  }

  if (purgeValues) {
    const { data: documents } = await supabase
      .from("documents")
      .select("id, metadata")
      .eq("workspace_id", existing.workspace_id)
      .not("metadata", "is", null);

    for (const document of documents ?? []) {
      const metadata = { ...(document.metadata as Record<string, unknown>) };
      if (!(existing.field_key in metadata)) continue;
      delete metadata[existing.field_key];
      await supabase
        .from("documents")
        .update({ metadata })
        .eq("id", document.id);
    }
  }

  const { data, error } = await supabase
    .from("metadata_schemas")
    .delete()
    .eq("id", id)
    .select(SCHEMA_FIELDS)
    .maybeSingle();

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ schema: data }));
}
