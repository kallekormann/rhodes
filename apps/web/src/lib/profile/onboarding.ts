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

export type ResolveOnboardingOptions = {
  /**
   * True when the user already belongs to an organization.
   * Skips the tier fork / org-create steps so a refresh mid-onboarding
   * does not create a second org.
   */
  hasOrganization?: boolean;
};

export function resolveOnboardingStep(
  profile: OnboardingProfile,
  canCreateOrg: boolean,
  options: ResolveOnboardingOptions = {},
): OnboardingStep {
  if (
    profile.orgUpgradeOnboardingPending &&
    !profile.orgUpgradeOnboardingCompletedAt
  ) {
    return "org_upgrade";
  }

  if (!profile.personalOnboardingCompletedAt) {
    if (options.hasOrganization) {
      return "personal";
    }
    return canCreateOrg ? "tier_fork" : "personal";
  }

  return "done";
}
