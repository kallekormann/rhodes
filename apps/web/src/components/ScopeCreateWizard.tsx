"use client";

import {
  ScopeSetupWizard,
  type ScopeSetupSubmitInput,
} from "@/components/ScopeSetupWizard";

export type ScopeCreateInput = ScopeSetupSubmitInput;

type ScopeCreateWizardProps = {
  open: boolean;
  kind: "personal" | "team";
  onClose: () => void;
  onSubmit: (input: ScopeCreateInput) => boolean | Promise<boolean>;
};

/** @deprecated Use ScopeSetupWizard directly — thin wrapper for existing call sites. */
export function ScopeCreateWizard({
  open,
  kind,
  onClose,
  onSubmit,
}: ScopeCreateWizardProps) {
  return (
    <ScopeSetupWizard
      open={open}
      mode={kind === "personal" ? "create_personal" : "create_team"}
      kind={kind}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
