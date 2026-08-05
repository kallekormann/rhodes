"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useApp } from "@/context/AppContext";
import type { OnboardingProfile } from "@/lib/profile/onboarding";
import { resolveOnboardingStep } from "@/lib/profile/onboarding";
import type { ScopeCompositionBody } from "@/lib/scope-composition/apply";
import { createClient } from "@/lib/supabase/client";
import { OrgSetupOnboarding } from "@/components/onboarding/OrgSetupOnboarding";
import { OrgUpgradeOnboarding } from "@/components/onboarding/OrgUpgradeOnboarding";
import {
  PersonalOnboarding,
  type PersonalOnboardingPath,
} from "@/components/onboarding/PersonalOnboarding";
import { TierForkOnboarding } from "@/components/onboarding/TierForkOnboarding";
import {
  ScopeSetupWizard,
  type ScopeSetupSubmitInput,
} from "@/components/ScopeSetupWizard";
import { LoaderState } from "@/components/Loader";

type OnboardingGateProps = {
  onboarding: OnboardingProfile;
  onOnboardingChange: (next: OnboardingProfile) => void;
  children: ReactNode;
};

type LocalStep = "tier_fork" | "personal" | "org_setup" | "private_scope";

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

async function userHasOrganization(): Promise<boolean> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true });
  if (error) return false;
  return (count ?? 0) > 0;
}

async function applyPrivateScopeSetup(
  workspaceId: string,
  input: { name: string; scopeComposition: ScopeCompositionBody },
): Promise<void> {
  const renameResponse = await fetch(`/app/api/workspaces/${workspaceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: input.name }),
  });
  const renameData = await renameResponse.json().catch(() => ({}));
  if (!renameResponse.ok) {
    throw new Error(
      typeof renameData.error === "string" ? renameData.error : "Couldn't rename scope",
    );
  }

  const policyResponse = await fetch(`/app/api/workspaces/${workspaceId}/policy`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope_composition: input.scopeComposition }),
  });
  const policyData = await policyResponse.json().catch(() => ({}));
  if (!policyResponse.ok) {
    throw new Error(
      typeof policyData.error === "string"
        ? policyData.error
        : "Couldn't apply scope setup",
    );
  }
}

export function OnboardingGate({
  onboarding,
  onOnboardingChange,
  children,
}: OnboardingGateProps) {
  const {
    session,
    featureGates,
    scopes,
    scopesLoading,
    ensureWorkspace,
    refreshScopes,
    setActiveScope,
    showToast,
  } = useApp();
  const canCreateOrg = featureGates.can("org.create");

  const [orgReady, setOrgReady] = useState(false);
  const [hasOrganization, setHasOrganization] = useState(false);
  const [personalPath, setPersonalPath] =
    useState<PersonalOnboardingPath>("personal");
  const [localStep, setLocalStep] = useState<LocalStep | null>(null);
  /** After display name, run private-scope wizard once before entering the app. */
  const [pendingPrivateWizard, setPendingPrivateWizard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void userHasOrganization().then((hasOrg) => {
      if (cancelled) return;
      setHasOrganization(hasOrg);
      if (hasOrg) setPersonalPath("organization");
      setOrgReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!orgReady) return;
    if (pendingPrivateWizard) {
      setLocalStep("private_scope");
      return;
    }
    if (onboarding.personalOnboardingCompletedAt) {
      setLocalStep(null);
      return;
    }
    const step = resolveOnboardingStep(onboarding, canCreateOrg, {
      hasOrganization,
    });
    if (step === "tier_fork") setLocalStep("tier_fork");
    else if (step === "personal") setLocalStep("personal");
    else setLocalStep(null);
  }, [
    orgReady,
    onboarding,
    canCreateOrg,
    hasOrganization,
    pendingPrivateWizard,
  ]);

  useEffect(() => {
    if (localStep !== "private_scope") return;
    if (scopesLoading) return;
    void ensureWorkspace();
  }, [localStep, scopesLoading, ensureWorkspace]);

  const privateScope = useMemo(
    () =>
      scopes.find((scope) => scope.type === "private" && !scope.orgId) ??
      scopes.find((scope) => scope.type === "private") ??
      null,
    [scopes],
  );

  const completeProfile = useCallback(
    async (body: Record<string, unknown>) => {
      const profile = await patchOnboarding(body);
      onOnboardingChange(toProfile(profile));
    },
    [onOnboardingChange],
  );

  const finishPrivateWizard = useCallback(() => {
    setPendingPrivateWizard(false);
    setLocalStep(null);
  }, []);

  const handlePrivateScopeSubmit = useCallback(
    async (input: ScopeSetupSubmitInput) => {
      try {
        let target = privateScope;
        if (!target) {
          target = await ensureWorkspace();
        }
        if (!target) {
          showToast("Couldn't find your private scope", "error");
          return false;
        }
        await applyPrivateScopeSetup(target.id, {
          name: input.name,
          scopeComposition: input.scopeComposition,
        });
        await refreshScopes();
        setActiveScope(target.id);
        showToast(`“${input.name}” is ready`, "success");
        finishPrivateWizard();
        return true;
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Couldn't set up your private scope",
          "error",
        );
        return false;
      }
    },
    [
      privateScope,
      ensureWorkspace,
      refreshScopes,
      setActiveScope,
      showToast,
      finishPrivateWizard,
    ],
  );

  const initialStep = resolveOnboardingStep(onboarding, canCreateOrg, {
    hasOrganization,
  });

  if (initialStep === "org_upgrade") {
    return (
      <OrgUpgradeOnboarding
        onComplete={async () => {
          await completeProfile({ step: "org_upgrade" });
          setLocalStep(null);
        }}
      />
    );
  }

  if (initialStep === "done" && !pendingPrivateWizard) {
    return children;
  }

  if (!orgReady) {
    return <LoaderState label="Preparing your workspace…" align="fill" />;
  }

  if (localStep === "tier_fork") {
    return (
      <TierForkOnboarding
        onJustMe={() => {
          setPersonalPath("personal");
          setLocalStep("personal");
        }}
        onSetupOrg={() => setLocalStep("org_setup")}
      />
    );
  }

  if (localStep === "org_setup") {
    return (
      <OrgSetupOnboarding
        onSkip={() => {
          setPersonalPath("personal");
          setLocalStep("personal");
        }}
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
          setHasOrganization(true);
          setPersonalPath("organization");
          setLocalStep("personal");
        }}
      />
    );
  }

  if (localStep === "personal") {
    return (
      <PersonalOnboarding
        initialDisplayName={session.displayName}
        path={personalPath}
        onComplete={async (displayName) => {
          // Mark wizard pending before completing profile so a re-render
          // with personalOnboardingCompletedAt does not skip straight into the app.
          setPendingPrivateWizard(true);
          await completeProfile({
            step: "personal",
            display_name: displayName,
          });
          setLocalStep("private_scope");
        }}
      />
    );
  }

  if (localStep === "private_scope") {
    if (scopesLoading && !privateScope) {
      return <LoaderState label="Preparing your private scope…" align="fill" />;
    }

    return (
      <>
        {children}
        <ScopeSetupWizard
          open
          mode="onboarding_personal"
          kind="personal"
          initialName={
            privateScope?.name && privateScope.name !== "Private"
              ? privateScope.name
              : ""
          }
          onClose={finishPrivateWizard}
          onSubmit={handlePrivateScopeSubmit}
        />
      </>
    );
  }

  return children;
}
