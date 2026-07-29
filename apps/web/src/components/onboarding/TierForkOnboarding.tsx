"use client";

import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";

type TierForkOnboardingProps = {
  onJustMe: () => void;
  onSetupOrg: () => void;
};

export function TierForkOnboarding({
  onJustMe,
  onSetupOrg,
}: TierForkOnboardingProps) {
  return (
    <OnboardingScreen
      title="How do you want to work?"
      lead="You can always add an organization later in Settings."
    >
      <div className="onboarding-actions">
        <button type="button" className="onboarding-fork-option" onClick={onJustMe}>
          <strong>Just me</strong>
          <span>Private scopes and optional team collaboration.</span>
        </button>
        <button type="button" className="onboarding-fork-option" onClick={onSetupOrg}>
          <strong>Set up an organization</strong>
          <span>Create a company container for teams and org-wide policies.</span>
        </button>
      </div>
    </OnboardingScreen>
  );
}
