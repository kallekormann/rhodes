"use client";

import { useState } from "react";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/Button";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";

type OrgSetupOnboardingProps = {
  onComplete: (orgName: string) => Promise<void>;
  onSkip: () => void;
};

export function OrgSetupOnboarding({ onComplete, onSkip }: OrgSetupOnboardingProps) {
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
      <form className="auth-form onboarding-form" onSubmit={(event) => void handleSubmit(event)}>
        <AuthField
          label="Organization name"
          name="org_name"
          value={orgName}
          onChange={setOrgName}
          placeholder="e.g. Acme Research"
          autoFocus
          error={error ?? undefined}
        />
        <div className="onboarding-footer">
          <Button type="button" variant="ghost" disabled={loading} onClick={onSkip}>
            Skip for now
          </Button>
          <Button type="submit" loading={loading}>
            Create organization
          </Button>
        </div>
      </form>
    </OnboardingScreen>
  );
}
