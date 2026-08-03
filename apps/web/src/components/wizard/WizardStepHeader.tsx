import "./WizardStepHeader.css";

type WizardStepHeaderProps = {
  heading: string;
  description?: string;
};

export function WizardStepHeader({ heading, description }: WizardStepHeaderProps) {
  return (
    <header className="wizard-step-header">
      <h3 className="wizard-step-header__heading">{heading}</h3>
      {description ? <p className="wizard-step-header__description">{description}</p> : null}
    </header>
  );
}
