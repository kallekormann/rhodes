"use client";

import type { ReactNode } from "react";
import "@/app/auth/auth.css";
import "./OnboardingScreen.css";

type OnboardingScreenProps = {
  title: string;
  lead?: string;
  children: ReactNode;
};

export function OnboardingScreen({ title, lead, children }: OnboardingScreenProps) {
  return (
    <div className="auth-shell onboarding-screen">
      <div className="auth-card onboarding-card">
        <p className="auth-brand">Rhodes</p>
        <h1 className="auth-title">{title}</h1>
        {lead ? <p className="auth-subtitle">{lead}</p> : null}
        {children}
      </div>
    </div>
  );
}
