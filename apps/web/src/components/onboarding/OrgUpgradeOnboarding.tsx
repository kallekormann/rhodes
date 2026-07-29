"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";

type OrgUpgradeOnboardingProps = {
  onComplete: (choice: "separate" | "attach_all") => Promise<void>;
};

export function OrgUpgradeOnboarding({ onComplete }: OrgUpgradeOnboardingProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChoice = async (choice: "separate" | "attach_all") => {
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
      <div className="onboarding-actions">
        <button
          type="button"
          className="onboarding-fork-option"
          disabled={loading}
          onClick={() => void handleChoice("separate")}
        >
          <strong>Keep existing teams personal</strong>
          <span>Recommended — create new org teams when you are ready.</span>
        </button>
        <button
          type="button"
          className="onboarding-fork-option"
          disabled={loading}
          onClick={() => void handleChoice("attach_all")}
        >
          <strong>Move all my teams into the org</strong>
          <span>Attach every team scope you own to your new organization.</span>
        </button>
      </div>
      {error ? <p className="onboarding-error">{error}</p> : null}
      <div className="onboarding-actions">
        <Button
          variant="ghost"
          disabled={loading}
          onClick={() => void handleChoice("separate")}
        >
          Continue with recommended
        </Button>
      </div>
    </OnboardingScreen>
  );
}
