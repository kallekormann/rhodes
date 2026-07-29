export type OnboardingProfile = {
  personalOnboardingCompletedAt: string | null;
  orgUpgradeOnboardingPending: boolean;
  orgUpgradeOnboardingCompletedAt: string | null;
};

export type OnboardingStep =
  | "org_upgrade"
  | "tier_fork"
  | "personal"
  | "org_setup"
  | "done";

export function resolveOnboardingStep(
  profile: OnboardingProfile,
  canCreateOrg: boolean,
): OnboardingStep {
  if (
    profile.orgUpgradeOnboardingPending &&
    !profile.orgUpgradeOnboardingCompletedAt
  ) {
    return "org_upgrade";
  }

  if (!profile.personalOnboardingCompletedAt) {
    return canCreateOrg ? "tier_fork" : "personal";
  }

  return "done";
}
