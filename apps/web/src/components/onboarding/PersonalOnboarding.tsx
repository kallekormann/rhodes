"use client";

import { useState } from "react";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/Button";
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
      <form className="auth-form onboarding-form" onSubmit={(event) => void handleSubmit(event)}>
        <AuthField
          label="Display name"
          name="display_name"
          value={displayName}
          onChange={setDisplayName}
          placeholder="Your name"
          autoComplete="name"
          autoFocus
          error={error ?? undefined}
        />
        <Button type="submit" loading={loading}>
          Get started
        </Button>
      </form>
    </OnboardingScreen>
  );
}
