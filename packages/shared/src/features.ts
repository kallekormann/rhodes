import type { BillingTier, GatedView, TierFeature } from "./tiers";
import {
  getTierLimits,
  resolveTierLimits,
  tierAllowsFeature,
  tierAllowsView,
  tierFeatureLimit,
} from "./tiers";
import type { TeamCapability, TeamRole } from "./team-roles";
import {
  canManageTeamInvites,
  canRemoveTeamMember,
  canWriteTeamContent,
  hasTeamCapability,
} from "./team-roles";

export type FeatureGateContext = {
  tier: BillingTier;
  teamRole?: TeamRole | string;
};

export function canUseTierFeature(
  context: FeatureGateContext,
  feature: TierFeature,
): boolean {
  return tierAllowsFeature(context.tier, feature);
}

export function getTierFeatureLimit(
  context: FeatureGateContext,
  feature: TierFeature,
): number | string[] {
  return tierFeatureLimit(context.tier, feature);
}

export function canAccessAppView(context: FeatureGateContext, view: GatedView): boolean {
  return tierAllowsView(context.tier, view);
}

export function canUseTeamCapability(
  context: FeatureGateContext,
  capability: TeamCapability,
): boolean {
  return hasTeamCapability(context.teamRole, capability);
}

export function canWriteInScope(context: FeatureGateContext): boolean {
  if (context.teamRole) {
    return canWriteTeamContent(context.teamRole);
  }
  return true;
}

export function createFeatureGateContext(input: {
  tier: BillingTier;
  teamRole?: TeamRole | string;
}): FeatureGateContext {
  return {
    tier: input.tier,
    teamRole: input.teamRole,
  };
}

export {
  getTierLimits,
  resolveTierLimits,
  tierAllowsFeature,
  tierAllowsView,
  tierFeatureLimit,
  canManageTeamInvites,
  canRemoveTeamMember,
  canWriteTeamContent,
  hasTeamCapability,
};

export type { BillingTier, GatedView, TierFeature, TeamCapability, TeamRole };
