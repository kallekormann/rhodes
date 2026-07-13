import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  createMetadataGroupInput,
  normalizeCreateMetadataGroupInput,
} from "@/lib/metadata/api";
import { MAX_METADATA_SCHEMAS_PER_WORKSPACE } from "@/lib/metadata/schemas";
import { canManageWorkspaceMetadata } from "@/lib/metadata/access";
import { createClient } from "@/lib/supabase/server";

const GROUP_FIELDS =
  "id, workspace_id, group_key, group_label, repeatable, sort_order, created_at";

const SCHEMA_FIELDS =
  "id, workspace_id, field_key, field_label, field_type, options, group_id, sub_key, sort_order, ai_fill_enabled, created_at";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createMetadataGroupInput.safeParse(body);

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

  if (!(await canManageWorkspaceMetadata(supabase, parsed.data.workspace_id))) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "You do not have permission to manage properties in this scope" },
        { status: 403 },
      ),
    );
  }

  let normalized;
  try {
    normalized = normalizeCreateMetadataGroupInput(parsed.data);
  } catch (error) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid property group" },
        { status: 400 },
      ),
    );
  }

  const { count } = await supabase
    .from("metadata_schemas")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", normalized.workspace_id);

  if ((count ?? 0) + normalized.fields.length > MAX_METADATA_SCHEMAS_PER_WORKSPACE) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: `Maximum ${MAX_METADATA_SCHEMAS_PER_WORKSPACE} properties per workspace` },
        { status: 400 },
      ),
    );
  }

  const { data: group, error: groupError } = await supabase
    .from("metadata_schema_groups")
    .insert({
      workspace_id: normalized.workspace_id,
      group_key: normalized.group_key,
      group_label: normalized.group_label,
      repeatable: normalized.repeatable,
    })
    .select(GROUP_FIELDS)
    .single();

  if (groupError || !group) {
    const message =
      groupError?.code === "23505"
        ? "A property group with this key already exists"
        : groupError?.message ?? "Failed to create property group";
    return withSecurityHeaders(
      NextResponse.json({ error: message }, { status: 400 }),
    );
  }

  const { data: fields, error: fieldsError } = await supabase
    .from("metadata_schemas")
    .insert(
      normalized.fields.map((field) => ({
        workspace_id: normalized.workspace_id,
        group_id: group.id,
        field_key: field.field_key,
        field_label: field.field_label,
        sub_key: field.sub_key,
        field_type: field.field_type,
        options: field.options,
        sort_order: field.sort_order,
        ai_fill_enabled: field.ai_fill_enabled,
      })),
    )
    .select(SCHEMA_FIELDS);

  if (fieldsError) {
    await supabase.from("metadata_schema_groups").delete().eq("id", group.id);
    return withSecurityHeaders(
      NextResponse.json({ error: fieldsError.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({ group: { ...group, fields: fields ?? [] } }, { status: 201 }),
  );
}
