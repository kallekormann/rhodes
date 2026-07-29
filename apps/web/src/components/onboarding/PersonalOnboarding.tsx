"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";

type PersonalOnboardingProps = {
  initialDisplayName: string;
  onComplete: (displayName: string) => Promise<void>;
};

export function PersonalOnboarding({
  initialDisplayName,
  onComplete,
}: PersonalOnboardingProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError("Enter your name to continue.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onComplete(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <OnboardingScreen
      title="Welcome to Rhodes"
      lead="Your private scope is ready. Confirm how you'd like to appear to collaborators."
    >
      <Input
        value={displayName}
        onChange={setDisplayName}
        hint="Display name"
        placeholder="Your name"
        autoFocus
      />
      {error ? <p className="onboarding-error">{error}</p> : null}
      <div className="onboarding-actions">
        <Button variant="primary" disabled={loading} onClick={() => void handleSubmit()}>
          {loading ? "Saving…" : "Get started"}
        </Button>
      </div>
    </OnboardingScreen>
  );
}
