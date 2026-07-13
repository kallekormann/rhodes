import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { extractPlainText } from "@/lib/documents/plain-text";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

const VERSION_THROTTLE_MS = 5 * 60 * 1000;

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
    .from("document_versions")
    .select(
      "id, document_id, workspace_id, changed_by, change_summary, created_at",
    )
    .eq("document_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ versions: data ?? [] }));
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const changeSummary =
    typeof body?.change_summary === "string" ? body.change_summary.trim() : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, workspace_id, content, content_plain")
    .eq("id", id)
    .maybeSingle();

  if (documentError || !document) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: documentError?.message ?? "Not found" },
        { status: documentError ? 400 : 404 },
      ),
    );
  }

  const { data: recent } = await supabase
    .from("document_versions")
    .select("created_at")
    .eq("document_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.created_at) {
    const elapsed = Date.now() - new Date(recent.created_at).getTime();
    if (elapsed < VERSION_THROTTLE_MS && !changeSummary) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: "Version throttle — wait before saving another snapshot" },
          { status: 429 },
        ),
      );
    }
  }

  const content = document.content as Record<string, unknown>;
  const contentPlain =
    (document.content_plain as string | null) ?? extractPlainText(content).trim();

  const { data: version, error } = await supabase
    .from("document_versions")
    .insert({
      document_id: id,
      workspace_id: document.workspace_id,
      content,
      content_plain: contentPlain,
      changed_by: user.id,
      change_summary: changeSummary || "Manual snapshot",
    })
    .select(
      "id, document_id, workspace_id, changed_by, change_summary, created_at",
    )
    .single();

  if (error || !version) {
    return withSecurityHeaders(
      NextResponse.json({ error: error?.message ?? "Version save failed" }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ version }, { status: 201 }));
}
