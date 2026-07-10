import { NextResponse } from "next/server";
import { z } from "zod";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

const listTemplatesQuerySchema = z.object({
  workspace_id: z.string().uuid(),
  filter: z.enum(["all", "mine"]).default("all"),
});

const createTemplateSchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  structure_json: z.record(z.unknown()),
  source_document_id: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = listTemplatesQuerySchema.safeParse({
    workspace_id: searchParams.get("workspace_id"),
    filter: searchParams.get("filter") ?? "all",
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

  let query = supabase
    .from("templates")
    .select("id, workspace_id, created_by, name, description, is_system, is_shared, created_at")
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });

  if (parsed.data.filter === "mine") {
    query = query
      .eq("workspace_id", parsed.data.workspace_id)
      .eq("created_by", user.id);
  } else {
    query = query.or(
      `is_system.eq.true,workspace_id.eq.${parsed.data.workspace_id}`,
    );
  }

  const { data, error } = await query;

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ templates: data ?? [] }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createTemplateSchema.safeParse(body);

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
    .from("templates")
    .insert({
      workspace_id: parsed.data.workspace_id,
      created_by: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      structure_json: parsed.data.structure_json,
      is_system: false,
      is_shared: true,
    })
    .select(
      "id, workspace_id, created_by, name, description, is_system, is_shared, created_at",
    )
    .single();

  if (error || !data) {
    return withSecurityHeaders(
      NextResponse.json({ error: error?.message ?? "Create failed" }, { status: 400 }),
    );
  }

  if (parsed.data.source_document_id) {
    await supabase
      .from("documents")
      .delete()
      .eq("id", parsed.data.source_document_id);
  }

  return withSecurityHeaders(
    NextResponse.json({ template: data }, { status: 201 }),
  );
}
