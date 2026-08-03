"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { Input } from "@/components/Input";
import {
  WizardModal,
  WizardOutline,
  WizardOutlineSection,
  WizardStepHeader,
  TruncatedList,
  type WizardStep,
} from "@/components/wizard";
import { DEFAULT_SCOPE_VIEW_LABELS } from "@/lib/scope-composition/preview";
import "./WizardShowcase.css";

const DEMO_STEPS: WizardStep[] = [
  { id: "name", label: "Name" },
  { id: "setup", label: "Setup" },
  { id: "summary", label: "Summary" },
];

const DEMO_VIEWS = ["Kanban", "Insights", "Dashboard"];
const DEMO_TEMPLATES = ["Meeting notes", "Product spec"];

const STEP_COPY: Record<
  string,
  {
    heading: string;
    description: string;
    body: string;
  }
> = {
  name: {
    heading: "What should we call this scope?",
    description: "The outline on the right updates as you fill in each step.",
    body: "Enter a scope name to continue.",
  },
  setup: {
    heading: "What do you want in this scope?",
    description: "Toggle items below to see the outline react live.",
    body: "Everything in the outline will be set up when you create this scope.",
  },
  summary: {
    heading: "Review your scope",
    description: "Confirm everything below, then create your scope.",
    body: "",
  },
};

export function WizardShowcase() {
  const [open, setOpen] = useState(false);
  const [stepId, setStepId] = useState(DEMO_STEPS[0].id);
  const [scopeName, setScopeName] = useState("");
  const [views, setViews] = useState<string[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);

  const stepIndex = DEMO_STEPS.findIndex((step) => step.id === stepId);
  const isFirstStep = stepIndex <= 0;
  const isLastStep = stepIndex === DEMO_STEPS.length - 1;
  const currentStep = STEP_COPY[stepId];

  const previewViews = useMemo(
    () => [...DEFAULT_SCOPE_VIEW_LABELS, ...views],
    [views],
  );

  const canAdvance = useMemo(() => {
    if (stepId === "name") return Boolean(scopeName.trim());
    return true;
  }, [scopeName, stepId]);

  const reset = () => {
    setStepId(DEMO_STEPS[0].id);
    setScopeName("");
    setViews([]);
    setTemplates([]);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const goBack = () => {
    if (isFirstStep) {
      close();
      return;
    }
    setStepId(DEMO_STEPS[stepIndex - 1]?.id ?? DEMO_STEPS[0].id);
  };

  const goNext = () => {
    if (!canAdvance) return;
    if (isLastStep) {
      close();
      return;
    }
    setStepId(DEMO_STEPS[stepIndex + 1]?.id ?? stepId);
  };

  const toggleItem = (list: string[], value: string, onChange: (next: string[]) => void) => {
    onChange(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  return (
    <div className="wizard-showcase">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open wizard demo
      </Button>

      <WizardModal
        open={open}
        title="Wizard demo"
        onClose={close}
        steps={DEMO_STEPS}
        currentStepId={stepId}
        layout={stepId === "summary" ? "full" : "split"}
        aside={
          stepId === "summary" ? undefined : (
          <WizardOutline>
            <WizardOutlineSection
              label="Scope name"
              empty={scopeName.trim() ? undefined : "Untitled scope"}
            >
              {scopeName.trim() ? (
                <p className="wizard-outline__name-value">{scopeName.trim()}</p>
              ) : null}
            </WizardOutlineSection>
            <div className="wizard-outline__columns">
              <WizardOutlineSection label="Views">
                <TruncatedList items={previewViews} />
              </WizardOutlineSection>
              <WizardOutlineSection
                label="Templates"
                empty={templates.length === 0 ? "None selected" : undefined}
              >
                {templates.length > 0 ? <TruncatedList items={templates} /> : null}
              </WizardOutlineSection>
            </div>
          </WizardOutline>
          )
        }
        footer={
          <>
            <Button variant="ghost" onClick={goBack}>
              {isFirstStep ? "Cancel" : "Back"}
            </Button>
            <Button variant="primary" disabled={!canAdvance} onClick={goNext}>
              {isLastStep ? "Create" : "Continue"}
            </Button>
          </>
        }
      >
        <WizardStepHeader
          heading={currentStep.heading}
          description={currentStep.description}
        />

        <div className="wizard-layout__main-body">
          {stepId === "name" ? (
            <div className="wizard-name-step">
              <Input
                value={scopeName}
                onChange={setScopeName}
                placeholder="e.g. Book draft"
                autoFocus
              />
            </div>
          ) : null}

          {stepId === "setup" ? (
            <div className="wizard-showcase__setup">
              <ul className="wizard-showcase__options">
                {DEMO_VIEWS.map((view) => (
                  <li key={view} className="wizard-showcase__option">
                    <Checkbox
                      className="wizard-showcase__checkbox"
                      label={view}
                      checked={views.includes(view)}
                      onChange={() => toggleItem(views, view, setViews)}
                    />
                  </li>
                ))}
              </ul>
              <ul className="wizard-showcase__options">
                {DEMO_TEMPLATES.map((template) => (
                  <li key={template} className="wizard-showcase__option">
                    <Checkbox
                      className="wizard-showcase__checkbox"
                      label={template}
                      checked={templates.includes(template)}
                      onChange={() => toggleItem(templates, template, setTemplates)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {stepId === "summary" ? (
            <div className="scope-setup-summary">
              <section className="scope-setup-summary__block">
                <h4 className="scope-setup-summary__label">Scope name</h4>
                <p className="scope-setup-summary__name-value">
                  {scopeName.trim() || "Untitled scope"}
                </p>
              </section>
              <div className="scope-setup-summary__columns">
                <section className="scope-setup-summary__block">
                  <h4 className="scope-setup-summary__label">Views</h4>
                  <ul className="scope-setup-summary__list">
                    {previewViews.map((view) => (
                      <li key={view}>{view}</li>
                    ))}
                  </ul>
                </section>
                <section className="scope-setup-summary__block">
                  <h4 className="scope-setup-summary__label">Templates</h4>
                  {templates.length > 0 ? (
                    <ul className="scope-setup-summary__list">
                      {templates.map((template) => (
                        <li key={template}>{template}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="scope-setup-summary__empty">None selected</p>
                  )}
                </section>
              </div>
            </div>
          ) : null}
        </div>
      </WizardModal>
    </div>
  );
}
