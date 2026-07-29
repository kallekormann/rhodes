"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useApp } from "@/context/AppContext";
import type { OnboardingProfile } from "@/lib/profile/onboarding";
import { resolveOnboardingStep } from "@/lib/profile/onboarding";
import { OrgSetupOnboarding } from "@/components/onboarding/OrgSetupOnboarding";
import { OrgUpgradeOnboarding } from "@/components/onboarding/OrgUpgradeOnboarding";
import { PersonalOnboarding } from "@/components/onboarding/PersonalOnboarding";
import { TierForkOnboarding } from "@/components/onboarding/TierForkOnboarding";

type OnboardingGateProps = {
  onboarding: OnboardingProfile;
  onOnboardingChange: (next: OnboardingProfile) => void;
  children: ReactNode;
};

type LocalStep = "tier_fork" | "personal" | "org_setup";

async function patchOnboarding(body: Record<string, unknown>) {
  const response = await fetch("/app/api/profile/onboarding", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Could not save onboarding progress",
    );
  }
  return data.profile as {
    personal_onboarding_completed_at: string | null;
    org_upgrade_onboarding_pending: boolean;
    org_upgrade_onboarding_completed_at: string | null;
  };
}

function toProfile(data: {
  personal_onboarding_completed_at: string | null;
  org_upgrade_onboarding_pending: boolean;
  org_upgrade_onboarding_completed_at: string | null;
}): OnboardingProfile {
  return {
    personalOnboardingCompletedAt: data.personal_onboarding_completed_at,
    orgUpgradeOnboardingPending: data.org_upgrade_onboarding_pending,
    orgUpgradeOnboardingCompletedAt: data.org_upgrade_onboarding_completed_at,
  };
}

export function OnboardingGate({
  onboarding,
  onOnboardingChange,
  children,
}: OnboardingGateProps) {
  const { session, featureGates } = useApp();
  const canCreateOrg = featureGates.can("org.create");
  const initialStep = resolveOnboardingStep(onboarding, canCreateOrg);

  const [localStep, setLocalStep] = useState<LocalStep | null>(
    initialStep === "tier_fork" ? "tier_fork" : initialStep === "personal" ? "personal" : null,
  );

  const completeProfile = useCallback(
    async (body: Record<string, unknown>) => {
      const profile = await patchOnboarding(body);
      onOnboardingChange(toProfile(profile));
      setLocalStep(null);
    },
    [onOnboardingChange],
  );

  if (initialStep === "org_upgrade") {
    return (
      <OrgUpgradeOnboarding
        onComplete={async () => {
          await completeProfile({ step: "org_upgrade" });
        }}
      />
    );
  }

  if (initialStep === "done") {
    return children;
  }

  if (localStep === "tier_fork") {
    return (
      <TierForkOnboarding
        onJustMe={() => setLocalStep("personal")}
        onSetupOrg={() => setLocalStep("org_setup")}
      />
    );
  }

  if (localStep === "org_setup") {
    return (
      <OrgSetupOnboarding
        onSkip={() => setLocalStep("personal")}
        onComplete={async (orgName) => {
          const orgResponse = await fetch("/app/api/organizations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: orgName }),
          });
          const orgData = await orgResponse.json().catch(() => ({}));
          if (!orgResponse.ok) {
            throw new Error(
              typeof orgData.error === "string"
                ? orgData.error
                : "Could not create organization",
            );
          }
          setLocalStep("personal");
        }}
      />
    );
  }

  if (localStep === "personal" || initialStep === "personal") {
    return (
      <PersonalOnboarding
        initialDisplayName={session.displayName}
        onComplete={async (displayName) => {
          await completeProfile({
            step: "personal",
            display_name: displayName,
          });
        }}
      />
    );
  }

  return children;
}
