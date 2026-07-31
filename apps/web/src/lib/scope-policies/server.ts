import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultOrgPolicy,
  defaultPrivateScopePolicy,
  defaultTeamScopePolicy,
  mergeOrgPolicyUpdate,
  mergeScopePolicyUpdate,
  parseScopePolicyJson,
  type OrgPolicy,
  type ScopePolicy,
} from "@rhodes/shared/scope-policies";

type WorkspaceRow = {
  id: string;
  is_team_workspace: boolean | null;
  scope_policy_id: string | null;
  enabled_views: string[] | null;
};

type PolicyRow = {
  id: string;
  policy: Record<string, unknown>;
  version: number;
};

export async function getWorkspaceForPolicy(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceRow | null> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, is_team_workspace, scope_policy_id, enabled_views")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as WorkspaceRow | null;
}

async function linkWorkspacePolicy(
  supabase: SupabaseClient,
  workspaceId: string,
  policyId: string,
) {
  const { error } = await supabase
    .from("workspaces")
    .update({ scope_policy_id: policyId })
    .eq("id", workspaceId);

  if (error) throw new Error(error.message);
}

export async function readWorkspaceScopePolicy(
  supabase: SupabaseClient,
  workspace: WorkspaceRow,
): Promise<{ policy: ScopePolicy; policyRow: PolicyRow | null }> {
  const isTeam = workspace.is_team_workspace === true;
  const defaults = isTeam ? defaultTeamScopePolicy() : defaultPrivateScopePolicy();

  if (!workspace.scope_policy_id) {
    return { policy: defaults, policyRow: null };
  }

  const { data, error } = await supabase
    .from("scope_policies")
    .select("id, policy, version")
    .eq("id", workspace.scope_policy_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return { policy: defaults, policyRow: null };
  }

  return {
    policyRow: data as PolicyRow,
    policy: parseScopePolicyJson(isTeam, data.policy),
  };
}

export async function ensureWorkspaceScopePolicy(
  supabase: SupabaseClient,
  workspace: WorkspaceRow,
): Promise<{ policyRow: PolicyRow; policy: ScopePolicy }> {
  const isTeam = workspace.is_team_workspace === true;

  const existing = await readWorkspaceScopePolicy(supabase, workspace);
  if (existing.policyRow) {
    return existing as { policyRow: PolicyRow; policy: ScopePolicy };
  }

  const defaults = isTeam ? defaultTeamScopePolicy() : defaultPrivateScopePolicy();
  const { data: created, error: insertError } = await supabase
    .from("scope_policies")
    .insert({
      workspace_id: workspace.id,
      policy: defaults,
    })
    .select("id, policy, version")
    .single();

  if (insertError || !created) {
    throw new Error(insertError?.message ?? "Could not create scope policy");
  }

  await linkWorkspacePolicy(supabase, workspace.id, created.id);

  return {
    policyRow: created as PolicyRow,
    policy: parseScopePolicyJson(isTeam, created.policy),
  };
}

export async function updateWorkspaceScopePolicy(
  supabase: SupabaseClient,
  workspace: WorkspaceRow,
  patch: Record<string, unknown>,
): Promise<ScopePolicy> {
  const { policyRow, policy } = await ensureWorkspaceScopePolicy(supabase, workspace);
  const isTeam = workspace.is_team_workspace === true;
  const next = mergeScopePolicyUpdate(isTeam, policy, patch);

  const { error } = await supabase
    .from("scope_policies")
    .update({
      policy: next,
      version: policyRow.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", policyRow.id);

  if (error) throw new Error(error.message);
  return next;
}

export async function getOrgPolicy(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OrgPolicy> {
  const { data, error } = await supabase
    .from("organizations")
    .select("policy")
    .eq("id", orgId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organization not found");

  return mergeOrgPolicyUpdate(defaultOrgPolicy(), (data.policy as Record<string, unknown>) ?? {});
}

export async function updateOrgPolicy(
  supabase: SupabaseClient,
  orgId: string,
  patch: Record<string, unknown>,
): Promise<OrgPolicy> {
  const current = await getOrgPolicy(supabase, orgId);
  const next = mergeOrgPolicyUpdate(current, patch);

  const { error } = await supabase
    .from("organizations")
    .update({
      policy: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (error) throw new Error(error.message);
  return next;
}
