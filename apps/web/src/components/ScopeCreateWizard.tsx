"use client";

import { useEffect, useState } from "react";
import {
  ADDITIONAL_SCOPE_VIEW_CATALOG,
  validateAdditionalScopeViewSelection,
} from "@rhodes/shared/scope-views";
import { useApp } from "@/context/AppContext";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";
import "./ScopeCreateWizard.css";

export type ScopeCreateInput = {
  name: string;
  enabledViews: string[];
};

type ScopeCreateWizardProps = {
  open: boolean;
  kind: "personal" | "team";
  onClose: () => void;
  onSubmit: (input: ScopeCreateInput) => void;
};

export function ScopeCreateWizard({
  open,
  kind,
  onClose,
  onSubmit,
}: ScopeCreateWizardProps) {
  const { featureGates } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [selectedViews, setSelectedViews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const catalog = ADDITIONAL_SCOPE_VIEW_CATALOG;
  const hasCatalog = catalog.length > 0;
  const title = kind === "personal" ? "New personal scope" : "New team scope";
  const placeholder =
    kind === "personal"
      ? "e.g. Book draft, Research notes"
      : "e.g. Growth Engine";

  useEffect(() => {
    if (!open) {
      setStep(1);
      setName("");
      setSelectedViews([]);
      setError(null);
    }
  }, [open]);

  const trimmedName = name.trim();
  const canAdvance = trimmedName.length > 0;

  const finish = () => {
    const validation = validateAdditionalScopeViewSelection(
      featureGates.tier,
      selectedViews,
    );
    if (!validation.ok) {
      setError(validation.reason);
      return;
    }

    onSubmit({ name: trimmedName, enabledViews: selectedViews });
    onClose();
  };

  const handlePrimary = () => {
    setError(null);
    if (step === 1) {
      if (!canAdvance) return;
      if (!hasCatalog) {
        finish();
        return;
      }
      setStep(2);
      return;
    }
    finish();
  };

  const toggleView = (viewId: string) => {
    setSelectedViews((current) =>
      current.includes(viewId)
        ? current.filter((id) => id !== viewId)
        : [...current, viewId],
    );
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          {step === 2 && hasCatalog ? (
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button variant="primary" disabled={!canAdvance} onClick={handlePrimary}>
            {step === 1 && hasCatalog ? "Continue" : "Create"}
          </Button>
        </>
      }
    >
      {step === 1 ? (
        <div className="scope-create-wizard__step">
          <Input
            value={name}
            onChange={setName}
            placeholder={placeholder}
            autoFocus
          />
          {!hasCatalog && (
            <p className="caption scope-create-wizard__hint">
              Additional scope views are coming soon.
            </p>
          )}
        </div>
      ) : (
        <div className="scope-create-wizard__step">
          <p className="caption scope-create-wizard__intro">
            Optional views for this scope. Essentials like Documents and Library are always
            included.
          </p>
          <ul className="scope-create-wizard__views">
            {catalog.map((view) => (
              <li key={view.id}>
                <label className="scope-create-wizard__view-option">
                  <input
                    type="checkbox"
                    checked={selectedViews.includes(view.id)}
                    disabled={view.status !== "available"}
                    onChange={() => toggleView(view.id)}
                  />
                  <span>
                    <span className="scope-create-wizard__view-label">{view.label}</span>
                    <span className="caption scope-create-wizard__view-description">
                      {view.status === "available"
                        ? view.description
                        : "Coming soon"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="caption scope-create-wizard__error">{error}</p>}
    </Modal>
  );
}
