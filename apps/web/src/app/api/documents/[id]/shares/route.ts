import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
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
    .from("document_shares")
    .select("id, grantee_type, grantee_user_id, grantee_workspace_id, label, created_at")
    .eq("document_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ shares: data ?? [] }));
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  const granteeType = body?.grantee_type;
  const granteeId = body?.grantee_id;
  const label = typeof body?.label === "string" ? body.label.trim() : "";

  if (
    (granteeType !== "user" && granteeType !== "workspace") ||
    typeof granteeId !== "string" ||
    !label
  ) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Invalid share payload" }, { status: 400 }),
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

  const insert = {
    document_id: id,
    shared_by: user.id,
    grantee_type: granteeType,
    label,
    grantee_user_id: granteeType === "user" ? granteeId : null,
    grantee_workspace_id: granteeType === "workspace" ? granteeId : null,
  };

  const { data, error } = await supabase
    .from("document_shares")
    .insert(insert)
    .select("id, grantee_type, grantee_user_id, grantee_workspace_id, label, created_at")
    .single();

  if (error || !data) {
    return withSecurityHeaders(
      NextResponse.json({ error: error?.message ?? "Share failed" }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ share: data }, { status: 201 }));
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const shareId = searchParams.get("share_id");

  if (!shareId) {
    return withSecurityHeaders(
      NextResponse.json({ error: "share_id required" }, { status: 400 }),
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

  const { error } = await supabase
    .from("document_shares")
    .delete()
    .eq("id", shareId)
    .eq("document_id", id);

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ ok: true }));
}
