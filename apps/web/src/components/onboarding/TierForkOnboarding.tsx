"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { RadioGroup } from "@/components/Radio";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";

type TierForkOnboardingProps = {
  onJustMe: () => void;
  onSetupOrg: () => void;
};

export function TierForkOnboarding({
  onJustMe,
  onSetupOrg,
}: TierForkOnboardingProps) {
  const [choice, setChoice] = useState<"just_me" | "setup_org">("just_me");

  const handleContinue = () => {
    if (choice === "setup_org") {
      onSetupOrg();
      return;
    }
    onJustMe();
  };

  return (
    <OnboardingScreen
      title="How do you want to work?"
      lead="You can always add an organization later in Settings."
    >
      <form
        className="auth-form onboarding-form"
        onSubmit={(event) => {
          event.preventDefault();
          handleContinue();
        }}
      >
        <RadioGroup
          name="tier_fork"
          value={choice}
          onChange={(value) => setChoice(value as "just_me" | "setup_org")}
          options={[
            {
              value: "just_me",
              label: "Just me",
              description: "Private scopes and optional team collaboration.",
            },
            {
              value: "setup_org",
              label: "Set up an organization",
              description: "Create a company container for teams and org-wide policies.",
            },
          ]}
        />
        <Button type="submit">Continue</Button>
      </form>
    </OnboardingScreen>
  );
}
