"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { ScopeCompositionWorkspace } from "@/components/scope-setup/ScopeCompositionWorkspace";
import { ScopeSetupSummary } from "@/components/scope-setup/ScopeSetupSummary";
import {
  ScopeTeamInviteStep,
  type InviteRow,
} from "@/components/scope-setup/ScopeTeamInviteStep";
import { WizardScopeOutline } from "@/components/scope-setup/WizardScopeOutline";
import { WizardModal, WizardStepHeader, type WizardStep } from "@/components/wizard";
import {
  draftToCompositionBody,
  useScopeCompositionDraft,
  type ScopeCompositionDraft,
} from "@/hooks/useScopeCompositionDraft";
import type { ScopeCompositionBody } from "@/lib/scope-composition/apply";

export type ScopeSetupWizardMode =
  | "create_personal"
  | "create_team"
  | "settings_reconfigure";

export type PendingTeamInvite = {
  email: string;
  role: "admin" | "member" | "viewer";
};

export type ScopeSetupSubmitInput = {
  name: string;
  scopeComposition: ScopeCompositionBody;
  pendingInvites?: PendingTeamInvite[];
};

type ScopeSetupWizardProps = {
  open: boolean;
  mode: ScopeSetupWizardMode;
  kind?: "personal" | "team";
  initialName?: string;
  initialDraft?: Partial<ScopeCompositionDraft>;
  onClose: () => void;
  onSubmit: (input: ScopeSetupSubmitInput) => boolean | Promise<boolean>;
};

type StepConfig = WizardStep & {
  heading: string;
  description?: string;
};

const PERSONAL_STEPS: StepConfig[] = [
  {
    id: "name",
    label: "Name",
    heading: "What should we call this scope?",
    description: "You can rename it anytime in Settings.",
  },
  {
    id: "setup",
    label: "Setup",
    heading: "What do you want in this scope?",
    description:
      "Documents and Library are always included. Add views, templates, or bundles only if you need them.",
  },
  {
    id: "summary",
    label: "Summary",
    heading: "Review your scope",
    description: "Confirm everything below, then create your scope.",
  },
];

const TEAM_STEPS: StepConfig[] = [
  {
    id: "name",
    label: "Name",
    heading: "What should we call this team scope?",
    description: "Your team will see this name in the scope switcher.",
  },
  {
    id: "setup",
    label: "Setup",
    heading: "What do you want in this scope?",
    description:
      "Documents and Library are always included. Add views, templates, or bundles only if you need them.",
  },
  {
    id: "members",
    label: "Members",
    heading: "Who should join?",
    description: "Invite teammates now or add them later in Settings.",
  },
  {
    id: "summary",
    label: "Summary",
    heading: "Review your scope",
    description: "Confirm everything below, then create your team scope.",
  },
];

const SETTINGS_STEPS: StepConfig[] = [
  {
    id: "setup",
    label: "Setup",
    heading: "What should this scope include?",
    description: "Adjust views, templates, and bundles for this scope.",
  },
  {
    id: "summary",
    label: "Summary",
    heading: "Review your scope",
    description: "Confirm everything below, then save your changes.",
  },
];

function normalizeInvites(rows: InviteRow[]): PendingTeamInvite[] {
  const seen = new Set<string>();
  const invites: PendingTeamInvite[] = [];

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    invites.push({ email, role: row.role });
  }

  return invites;
}

export function ScopeSetupWizard({
  open,
  mode,
  kind = "personal",
  initialName = "",
  initialDraft,
  onClose,
  onSubmit,
}: ScopeSetupWizardProps) {
  const { featureGates } = useApp();
  const steps =
    mode === "settings_reconfigure"
      ? SETTINGS_STEPS
      : mode === "create_team"
        ? TEAM_STEPS
        : PERSONAL_STEPS;

  const [stepId, setStepId] = useState(steps[0]?.id ?? "name");
  const [name, setName] = useState(initialName);
  const [tab, setTab] = useState<"views" | "templates" | "bundles">("views");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inviteRows, setInviteRows] = useState<InviteRow[]>([]);

  const {
    draft,
    resolved,
    toggleBaseView,
    toggleTemplate,
    toggleBundle,
    resetDraft,
  } = useScopeCompositionDraft({
    tier: featureGates.tier,
    initial: initialDraft,
  });

  useEffect(() => {
    if (!open) {
      setStepId(mode === "settings_reconfigure" ? "setup" : "name");
      setName(initialName);
      setTab("views");
      setError(null);
      resetDraft(initialDraft);
      setSubmitting(false);
      setInviteRows([]);
      return;
    }
    resetDraft(initialDraft);
    setName(initialName);
  }, [open, mode, initialName, initialDraft, resetDraft]);

  const trimmedName = name.trim();
  const isCreate = mode === "create_personal" || mode === "create_team";
  const isSummaryStep = stepId === "summary";
  const title = isCreate
    ? kind === "personal"
      ? "New personal scope"
      : "New team scope"
    : "Configure scope";
  const placeholder =
    kind === "personal" ? "e.g. Book draft, Research notes" : "e.g. Growth Engine";

  const stepIndex = steps.findIndex((step) => step.id === stepId);
  const currentStep = steps[stepIndex];
  const isFirstStep = stepIndex <= 0;
  const isLastStep = stepIndex === steps.length - 1;

  const canAdvance = useMemo(() => {
    if (stepId === "name") return Boolean(trimmedName);
    if (stepId === "setup") return resolved.ok;
    if (stepId === "summary") return resolved.ok;
    return true;
  }, [resolved.ok, stepId, trimmedName]);

  const finish = async () => {
    if (!resolved.ok) {
      setError(resolved.reason);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const ok = await Promise.resolve(
        onSubmit({
          name: isCreate ? trimmedName : initialName,
          scopeComposition: draftToCompositionBody(draft),
          pendingInvites:
            mode === "create_team" ? normalizeInvites(inviteRows) : undefined,
        }),
      );
      if (ok) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    setError(null);
    if (isFirstStep) {
      onClose();
      return;
    }
    setStepId(steps[stepIndex - 1]?.id ?? steps[0].id);
  };

  const goNext = () => {
    setError(null);
    if (!canAdvance) return;

    if (isLastStep) {
      void finish();
      return;
    }

    setStepId(steps[stepIndex + 1]?.id ?? stepId);
  };

  const primaryLabel = isLastStep
    ? mode === "settings_reconfigure"
      ? "Save"
      : "Create"
    : "Continue";

  return (
    <WizardModal
      open={open}
      title={title}
      onClose={onClose}
      steps={steps}
      currentStepId={stepId}
      layout={isSummaryStep ? "full" : "split"}
      aside={
        isSummaryStep ? undefined : (
          <WizardScopeOutline
            scopeName={isCreate ? name : initialName}
            resolved={resolved}
            inviteRows={inviteRows}
            showMembers={mode === "create_team"}
          />
        )
      }
      footer={
        <>
          <Button variant="ghost" onClick={goBack}>
            {isFirstStep ? "Cancel" : "Back"}
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            disabled={submitting || !canAdvance}
            onClick={goNext}
          >
            {primaryLabel}
          </Button>
        </>
      }
    >
      {currentStep ? (
        <WizardStepHeader
          heading={currentStep.heading}
          description={currentStep.description}
        />
      ) : null}

      <div className="wizard-layout__main-body">
        {stepId === "name" ? (
          <div className="wizard-name-step">
            <Input
              value={name}
              onChange={setName}
              placeholder={placeholder}
              autoFocus
            />
          </div>
        ) : null}

        {stepId === "setup" ? (
          <ScopeCompositionWorkspace
            draft={draft}
            resolved={resolved}
            tier={featureGates.tier}
            tab={tab}
            onTabChange={setTab}
            onToggleBaseView={toggleBaseView}
            onToggleTemplate={toggleTemplate}
            onToggleBundle={toggleBundle}
          />
        ) : null}

        {stepId === "members" ? (
          <ScopeTeamInviteStep invites={inviteRows} onChange={setInviteRows} />
        ) : null}

        {stepId === "summary" ? (
          <ScopeSetupSummary
            scopeName={isCreate ? name : initialName}
            resolved={resolved}
            inviteRows={inviteRows}
            showMembers={mode === "create_team"}
          />
        ) : null}
      </div>

      {error ? <p className="caption wizard-error">{error}</p> : null}
    </WizardModal>
  );
}
