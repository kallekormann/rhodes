import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingTier } from "@rhodes/shared/tiers";
import type { TierFeature } from "@rhodes/shared/features";
import {
  canUseTierFeature,
  createFeatureGateContext,
  getTierLimits,
} from "@rhodes/shared/features";
import { resolveDevTier } from "@/lib/features/gates";
import { upgradeCopyForFeature } from "@/lib/features/upgrade-copy";

export function resolveServerTier(): BillingTier {
  return resolveDevTier();
}

export async function countOwnedScopes(
  supabase: SupabaseClient,
  userId: string,
  isTeam: boolean,
): Promise<number> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces!inner(is_team_workspace)")
    .eq("user_id", userId)
    .eq("role", "owner");

  if (error) return 0;

  return (data ?? []).filter((row) => {
    const workspace = row.workspaces as { is_team_workspace?: boolean } | null;
    return workspace?.is_team_workspace === isTeam;
  }).length;
}

export function requireTierFeature(
  tier: BillingTier,
  feature: TierFeature,
): { ok: true } | { ok: false; message: string } {
  const context = createFeatureGateContext({ tier });
  if (canUseTierFeature(context, feature)) {
    return { ok: true };
  }
  return { ok: false, message: upgradeCopyForFeature(feature) };
}

export async function assertCanCreateWorkspace(
  supabase: SupabaseClient,
  userId: string,
  tier: BillingTier,
  isTeam: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const limits = getTierLimits(tier);

  if (isTeam) {
    const featureCheck = requireTierFeature(tier, "team_scopes.create");
    if (!featureCheck.ok) return featureCheck;

    const owned = await countOwnedScopes(supabase, userId, true);
    if (owned >= limits.teamScopes) {
      return {
        ok: false,
        message: upgradeCopyForFeature("team_scopes.create"),
      };
    }
    return { ok: true };
  }

  const owned = await countOwnedScopes(supabase, userId, false);
  const personalLimit = Number.isFinite(limits.personalScopes)
    ? limits.personalScopes
    : Number.POSITIVE_INFINITY;

  if (owned >= personalLimit) {
    return {
      ok: false,
      message: upgradeCopyForFeature("personal_scopes.create"),
    };
  }

  return { ok: true };
}
