import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id");

  if (membershipError) {
    return withSecurityHeaders(
      NextResponse.json({ error: membershipError.message }, { status: 400 }),
    );
  }

  const workspaceIds = [...new Set((memberships ?? []).map((row) => row.workspace_id))];

  const { data: workspaces, error: workspaceError } =
    workspaceIds.length > 0
      ? await supabase
          .from("workspaces")
          .select("id, name, is_team_workspace")
          .in("id", workspaceIds)
      : { data: [], error: null };

  if (workspaceError) {
    return withSecurityHeaders(
      NextResponse.json({ error: workspaceError.message }, { status: 400 }),
    );
  }

  const workspaceTargets = (workspaces ?? [])
    .map((workspace) => ({
      kind: "workspace" as const,
      id: workspace.id as string,
      label: workspace.name as string,
      subtitle: workspace.is_team_workspace ? "Team space" : "Personal space",
    }))
    .filter((item) => !query || item.label.toLowerCase().includes(query));

  let people: Array<{
    kind: "user";
    id: string;
    label: string;
    subtitle: string;
  }> = [];

  if (workspaceIds.length > 0) {
    const { data: members } = await supabase
      .from("workspace_members")
      .select("user_id, profiles(id, display_name)")
      .in("workspace_id", workspaceIds)
      .neq("user_id", user.id);

    const seen = new Set<string>();
    people = (members ?? [])
      .map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const label = (profile?.display_name as string | undefined) ?? "Teammate";
        if (seen.has(row.user_id)) return null;
        seen.add(row.user_id);
        return {
          kind: "user" as const,
          id: row.user_id as string,
          label,
          subtitle: "Person",
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => !query || item.label.toLowerCase().includes(query));
  }

  return withSecurityHeaders(
    NextResponse.json({
      targets: [...workspaceTargets, ...people].slice(0, 20),
    }),
  );
}
