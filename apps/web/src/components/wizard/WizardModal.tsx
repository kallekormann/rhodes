import type { ReactNode } from "react";
import { Modal } from "@/components/Modal";
import { WizardAside, WizardLayout, WizardMain } from "./WizardLayout";
import { WizardSteps } from "./WizardSteps";
import type { WizardStep } from "./useWizard";
import "./WizardModal.css";

type WizardModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  steps?: WizardStep[];
  currentStepId?: string;
  aside?: ReactNode;
  layout?: "split" | "full";
  footer: ReactNode;
  children: ReactNode;
};

export function WizardModal({
  open,
  title,
  onClose,
  steps,
  currentStepId,
  aside,
  layout = aside ? "split" : "full",
  footer,
  children,
}: WizardModalProps) {
  const showSteps = Boolean(steps && steps.length > 1 && currentStepId);
  const resolvedLayout = layout === "full" || !aside ? "full" : "split";

  return (
    <Modal open={open} title={title} onClose={onClose} className="wizard-modal" footer={footer}>
      <div className="wizard-modal__shell">
        {showSteps ? (
          <div className="wizard-modal__stepper">
            <WizardSteps steps={steps!} currentStepId={currentStepId!} />
          </div>
        ) : null}
        <WizardLayout variant={resolvedLayout}>
          <WizardMain>
            <div className="wizard-layout__main-content">{children}</div>
          </WizardMain>
          {aside ? <WizardAside>{aside}</WizardAside> : null}
        </WizardLayout>
      </div>
    </Modal>
  );
}
