import type { BillingTier } from "@rhodes/shared/tiers";
import type { FeatureGateContext, GatedView, TierFeature } from "@rhodes/shared/features";
import {
  canAccessAppView,
  canUseTeamCapability,
  canUseTierFeature,
  canWriteInScope,
  createFeatureGateContext,
  getTierFeatureLimit,
  getTierLimits,
} from "@rhodes/shared/features";

export type { BillingTier, FeatureGateContext, GatedView, TierFeature };

export function resolveDevTier(): BillingTier {
  const raw = process.env.NEXT_PUBLIC_MOCK_TIER?.trim().toLowerCase();
  if (raw === "free" || raw === "pro" || raw === "team") return raw;
  return "pro";
}

export function buildFeatureGates(input: {
  tier?: BillingTier;
  teamRole?: string;
}): {
  context: FeatureGateContext;
  tier: BillingTier;
  can: (feature: TierFeature) => boolean;
  limit: (feature: TierFeature) => number | string[];
  canAccessView: (view: GatedView) => boolean;
  canWrite: () => boolean;
  canManageTeam: (capability: Parameters<typeof canUseTeamCapability>[1]) => boolean;
} {
  const tier = input.tier ?? resolveDevTier();
  const context = createFeatureGateContext({
    tier,
    teamRole: input.teamRole,
  });

  return {
    context,
    tier,
    can: (feature) => canUseTierFeature(context, feature),
    limit: (feature) => getTierFeatureLimit(context, feature),
    canAccessView: (view) => canAccessAppView(context, view),
    canWrite: () => canWriteInScope(context),
    canManageTeam: (capability) => canUseTeamCapability(context, capability),
  };
}

export { getTierLimits };
