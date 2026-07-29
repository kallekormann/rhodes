"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { RadioGroup } from "@/components/Radio";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";

type OrgUpgradeOnboardingProps = {
  onComplete: (choice: "separate" | "attach_all") => Promise<void>;
};

export function OrgUpgradeOnboarding({ onComplete }: OrgUpgradeOnboardingProps) {
  const [choice, setChoice] = useState<"separate" | "attach_all">("separate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onComplete(choice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <OnboardingScreen
      title="Your plan includes organizations"
      lead="Your private scopes stay personal. Choose how to treat existing team scopes."
    >
      <form className="auth-form onboarding-form" onSubmit={(event) => void handleSubmit(event)}>
        <RadioGroup
          name="org_upgrade"
          value={choice}
          onChange={(value) => setChoice(value as "separate" | "attach_all")}
          options={[
            {
              value: "separate",
              label: "Keep existing teams personal",
              description: "Recommended — create new org teams when you are ready.",
            },
            {
              value: "attach_all",
              label: "Move all my teams into the org",
              description: "Attach every team scope you own to your new organization.",
            },
          ]}
        />
        {error ? <p className="auth-message auth-message--error">{error}</p> : null}
        <Button type="submit" loading={loading}>
          Continue
        </Button>
      </form>
    </OnboardingScreen>
  );
}
