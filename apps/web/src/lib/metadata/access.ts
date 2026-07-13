import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function canReadWorkspaceMetadata(
  supabase: SupabaseServerClient,
  workspaceId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc("can_read_workspace_metadata", {
    ws_id: workspaceId,
  });
  return data === true;
}

export async function canManageWorkspaceMetadata(
  supabase: SupabaseServerClient,
  workspaceId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc("can_manage_workspace_metadata", {
    ws_id: workspaceId,
  });
  return data === true;
}
