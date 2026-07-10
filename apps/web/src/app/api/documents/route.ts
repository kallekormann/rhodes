import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { extractPlainText } from "@/lib/documents/plain-text";
import {
  createDocumentSchema,
  EMPTY_DOCUMENT_CONTENT,
  listDocumentsQuerySchema,
} from "@/lib/documents/schemas";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = listDocumentsQuerySchema.safeParse({
    workspace_id: searchParams.get("workspace_id"),
    filter: searchParams.get("filter") ?? "recent",
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

  let query = supabase
    .from("documents")
    .select(
      "id, workspace_id, title, content, content_plain, metadata, updated_at, created_at",
    )
    .eq("workspace_id", parsed.data.workspace_id)
    .order("updated_at", { ascending: false });

  if (parsed.data.filter === "recent") {
    query = query.limit(50);
  }

  if (parsed.data.filter === "favorites") {
    query = query.contains("metadata", { favorite: true });
  }

  const { data, error } = await query;

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ documents: data ?? [] }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createDocumentSchema.safeParse(body);

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

  let content: Record<string, unknown> = { ...EMPTY_DOCUMENT_CONTENT };

  if (parsed.data.template_id) {
    const template = await supabase
      .from("templates")
      .select("structure_json")
      .eq("id", parsed.data.template_id)
      .maybeSingle();

    if (template.data?.structure_json) {
      content = template.data.structure_json as Record<string, unknown>;
    }
  }

  const title = parsed.data.title ?? "Untitled Document";
  const content_plain = extractPlainText(content).trim();

  const { data, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: parsed.data.workspace_id,
      created_by: user.id,
      title,
      content,
      content_plain,
      metadata: {},
    })
    .select(
      "id, workspace_id, title, content, content_plain, metadata, updated_at, created_at",
    )
    .single();

  if (error || !data) {
    return withSecurityHeaders(
      NextResponse.json({ error: error?.message ?? "Create failed" }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ document: data }, { status: 201 }));
}
