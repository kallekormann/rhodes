import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: rows, error } = await supabase.rpc(
    "accept_pending_workspace_invites",
  );

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  const workspaces = (rows ?? []).map(
    (row: { workspace_id: string; workspace_name: string }) => ({
      id: row.workspace_id,
      name: row.workspace_name,
    }),
  );

  return withSecurityHeaders(
    NextResponse.json({
      ok: true,
      workspaces,
      joined: workspaces.length,
    }),
  );
}
