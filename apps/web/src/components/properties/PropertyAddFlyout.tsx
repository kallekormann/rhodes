"use client";

import { X } from "lucide-react";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import { PropertyFieldComposer } from "@/components/properties/PropertyFieldComposer";
import { PropertyGroupComposer } from "@/components/properties/PropertyGroupComposer";
import { PropertyPickPanel } from "@/components/properties/PropertyPickPanel";
import type { MetadataFieldType, MetadataSchemaField, MetadataSchemaGroup } from "@/lib/metadata/schemas";
import "./PropertyAddFlyout.css";
import "./property-composer.css";

export type FlyoutMode = "pick" | "compose";
export type ComposeKind = "field" | "group";

type PropertyAddFlyoutProps = {
  open: boolean;
  mode: FlyoutMode;
  composeKind: ComposeKind;
  presetLabel: string | null;
  schemas: MetadataSchemaField[];
  groups: MetadataSchemaGroup[];
  onClose: () => void;
  onBackToPick: () => void;
  onAddFieldPreset: (label: string) => Promise<void>;
  onAddGroupPreset: (label: string) => Promise<void>;
  onCustomizeFieldPreset: (label: string) => void;
  onCustomizeGroupPreset: (label: string) => void;
  onCreateCustomField: () => void;
  onCreateCustomGroup: () => void;
  onCreateSchema: (input: {
    field_label: string;
    field_type: MetadataFieldType;
    options?: string[] | { unit: string };
  }) => Promise<{ ok: boolean; error?: string }>;
  onCreateGroup: (input: {
    group_label: string;
    repeatable?: boolean;
    fields: Array<{
      field_label: string;
      field_type: MetadataFieldType;
      sub_key?: string;
      options?: string[] | { unit: string };
    }>;
  }) => Promise<{ ok: boolean; error?: string }>;
};

function flyoutTitle(mode: FlyoutMode, composeKind: ComposeKind, presetLabel: string | null) {
  if (mode === "pick") return "Add property";
  if (composeKind === "group") {
    return presetLabel ? `Customize ${presetLabel}` : "New group";
  }
  return presetLabel ? `Customize ${presetLabel}` : "New property";
}

export function PropertyAddFlyout({
  open,
  mode,
  composeKind,
  presetLabel,
  schemas,
  groups,
  onClose,
  onBackToPick,
  onAddFieldPreset,
  onAddGroupPreset,
  onCustomizeFieldPreset,
  onCustomizeGroupPreset,
  onCreateCustomField,
  onCreateCustomGroup,
  onCreateSchema,
  onCreateGroup,
}: PropertyAddFlyoutProps) {
  if (!open) return null;

  const title = flyoutTitle(mode, composeKind, presetLabel);

  const handleCreateSchema = async (input: {
    field_label: string;
    field_type: MetadataFieldType;
    options?: string[] | { unit: string };
  }) => {
    const result = await onCreateSchema(input);
    if (result.ok) onClose();
    return result;
  };

  const handleCreateGroup = async (input: {
    group_label: string;
    repeatable?: boolean;
    fields: Array<{
      field_label: string;
      field_type: MetadataFieldType;
      sub_key?: string;
      options?: string[] | { unit: string };
    }>;
  }) => {
    const result = await onCreateGroup(input);
    if (result.ok) onClose();
    return result;
  };

  return (
    <aside className="property-add-flyout" aria-label="Add property">
      <div className="panel-column-header property-add-flyout__header">
        <div className="property-add-flyout__header-start">
          {mode === "compose" && (
            <Button size="small" variant="ghost" onClick={onBackToPick}>
              ← Presets
            </Button>
          )}
          <span className="panel-column-header__title">{title}</span>
        </div>
        <IconButton icon={X} label="Close" onClick={onClose} iconSize={18} />
      </div>

      {mode === "pick" ? (
        <PropertyPickPanel
          schemas={schemas}
          groups={groups}
          onAddFieldPreset={(label) => void onAddFieldPreset(label)}
          onAddGroupPreset={(label) => void onAddGroupPreset(label)}
          onCustomizeFieldPreset={onCustomizeFieldPreset}
          onCustomizeGroupPreset={onCustomizeGroupPreset}
          onCreateCustomField={onCreateCustomField}
          onCreateCustomGroup={onCreateCustomGroup}
        />
      ) : composeKind === "group" ? (
        <PropertyGroupComposer
          key={presetLabel ?? "custom-group"}
          initialPresetLabel={presetLabel}
          onCancel={onBackToPick}
          onCreate={handleCreateGroup}
        />
      ) : (
        <PropertyFieldComposer
          key={presetLabel ?? "custom-field"}
          initialPresetLabel={presetLabel}
          onCancel={onBackToPick}
          onCreate={handleCreateSchema}
        />
      )}
    </aside>
  );
}
