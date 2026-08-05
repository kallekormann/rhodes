import { describe, expect, it } from "vitest";
import { resolveOnboardingStep, type OnboardingProfile } from "@/lib/profile/onboarding";

const incomplete: OnboardingProfile = {
  personalOnboardingCompletedAt: null,
  orgUpgradeOnboardingPending: false,
  orgUpgradeOnboardingCompletedAt: null,
};

const complete: OnboardingProfile = {
  personalOnboardingCompletedAt: "2026-08-05T00:00:00.000Z",
  orgUpgradeOnboardingPending: false,
  orgUpgradeOnboardingCompletedAt: null,
};

describe("resolveOnboardingStep", () => {
  it("sends new users with org.create to the tier fork", () => {
    expect(resolveOnboardingStep(incomplete, true)).toBe("tier_fork");
  });

  it("skips tier fork when the user already has an organization", () => {
    expect(resolveOnboardingStep(incomplete, true, { hasOrganization: true })).toBe(
      "personal",
    );
  });

  it("goes straight to personal when org.create is unavailable", () => {
    expect(resolveOnboardingStep(incomplete, false)).toBe("personal");
  });

  it("is done when personal onboarding is complete", () => {
    expect(resolveOnboardingStep(complete, true)).toBe("done");
    expect(resolveOnboardingStep(complete, true, { hasOrganization: true })).toBe("done");
  });
});
