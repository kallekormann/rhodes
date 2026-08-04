"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/Button";
import { ScopeCompositionSummary } from "@/components/scope-setup/ScopeCompositionSummary";
import { ScopeCompositionWorkspace } from "@/components/scope-setup/ScopeCompositionWorkspace";
import {
  draftFromSetupConfig,
  draftToCompositionBody,
  useScopeCompositionDraft,
} from "@/hooks/useScopeCompositionDraft";

type ScopeCompositionSettingsProps = {
  bundleIds: string[];
  setupConfig: Record<string, unknown>;
  canEdit: boolean;
  saving: boolean;
  onSave: (composition: ReturnType<typeof draftToCompositionBody>) => Promise<boolean>;
};

export function ScopeCompositionSettings({
  bundleIds,
  setupConfig,
  canEdit,
  saving,
  onSave,
}: ScopeCompositionSettingsProps) {
  const { featureGates, showToast } = useApp();
  const [tab, setTab] = useState<"views" | "templates" | "bundles">("views");
  const initial = draftFromSetupConfig(setupConfig, bundleIds);

  const {
    draft,
    resolved,
    toggleBaseView,
    toggleViewPreset,
    toggleTemplate,
    toggleBundle,
    resetDraft,
  } = useScopeCompositionDraft({
    tier: featureGates.tier,
    initial,
  });

  useEffect(() => {
    resetDraft(draftFromSetupConfig(setupConfig, bundleIds));
  }, [bundleIds, resetDraft, setupConfig]);

  const handleSave = async () => {
    if (!resolved.ok) {
      showToast(resolved.reason, "error");
      return;
    }
    const ok = await onSave(draftToCompositionBody(draft));
    if (ok) {
      showToast("Scope composition updated", "success");
    }
  };

  return (
    <div className="scope-composition-settings">
      <p className="caption settings-section__intro">
        Pick views, templates, and bundles for this scope. Items labeled &ldquo;Via&rdquo; come
        from a selected bundle — drop the bundle to release them individually. Views or
        templates enabled only by inference stay locked until you remove what requires them.
      </p>
      <ScopeCompositionWorkspace
        draft={draft}
        resolved={resolved}
        tier={featureGates.tier}
        tab={tab}
        onTabChange={setTab}
        onToggleBaseView={toggleBaseView}
        onToggleViewPreset={toggleViewPreset}
        onToggleTemplate={toggleTemplate}
        onToggleBundle={toggleBundle}
      />
      <ScopeCompositionSummary resolved={resolved} />
      {canEdit ? (
        <div className="scope-composition-settings__actions">
          <Button variant="primary" disabled={saving} onClick={() => void handleSave()}>
            {saving ? "Saving…" : "Save composition"}
          </Button>
        </div>
      ) : (
        <p className="caption settings-field__hint">
          Only scope admins can change composition.
        </p>
      )}
    </div>
  );
}
