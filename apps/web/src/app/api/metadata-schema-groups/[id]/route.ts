import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  normalizeUpdateMetadataGroupInput,
  updateMetadataGroupInput,
} from "@/lib/metadata/api";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

const GROUP_FIELDS =
  "id, workspace_id, group_key, group_label, repeatable, sort_order, created_at";

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
  const parsed = updateMetadataGroupInput.safeParse(body);

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
    .from("metadata_schema_groups")
    .select("id, workspace_id, group_key")
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

  let normalized;
  try {
    normalized = normalizeUpdateMetadataGroupInput(existing.group_key, parsed.data);
  } catch (error) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid property group" },
        { status: 400 },
      ),
    );
  }

  const { error: groupError } = await supabase
    .from("metadata_schema_groups")
    .update({
      group_label: normalized.group_label,
      repeatable: normalized.repeatable,
    })
    .eq("id", id);

  if (groupError) {
    return withSecurityHeaders(
      NextResponse.json({ error: groupError.message }, { status: 400 }),
    );
  }

  const { data: existingFields, error: fieldsLoadError } = await supabase
    .from("metadata_schemas")
    .select("id")
    .eq("group_id", id);

  if (fieldsLoadError) {
    return withSecurityHeaders(
      NextResponse.json({ error: fieldsLoadError.message }, { status: 400 }),
    );
  }

  const keptIds = new Set(
    normalized.fields.map((field) => field.id).filter((fieldId): fieldId is string => Boolean(fieldId)),
  );
  const removeIds = (existingFields ?? [])
    .map((field) => field.id)
    .filter((fieldId) => !keptIds.has(fieldId));

  if (removeIds.length > 0) {
    const { error: removeError } = await supabase
      .from("metadata_schemas")
      .delete()
      .in("id", removeIds);

    if (removeError) {
      return withSecurityHeaders(
        NextResponse.json({ error: removeError.message }, { status: 400 }),
      );
    }
  }

  for (const field of normalized.fields) {
    const payload = {
      workspace_id: existing.workspace_id,
      group_id: id,
      field_key: field.field_key,
      field_label: field.field_label,
      sub_key: field.sub_key,
      field_type: field.field_type,
      options: field.options,
      sort_order: field.sort_order,
      ai_fill_enabled: field.ai_fill_enabled,
    };

    if (field.id) {
      const { error: updateError } = await supabase
        .from("metadata_schemas")
        .update(payload)
        .eq("id", field.id);

      if (updateError) {
        return withSecurityHeaders(
          NextResponse.json({ error: updateError.message }, { status: 400 }),
        );
      }
      continue;
    }

    const { error: insertError } = await supabase.from("metadata_schemas").insert(payload);
    if (insertError) {
      return withSecurityHeaders(
        NextResponse.json({ error: insertError.message }, { status: 400 }),
      );
    }
  }

  const { data: group, error: reloadError } = await supabase
    .from("metadata_schema_groups")
    .select(GROUP_FIELDS)
    .eq("id", id)
    .single();

  if (reloadError || !group) {
    return withSecurityHeaders(
      NextResponse.json({ error: reloadError?.message ?? "Update failed" }, { status: 400 }),
    );
  }

  const { data: fields, error: fieldsError } = await supabase
    .from("metadata_schemas")
    .select(SCHEMA_FIELDS)
    .eq("group_id", id)
    .order("sort_order", { ascending: true });

  if (fieldsError) {
    return withSecurityHeaders(
      NextResponse.json({ error: fieldsError.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({ group: { ...group, fields: fields ?? [] } }),
  );
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
    .from("metadata_schema_groups")
    .select("id, workspace_id, group_key")
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
      if (!(existing.group_key in metadata)) continue;
      delete metadata[existing.group_key];
      await supabase
        .from("documents")
        .update({ metadata })
        .eq("id", document.id);
    }
  }

  const { data, error } = await supabase
    .from("metadata_schema_groups")
    .delete()
    .eq("id", id)
    .select(GROUP_FIELDS)
    .maybeSingle();

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ group: data }));
}
