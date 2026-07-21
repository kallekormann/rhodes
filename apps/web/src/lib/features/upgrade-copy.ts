import type { TierFeature } from "@rhodes/shared/features";

const UPGRADE_COPY: Partial<Record<TierFeature, string>> = {
  "templates.create":
    "Template creation is available on paid plans. Upgrade to create custom templates.",
  "team_scopes.create":
    "Team scopes are available on Pro and Team plans. Upgrade to collaborate with your team.",
  "personal_scopes.create":
    "You've reached the personal scope limit for your plan. Upgrade to add more scopes.",
  "properties.manage":
    "Custom property management is available on paid plans. Upgrade to manage fields.",
};

export function upgradeCopyForFeature(feature: TierFeature): string {
  return (
    UPGRADE_COPY[feature] ??
    "This feature isn't available on your current plan. Upgrade to unlock it."
  );
}
