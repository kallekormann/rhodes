import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { updateMemberRoleSchema } from "@/lib/workspaces/members";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: workspaceId, userId: memberUserId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { error } = await supabase.rpc("remove_workspace_member", {
    ws_id: workspaceId,
    member_user_id: memberUserId,
  });

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ ok: true }));
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: workspaceId, userId: memberUserId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateMemberRoleSchema.safeParse(body);

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    );
  }

  const { error } = await supabase.rpc("update_workspace_member_role", {
    ws_id: workspaceId,
    member_user_id: memberUserId,
    new_role: parsed.data.role,
  });

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ ok: true }));
}
