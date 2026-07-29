"use client";

import type { ReactNode } from "react";
import "./OnboardingScreen.css";

type OnboardingScreenProps = {
  title: string;
  lead?: string;
  children: ReactNode;
};

export function OnboardingScreen({ title, lead, children }: OnboardingScreenProps) {
  return (
    <div className="onboarding-screen">
      <div className="onboarding-card">
        <p className="onboarding-brand">Rhodes</p>
        <h1 className="onboarding-title">{title}</h1>
        {lead ? <p className="onboarding-lead">{lead}</p> : null}
        {children}
      </div>
    </div>
  );
}
