import { Check } from "lucide-react";
import type { WizardStep } from "./useWizard";
import "./WizardSteps.css";

type WizardStepsProps = {
  steps: WizardStep[];
  currentStepId: string;
};

export function WizardSteps({ steps, currentStepId }: WizardStepsProps) {
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);

  return (
    <ol className="wizard-steps" aria-label="Setup progress">
      {steps.map((step, index) => {
        const isComplete = currentIndex > index;
        const isCurrent = step.id === currentStepId;
        const status = isComplete ? "complete" : isCurrent ? "current" : "upcoming";

        return (
          <li
            key={step.id}
            className={`wizard-steps__item wizard-steps__item--${status}`}
            aria-current={isCurrent ? "step" : undefined}
          >
            <div className="wizard-steps__content">
              <span className="wizard-steps__marker" aria-hidden="true">
                {isComplete ? <Check size={13} strokeWidth={2.5} /> : index + 1}
              </span>
              <span className="wizard-steps__label">{step.label}</span>
            </div>
            {index < steps.length - 1 ? (
              <span className="wizard-steps__connector" aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
