import { z } from "zod";
import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  createMetadataSchemaInput,
  normalizeCreateMetadataSchemaInput,
} from "@/lib/metadata/api";
import { MAX_METADATA_SCHEMAS_PER_WORKSPACE } from "@/lib/metadata/schemas";
import { createClient } from "@/lib/supabase/server";

const listQuerySchema = z.object({
  workspace_id: z.string().uuid(),
});

const SCHEMA_FIELDS =
  "id, workspace_id, field_key, field_label, field_type, options, group_id, sub_key, sort_order, ai_fill_enabled, created_at";

const GROUP_FIELDS =
  "id, workspace_id, group_key, group_label, repeatable, sort_order, created_at";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    workspace_id: searchParams.get("workspace_id"),
  });

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

  const { data: allowed } = await supabase.rpc("is_workspace_member", {
    ws_id: parsed.data.workspace_id,
  });

  if (!allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  const { data: schemas, error: schemaError } = await supabase
    .from("metadata_schemas")
    .select(SCHEMA_FIELDS)
    .eq("workspace_id", parsed.data.workspace_id)
    .is("group_id", null)
    .order("field_label", { ascending: true });

  if (schemaError) {
    return withSecurityHeaders(
      NextResponse.json({ error: schemaError.message }, { status: 400 }),
    );
  }

  const { data: groupRows, error: groupError } = await supabase
    .from("metadata_schema_groups")
    .select(GROUP_FIELDS)
    .eq("workspace_id", parsed.data.workspace_id)
    .order("sort_order", { ascending: true });

  if (groupError) {
    return withSecurityHeaders(
      NextResponse.json({ error: groupError.message }, { status: 400 }),
    );
  }

  const groupIds = (groupRows ?? []).map((group) => group.id);
  let groupFields: Array<Record<string, unknown>> = [];

  if (groupIds.length > 0) {
    const { data: fields, error: fieldsError } = await supabase
      .from("metadata_schemas")
      .select(SCHEMA_FIELDS)
      .in("group_id", groupIds)
      .order("sort_order", { ascending: true });

    if (fieldsError) {
      return withSecurityHeaders(
        NextResponse.json({ error: fieldsError.message }, { status: 400 }),
      );
    }

    groupFields = fields ?? [];
  }

  const groups = (groupRows ?? []).map((group) => ({
    ...group,
    fields: groupFields.filter((field) => field.group_id === group.id),
  }));

  return withSecurityHeaders(
    NextResponse.json({ schemas: schemas ?? [], groups }),
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createMetadataSchemaInput.safeParse(body);

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

  const { data: allowed } = await supabase.rpc("is_workspace_member", {
    ws_id: parsed.data.workspace_id,
  });

  if (!allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  if (!(await canManageWorkspaceSchemas(supabase, parsed.data.workspace_id, user.id))) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Only workspace owners and admins can manage properties" },
        { status: 403 },
      ),
    );
  }

  const { count } = await supabase
    .from("metadata_schemas")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", parsed.data.workspace_id);

  if ((count ?? 0) >= MAX_METADATA_SCHEMAS_PER_WORKSPACE) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: `Maximum ${MAX_METADATA_SCHEMAS_PER_WORKSPACE} properties per workspace` },
        { status: 400 },
      ),
    );
  }

  let normalized;
  try {
    normalized = normalizeCreateMetadataSchemaInput(parsed.data);
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
    .insert({
      workspace_id: normalized.workspace_id,
      field_key: normalized.field_key,
      field_label: normalized.field_label,
      field_type: normalized.field_type,
      options: normalized.options,
      ai_fill_enabled: normalized.ai_fill_enabled,
    })
    .select(SCHEMA_FIELDS)
    .single();

  if (error || !data) {
    const message =
      error?.code === "23505"
        ? "A property with this key already exists"
        : error?.message ?? "Failed to create property";
    return withSecurityHeaders(
      NextResponse.json({ error: message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({ schema: data }, { status: 201 }),
  );
}
