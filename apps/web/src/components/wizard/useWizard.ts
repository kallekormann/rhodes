"use client";

import { useCallback, useMemo, useState } from "react";

export type WizardStep = {
  id: string;
  label: string;
};

export function useWizard(steps: WizardStep[], initialStepId?: string) {
  const [stepId, setStepId] = useState(initialStepId ?? steps[0]?.id ?? "");

  const stepIndex = useMemo(
    () => steps.findIndex((step) => step.id === stepId),
    [stepId, steps],
  );

  const isFirstStep = stepIndex <= 0;
  const isLastStep = stepIndex >= 0 && stepIndex === steps.length - 1;

  const goTo = useCallback((id: string) => {
    setStepId(id);
  }, []);

  const goBack = useCallback(() => {
    if (stepIndex <= 0) return;
    setStepId(steps[stepIndex - 1]?.id ?? stepId);
  }, [stepId, stepIndex, steps]);

  const goNext = useCallback(() => {
    if (stepIndex < 0 || stepIndex >= steps.length - 1) return;
    setStepId(steps[stepIndex + 1]?.id ?? stepId);
  }, [stepId, stepIndex, steps]);

  const reset = useCallback(
    (nextStepId?: string) => {
      setStepId(nextStepId ?? steps[0]?.id ?? "");
    },
    [steps],
  );

  return {
    stepId,
    stepIndex,
    isFirstStep,
    isLastStep,
    goTo,
    goBack,
    goNext,
    reset,
    setStepId,
  };
}
