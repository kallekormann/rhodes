import { NextResponse } from "next/server";
import { z } from "zod";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

const listQuerySchema = z.object({
  workspace_id: z.string().uuid(),
});

const SCHEMA_FIELDS =
  "id, workspace_id, field_key, field_label, field_type, options, created_at";

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

  const { data, error } = await supabase
    .from("metadata_schemas")
    .select(SCHEMA_FIELDS)
    .eq("workspace_id", parsed.data.workspace_id)
    .order("field_label", { ascending: true });

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({ schemas: data ?? [] }),
  );
}
