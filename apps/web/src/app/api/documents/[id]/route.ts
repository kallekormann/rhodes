import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { extractPlainText } from "@/lib/documents/plain-text";
import { updateDocumentSchema } from "@/lib/documents/schemas";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

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
    .from("documents")
    .select(
      "id, workspace_id, created_by, title, content, content_plain, metadata, updated_at, created_at",
    )
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

  return withSecurityHeaders(NextResponse.json({ document: data }));
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateDocumentSchema.safeParse(body);

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

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.metadata !== undefined) patch.metadata = parsed.data.metadata;
  if (parsed.data.content !== undefined) {
    patch.content = parsed.data.content;
    patch.content_plain =
      parsed.data.content_plain ?? extractPlainText(parsed.data.content).trim();
  } else if (parsed.data.content_plain !== undefined) {
    patch.content_plain = parsed.data.content_plain;
  }

  const { data, error } = await supabase
    .from("documents")
    .update(patch)
    .eq("id", id)
    .select(
      "id, workspace_id, created_by, title, content, content_plain, metadata, updated_at, created_at",
    )
    .single();

  if (error || !data) {
    return withSecurityHeaders(
      NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ document: data }));
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

  const { error } = await supabase.from("documents").delete().eq("id", id);

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ ok: true }));
}
