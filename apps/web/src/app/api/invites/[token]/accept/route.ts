import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: workspaceId, error } = await supabase.rpc("accept_workspace_invite", {
    invite_token: token,
  });

  if (error || !workspaceId) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: error?.message ?? "Couldn't accept invite" },
        { status: 400 },
      ),
    );
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", workspaceId)
    .single();

  return withSecurityHeaders(
    NextResponse.json({
      workspace: {
        id: workspaceId,
        name: workspace?.name ?? "Team scope",
      },
    }),
  );
}
