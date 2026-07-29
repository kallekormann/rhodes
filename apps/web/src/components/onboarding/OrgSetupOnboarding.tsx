"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";

type OrgSetupOnboardingProps = {
  onComplete: (orgName: string) => Promise<void>;
  onSkip: () => void;
};

export function OrgSetupOnboarding({ onComplete, onSkip }: OrgSetupOnboardingProps) {
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = orgName.trim();
    if (!trimmed) {
      setError("Enter an organization name.");
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
      title="Create your organization"
      lead="Name your company or workspace group. You can attach teams and policies in Settings."
    >
      <Input
        value={orgName}
        onChange={setOrgName}
        hint="Organization name"
        placeholder="e.g. Acme Research"
        autoFocus
      />
      {error ? <p className="onboarding-error">{error}</p> : null}
      <div className="onboarding-actions onboarding-actions--row">
        <Button variant="ghost" disabled={loading} onClick={onSkip}>
          Skip for now
        </Button>
        <Button variant="primary" disabled={loading} onClick={() => void handleSubmit()}>
          {loading ? "Creating…" : "Create organization"}
        </Button>
      </div>
    </OnboardingScreen>
  );
}
