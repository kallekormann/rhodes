import type { ReactNode } from "react";
import "./WizardLayout.css";

type WizardLayoutProps = {
  children: ReactNode;
  variant?: "split" | "full";
};

export function WizardLayout({ children, variant = "split" }: WizardLayoutProps) {
  return (
    <div
      className={`wizard-layout${variant === "full" ? " wizard-layout--full" : ""}`}
    >
      {children}
    </div>
  );
}

export function WizardMain({ children }: { children: ReactNode }) {
  return <div className="wizard-layout__main">{children}</div>;
}

export function WizardAside({ children }: { children: ReactNode }) {
  return (
    <div className="wizard-layout__aside">
      <div className="wizard-scroll wizard-layout__aside-scroll">{children}</div>
    </div>
  );
}
