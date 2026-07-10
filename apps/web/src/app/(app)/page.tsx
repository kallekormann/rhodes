import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .limit(5);

  const workspaceIds = memberships?.map((m) => m.workspace_id) ?? [];
  const { data: workspaces } = workspaceIds.length
    ? await supabase
        .from("workspaces")
        .select("id, name, is_team_workspace")
        .in("id", workspaceIds)
    : { data: [] };

  const workspaceById = new Map(
    (workspaces ?? []).map((ws) => [ws.id, ws]),
  );

  return (
    <div>
      <h1>Workspace</h1>
      <p className="app-lead">
        You&apos;re signed in. The editor shell arrives in Phase 04.
      </p>
      {memberships?.length ? (
        <ul className="app-list">
          {memberships.map((row) => (
            <li key={row.workspace_id}>
              {workspaceById.get(row.workspace_id)?.name ?? "Workspace"}{" "}
              <span className="app-meta">({row.role})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="app-meta">No workspace membership found yet.</p>
      )}
    </div>
  );
}
