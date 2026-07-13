import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import type {
  WorkspaceMember,
  WorkspaceMemberRole,
  WorkspacePendingInvite,
} from "@/lib/workspaces/members";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeRole(role: string): WorkspaceMemberRole {
  if (role === "owner" || role === "admin" || role === "member" || role === "viewer") {
    return role;
  }
  return "member";
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: workspaceId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: memberRows, error: membersError } = await supabase.rpc(
    "list_workspace_members",
    { ws_id: workspaceId },
  );

  if (membersError) {
    return withSecurityHeaders(
      NextResponse.json({ error: membersError.message }, { status: 400 }),
    );
  }

  const members: WorkspaceMember[] = (memberRows ?? []).map(
    (row: {
      user_id: string;
      display_name: string;
      avatar_url?: string | null;
      role: string;
    }) => ({
      user_id: row.user_id,
      display_name: row.display_name?.trim() || "Teammate",
      avatar_url: row.avatar_url ?? null,
      role: normalizeRole(row.role),
    }),
  );

  let pendingInvites: WorkspacePendingInvite[] = [];

  const { data: isAdmin } = await supabase.rpc("is_workspace_admin", {
    ws_id: workspaceId,
  });

  if (isAdmin) {
    const { data: pendingRows, error: pendingError } = await supabase.rpc(
      "list_workspace_pending_invites",
      { ws_id: workspaceId },
    );

    if (pendingError) {
      console.error("[members] pending invites:", pendingError.message);
    } else {
      pendingInvites = (pendingRows ?? []).map(
        (row: {
          id: string;
          email: string;
          role: string;
          expires_at: string;
          created_at: string;
        }) => ({
          id: row.id,
          email: row.email,
          role: row.role === "admin" ? "admin" : row.role === "viewer" ? "viewer" : "member",
          expires_at: row.expires_at,
          created_at: row.created_at,
        }),
      );
    }
  }

  return withSecurityHeaders(
    NextResponse.json({
      members,
      pending_invites: pendingInvites,
    }),
  );
}
